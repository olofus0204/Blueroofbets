
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Save,
  Trophy,
} from 'lucide-react';

import { supabase } from '../services/supabase';
import './PredictionPage.css';

// Convert database stage values into readable fixture labels.
const formatStage = (stage) => {
  const labels = {
    group: 'Group Stage',
    quarter_final: 'Quarter-final',
    semi_final: 'Semi-final',
    final: 'Final',
  };

  return labels[stage] || 'Tournament Match';
};

// Format dates using the tournament's Nigeria timezone.
const formatDateTime = (value) => {
  if (!value) return 'Kick-off not scheduled';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(date);
};

// Format the remaining time until the prediction deadline.
const formatCountdown = (milliseconds) => {
  if (milliseconds <= 0) return 'Deadline passed';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

// Build the answer choices for each prediction market.
const getMarketOptions = (marketKey, homeName, awayName) => {
  const resultOptions = [
    { value: 'home', label: `${homeName} win` },
    { value: 'draw', label: 'Draw' },
    { value: 'away', label: `${awayName} win` },
  ];

  const optionsByMarket = {
    // Match result after normal time.
    match_outcome: resultOptions,

    // Total combined goals scored by both teams.
    total_goals: [
      { value: '0-4', label: '0–4 goals' },
      { value: '5-7', label: '5–7 goals' },
      { value: '8-10', label: '8–10 goals' },
      { value: '11+', label: '11+ goals' },
    ],

    // Whether both teams score at least one goal.
    both_teams_score: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],

    // Team that scores the first goal.
    first_team_to_score: [
      { value: 'home', label: homeName },
      { value: 'away', label: awayName },
      { value: 'no_goal', label: 'No goal' },
    ],

    // Whether at least one team keeps a clean sheet.
    clean_sheet: [
      {
        value: 'yes',
        label: 'Yes — at least one team keeps a clean sheet',
      },
      {
        value: 'no',
        label: 'No — both teams score',
      },
    ],

    // Winning margin for the fixture.
    winning_margin: [
      { value: 'draw', label: 'Draw' },
      { value: '1', label: 'Win by 1 goal' },
      { value: '2', label: 'Win by 2 goals' },
      { value: '3+', label: 'Win by 3 or more goals' },
    ],

    // Half-time result.
    halftime_result: resultOptions,

    // Second-half result, based on second-half goals only.
    second_half_winner: resultOptions,
  };

  return optionsByMarket[marketKey] || [];
};

function PredictionPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  // Store the fixture, teams, available markets and saved prediction.
  const [pageData, setPageData] = useState({
    userId: null,
    match: null,
    teams: {},
    markets: [],
    prediction: null,
    lockMinutes: 0,
  });

  // Store the participant's selected answers using market IDs.
  const [answers, setAnswers] = useState({});

  // Track the page and submission states.
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // The clock starts empty and is updated after the component mounts.
  // This avoids calling the impure Date.now() function during rendering.
  const [currentTime, setCurrentTime] = useState(null);

  // ------------------------------------------------------------
  // LOAD FIXTURE, MARKETS AND EXISTING PARTICIPANT PREDICTIONS
  // ------------------------------------------------------------

  useEffect(() => {
    let isActive = true;

    const loadPredictionPage = async () => {
      try {
        // Confirm that a participant is signed in.
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        // Fetch fixture details and tournament deadline settings.
        const [matchResult, settingsResult] = await Promise.all([
          supabase
            .from('matches')
            .select(
              'id, home_team_id, away_team_id, kickoff_at, status, stage'
            )
            .eq('id', matchId)
            .single(),

          supabase
            .from('tournament_settings')
            .select('prediction_lock_minutes')
            .eq('id', true)
            .maybeSingle(),
        ]);

        if (matchResult.error) throw matchResult.error;
        if (settingsResult.error) throw settingsResult.error;

        const match = matchResult.data;

        const lockMinutes = Number(
          settingsResult.data?.prediction_lock_minutes ?? 0
        );

        // Retrieve the two team names used in this fixture.
        const teamIds = [
          ...new Set([
            match.home_team_id,
            match.away_team_id,
          ]),
        ].filter(Boolean);

        const { data: teamRows, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);

        if (teamsError) throw teamsError;

        const teams = Object.fromEntries(
          (teamRows || []).map((team) => [
            team.id,
            team.name,
          ])
        );

        // Retrieve all enabled prediction markets for this fixture.
        const {
          data: marketConfigurations,
          error: configError,
        } = await supabase
          .from('match_prediction_markets')
          .select('market_id, points, is_enabled')
          .eq('match_id', matchId)
          .eq('is_enabled', true);

        if (configError) throw configError;

        const marketIds = (marketConfigurations || []).map(
          (configuration) => configuration.market_id
        );

        let markets = [];

        // Retrieve active market descriptions and their configured points.
        if (marketIds.length > 0) {
          const {
            data: marketTypes,
            error: marketsError,
          } = await supabase
            .from('prediction_market_types')
            .select(
              'id, market_key, name, description, sort_order'
            )
            .in('id', marketIds)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

          if (marketsError) throw marketsError;

          const pointsByMarket = Object.fromEntries(
            (marketConfigurations || []).map((configuration) => [
              configuration.market_id,
              configuration.points,
            ])
          );

          markets = (marketTypes || []).map((market) => ({
            ...market,
            points: Number(
              pointsByMarket[market.id] ?? 0
            ),
          }));
        }

        // Find an existing prediction slip for this participant.
        const {
          data: prediction,
          error: predictionError,
        } = await supabase
          .from('predictions')
          .select('id, points_awarded, created_at, updated_at')
          .eq('user_id', user.id)
          .eq('match_id', matchId)
          .maybeSingle();

        if (predictionError) throw predictionError;

        let existingAnswers = {};

        // Load saved answers so participants can continue editing their slip.
        if (prediction?.id) {
          const {
            data: answerRows,
            error: answersError,
          } = await supabase
            .from('prediction_answers')
            .select(
              'market_id, selected_value, is_correct, points_awarded, scored_at'
            )
            .eq('prediction_id', prediction.id);

          if (answersError) throw answersError;

          existingAnswers = Object.fromEntries(
            (answerRows || []).map((answer) => [
              answer.market_id,
              answer.selected_value,
            ])
          );
        }

        // Update the page only if the component is still mounted.
        if (!isActive) return;

        setPageData({
          userId: user.id,
          match,
          teams,
          markets,
          prediction: prediction || null,
          lockMinutes,
        });

        setAnswers(existingAnswers);
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError.message ||
            'Unable to load this prediction fixture.'
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadPredictionPage();

    return () => {
      isActive = false;
    };
  }, [matchId, navigate]);

  // ------------------------------------------------------------
  // COUNTDOWN CLOCK
  // ------------------------------------------------------------

  useEffect(() => {
    // Update the clock asynchronously after the component mounts.
    // The same callback keeps the displayed countdown refreshed.
    const timerId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    // Stop the clock when the participant leaves the page.
    return () => window.clearInterval(timerId);
  }, []);

  // ------------------------------------------------------------
  // FIXTURE AND DEADLINE INFORMATION
  // ------------------------------------------------------------

  const homeName =
    pageData.teams[pageData.match?.home_team_id] || 'Home team';

  const awayName =
    pageData.teams[pageData.match?.away_team_id] || 'Away team';

  // Calculate the prediction deadline from the fixture kick-off
// and the deadline allowance configured by the administrator.
const kickoffTimestamp = pageData.match?.kickoff_at
  ? new Date(pageData.match.kickoff_at).getTime()
  : null;

// Only calculate a deadline when the kick-off date is valid.
const deadlineTime =
  kickoffTimestamp !== null && Number.isFinite(kickoffTimestamp)
    ? kickoffTimestamp - (pageData.lockMinutes * 60 * 1000)
    : null;

    
  // Do not calculate a countdown until the clock has initialized.
  const remainingTime =
    deadlineTime === null || currentTime === null
      ? 0
      : deadlineTime - currentTime;

  // Lock the form when the fixture is unavailable or the deadline passes.
  const isLocked =
    !pageData.match ||
    pageData.match.status !== 'upcoming' ||
    deadlineTime === null ||
    currentTime === null ||
    remainingTime <= 0;

  // Count selected markets that are currently available on this fixture.
  const selectedCount = pageData.markets.filter(
    (market) =>
      typeof answers[market.id] === 'string' &&
      answers[market.id].trim() !== ''
  ).length;

  // ------------------------------------------------------------
  // UPDATE A SINGLE MARKET ANSWER
  // ------------------------------------------------------------

  const updateAnswer = (marketId, selectedValue) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [marketId]: selectedValue,
    }));

    setError('');
    setSuccess('');
  };

  // ------------------------------------------------------------
  // SUBMIT OR UPDATE PREDICTIONS
  // ------------------------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    // Perform a quick client-side deadline check.
    // Supabase performs the authoritative check again.
    if (isLocked) {
      setError(
        'The prediction deadline has passed or this fixture is no longer accepting predictions.'
      );
      return;
    }

    // Include only enabled markets that the participant answered.
    const selectedAnswers = pageData.markets
      .filter((market) => (
        typeof answers[market.id] === 'string' &&
        answers[market.id].trim() !== ''
      ))
      .map((market) => ({
        market_id: market.id,
        selected_value: answers[market.id].trim(),
      }));

    // At least one market must be selected.
    if (selectedAnswers.length === 0) {
      setError(
        'Please answer at least one prediction market before submitting.'
      );
      return;
    }

    // Validate the correct-score input before contacting Supabase.
    const correctScoreMarket = pageData.markets.find(
      (market) => market.market_key === 'correct_score'
    );

    const correctScoreAnswer = correctScoreMarket
      ? answers[correctScoreMarket.id]?.trim() || ''
      : '';

    if (
      correctScoreAnswer &&
      !/^\d+-\d+$/.test(correctScoreAnswer)
    ) {
      setError(
        'Enter the correct score using the format home-away, for example 2-1.'
      );
      return;
    }

    setSubmitting(true);

    try {
      // Call the secure database function to save all selected markets.
      const {
        data: predictionId,
        error: submitError,
      } = await supabase.rpc(
        'submit_prediction_answers',
        {
          p_match_id: matchId,
          p_answers: selectedAnswers,
        }
      );

      if (submitError) throw submitError;

      if (!predictionId) {
        throw new Error(
          'The database did not return a prediction slip ID.'
        );
      }

      // Retrieve the saved answers to confirm the database response.
      const {
        data: savedAnswers,
        error: refreshError,
      } = await supabase
        .from('prediction_answers')
        .select('market_id, selected_value')
        .eq('prediction_id', predictionId);

      if (refreshError) throw refreshError;

      // Update the local page with the saved prediction.
      setPageData((current) => ({
        ...current,
        prediction: {
          ...(current.prediction || {}),
          id: predictionId,
        },
      }));

      // Refresh the answer selections from the database.
      setAnswers(
        Object.fromEntries(
          (savedAnswers || []).map((answer) => [
            answer.market_id,
            answer.selected_value,
          ])
        )
      );

      setSuccess(
        'Your predictions have been saved successfully. You can update them before the deadline.'
      );
    } catch (submitError) {
      setError(
        submitError.message ||
        'Your predictions could not be saved. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // LOADING STATE
  // ------------------------------------------------------------

  if (loading) {
    return (
      <main className="prediction-loading">
        <div className="prediction-spinner" />
        <p>Loading prediction markets...</p>
      </main>
    );
  }

  // ------------------------------------------------------------
  // FIXTURE NOT FOUND OR UNAVAILABLE
  // ------------------------------------------------------------

  if (!pageData.match) {
    return (
      <main className="prediction-page">
        <div className="prediction-content">
          <div className="prediction-message prediction-message-error">
            <AlertCircle size={20} />
            <span>
              {error || 'This fixture could not be found.'}
            </span>
          </div>

          <Link
            to="/dashboard"
            className="prediction-back-link"
          >
            <ArrowLeft size={17} />
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------------
  // MAIN PREDICTION PAGE
  // ------------------------------------------------------------

  return (
    <main className="prediction-page">

      {/* Page navigation and branding. */}
      <header className="prediction-header">
        <Link to="/" className="prediction-brand">
          <span className="prediction-brand-icon">
            <Trophy size={22} />
          </span>

          <span>
            BLUEROOF
            <span className="prediction-brand-highlight">
              bets
            </span>
          </span>
        </Link>

        <Link
          to="/dashboard"
          className="prediction-dashboard-link"
        >
          My dashboard
        </Link>
      </header>

      <div className="prediction-content">

        {/* Return to the participant dashboard. */}
        <Link
          to="/dashboard"
          className="prediction-back-link"
        >
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>

        {/* Fixture information and deadline countdown. */}
        <section className="prediction-fixture-banner">

          <div className="prediction-fixture-meta">
            <span>{formatStage(pageData.match.stage)}</span>
            <span>
              {formatDateTime(pageData.match.kickoff_at)}
            </span>
          </div>

          <div className="prediction-fixture-teams">
            <strong>{homeName}</strong>
            <span>VS</span>
            <strong>{awayName}</strong>
          </div>

          <div
            className={`prediction-deadline ${
              isLocked ? 'is-locked' : ''
            }`}
          >
            <Clock3 size={17} />

            {deadlineTime === null
              ? 'Kick-off time not set — predictions unavailable'
              : currentTime === null
                ? 'Checking prediction deadline...'
                : isLocked
                  ? 'Predictions are closed'
                  : `Time remaining: ${formatCountdown(remainingTime)}`
            }
          </div>

          <p className="prediction-deadline-note">
            Prediction deadline:{' '}

            {deadlineTime === null
              ? 'Not available'
              : formatDateTime(
                  new Date(deadlineTime).toISOString()
                )
            }

            {' · '}Nigeria time
          </p>
        </section>

        {/* Explain the market selection process. */}
        <section className="prediction-intro">
          <div>
            <span className="prediction-eyebrow">
              MAKE YOUR PICKS
            </span>

            <h1>Choose your prediction markets</h1>

            <p>
              You do not have to answer every market. Choose the
              ones you want, then save your selections before
              the deadline.
            </p>
          </div>

          <div className="prediction-selected-count">
            <strong>{selectedCount}</strong>
            <span>markets selected</span>
          </div>
        </section>

        {/* Show submission errors. */}
        {error && (
          <div
            className="prediction-message prediction-message-error"
            role="alert"
          >
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        )}

        {/* Confirm successful submissions. */}
        {success && (
          <div
            className="prediction-message prediction-message-success"
            role="status"
          >
            <CheckCircle2 size={19} />
            <span>{success}</span>
          </div>
        )}

        {/* Display the active markets or an empty state. */}
        {pageData.markets.length === 0 ? (
          <div className="prediction-empty">
            <Trophy size={30} />
            <h2>No prediction markets are available</h2>
            <p>
              The administrator has not enabled any markets
              for this fixture.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>

            <div className="prediction-market-list">

              {pageData.markets.map((market) => {
                const currentAnswer = answers[market.id] || '';

                const options = getMarketOptions(
                  market.market_key,
                  homeName,
                  awayName
                );

                const isCorrectScore =
                  market.market_key === 'correct_score';

                const isSelected =
                  currentAnswer.trim() !== '';

                return (
                  <article
                    className={`prediction-market-card ${
                      isSelected ? 'market-selected' : ''
                    }`}
                    key={market.id}
                  >

                    <div className="prediction-market-heading">
                      <div>
                        <span className="prediction-market-number">
                          {String(market.sort_order).padStart(2, '0')}
                        </span>

                        <h2>{market.name}</h2>
                      </div>

                      <span className="prediction-points">
                        {market.points} pts
                      </span>
                    </div>

                    {market.description && (
                      <p className="prediction-market-description">
                        {market.description}
                      </p>
                    )}

                    {/* Correct score requires two numerical values. */}
                    {isCorrectScore ? (
                      <div className="prediction-score-input-wrap">
                        <label htmlFor={`score-${market.id}`}>
                          Your predicted full-time score
                        </label>

                        <input
                          id={`score-${market.id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]+-[0-9]+"
                          placeholder="Example: 2-1"
                          value={currentAnswer}
                          onChange={(event) => updateAnswer(
                            market.id,
                            event.target.value
                          )}
                          disabled={isLocked || submitting}
                          aria-label="Predicted home score followed by away score"
                        />

                        <small>
                          Enter home score-away score, using a hyphen.
                        </small>
                      </div>
                    ) : (
                      /* Other markets use selectable answer buttons. */
                      <div className="prediction-options">
                        {options.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={`prediction-option ${
                              currentAnswer === option.value
                                ? 'option-active'
                                : ''
                            }`}
                            onClick={() => updateAnswer(
                              market.id,
                              currentAnswer === option.value
                                ? ''
                                : option.value
                            )}
                            disabled={isLocked || submitting}
                            aria-pressed={
                              currentAnswer === option.value
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Allow participants to skip an answered market. */}
                    {isSelected && !isLocked && (
                      <button
                        type="button"
                        className="prediction-clear-answer"
                        onClick={() => updateAnswer(market.id, '')}
                        disabled={submitting}
                      >
                        Remove this market from my slip
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Prediction submission controls. */}
            <div className="prediction-submit-panel">
              <div>
                <strong>
                  {selectedCount} of {pageData.markets.length} markets selected
                </strong>

                <span>
                  You can change your selections until the prediction deadline.
                </span>
              </div>

              <button
                type="submit"
                className="prediction-submit-button"
                disabled={
                  isLocked ||
                  submitting ||
                  selectedCount === 0
                }
              >
                <Save size={18} />

                {submitting
                  ? 'Saving predictions...'
                  : pageData.prediction
                    ? 'Update my predictions'
                    : 'Submit my predictions'
                }
              </button>
            </div>

          </form>
        )}

        {/* Explain why saved answers cannot be edited. */}
        {isLocked && pageData.prediction && (
          <p className="prediction-readonly-note">
            Your saved predictions are shown above. This fixture
            is now locked, so answers can no longer be changed.
          </p>
        )}

        <footer className="prediction-footer">
          Blueroof Football Tournament · Predict. Compete. Conquer.
        </footer>

      </div>
    </main>
  );
}

export default PredictionPage;
