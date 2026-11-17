
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Trophy,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  AlertCircle,
} from 'lucide-react';

import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';
import './MyBetslips.css';

// Format dates using the tournament's Nigeria timezone.
const formatDate = (dateValue) => {
  if (!dateValue) return 'Date TBA';

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(dateValue));
};

// Format kickoff times using Nigeria time.
const formatTime = (dateValue) => {
  if (!dateValue) return 'Time TBA';

  return new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Lagos',
  }).format(new Date(dateValue));
};

// Convert fixture statuses into readable labels.
const formatStatus = (status) => {
  const labels = {
    upcoming: 'Upcoming',
    live: 'Live',
    completed: 'Completed',
    postponed: 'Postponed',
    cancelled: 'Cancelled',
  };

  return labels[status] || status || 'Unknown';
};

// Make raw market selections easier to read.
const formatSelection = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'No selection';
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Capitalise the first letter of a market selection.
const capitalise = (value) => {
  const formatted = formatSelection(value);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

function MyBetslips() {
  const [betslips, setBetslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    const loadBetslips = async () => {
      try {
        setLoading(true);
        setError('');

        // Get the currently authenticated participant.
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          window.location.href = '/login';
          return;
        }

        // Retrieve only this participant's prediction slips.
        const {
          data: predictions,
          error: predictionsError,
        } = await supabase
          .from('predictions')
          .select('id, match_id, points_awarded, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (predictionsError) throw predictionsError;

        const slips = predictions || [];

        // A participant with no submitted slips gets a friendly empty state.
        if (slips.length === 0) {
          if (isActive) setBetslips([]);
          return;
        }

        const predictionIds = slips.map((slip) => slip.id);
        const matchIds = [...new Set(slips.map((slip) => slip.match_id))];

        // Load submitted answers and their corresponding fixtures.
        const [
          { data: answers, error: answersError },
          { data: matches, error: matchesError },
        ] = await Promise.all([
          supabase
            .from('prediction_answers')
            .select(
              'id, prediction_id, market_id, selected_value, is_correct, points_awarded, scored_at'
            )
            .in('prediction_id', predictionIds),

          supabase
            .from('matches')
            .select(
              'id, home_team_id, away_team_id, kickoff_at, stage, status, home_score, away_score'
            )
            .in('id', matchIds),
        ]);

        if (answersError) throw answersError;
        if (matchesError) throw matchesError;

        const answerRows = answers || [];
        const matchRows = matches || [];

        const marketIds = [
          ...new Set(answerRows.map((answer) => answer.market_id)),
        ].filter(Boolean);

        // Load configured markets to identify which markets were enabled
        // for each fixture and how many points each market was worth.
        let configuredMarkets = [];

        if (matchIds.length > 0 && marketIds.length > 0) {
          const {
            data,
            error: configuredMarketsError,
          } = await supabase
            .from('match_prediction_markets')
            .select('id, match_id, market_id, points, is_enabled')
            .in('match_id', matchIds)
            .in('market_id', marketIds);

          if (configuredMarketsError) throw configuredMarketsError;

          configuredMarkets = data || [];
        }

        // Retrieve readable market names.
        let marketTypes = [];

        if (marketIds.length > 0) {
          const {
            data,
            error: marketTypesError,
          } = await supabase
            .from('prediction_market_types')
            .select('id, market_key, name')
            .in('id', marketIds);

          if (marketTypesError) throw marketTypesError;

          marketTypes = data || [];
        }

        // Collect all team IDs used by the participant's fixtures.
        const teamIds = [
          ...new Set(
            matchRows.flatMap((match) => [
              match.home_team_id,
              match.away_team_id,
            ])
          ),
        ].filter(Boolean);

        let teams = [];

        if (teamIds.length > 0) {
          const { data, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);

          if (teamsError) throw teamsError;

          teams = data || [];
        }

        // Build lookup maps so each slip can be displayed efficiently.
        const matchMap = Object.fromEntries(
          matchRows.map((match) => [match.id, match])
        );

        const teamMap = Object.fromEntries(
          teams.map((team) => [team.id, team.name])
        );

        const marketMap = Object.fromEntries(
          marketTypes.map((market) => [market.id, market])
        );

        const configuredMarketMap = Object.fromEntries(
          configuredMarkets.map((market) => [
            `${market.match_id}_${market.market_id}`,
            market,
          ])
        );

        const answersByPrediction = {};

        answerRows.forEach((answer) => {
          if (!answersByPrediction[answer.prediction_id]) {
            answersByPrediction[answer.prediction_id] = [];
          }

          answersByPrediction[answer.prediction_id].push(answer);
        });

        // Combine the slip, fixture, teams, and answer details.
        const formattedSlips = slips.map((slip) => {
          const match = matchMap[slip.match_id];

          const slipAnswers = (
            answersByPrediction[slip.id] || []
          ).map((answer) => {
            const market = marketMap[answer.market_id];
            const configuration = configuredMarketMap[
              `${slip.match_id}_${answer.market_id}`
            ];

            return {
              ...answer,
              marketName: market?.name || market?.market_key || 'Prediction market',
              marketPoints: configuration?.points ?? null,
            };
          });

          const scoredAnswers = slipAnswers.filter(
            (answer) => answer.scored_at !== null
          );

          const correctAnswers = scoredAnswers.filter(
            (answer) => answer.is_correct === true
          );

          // Use the slip's stored total where available. Otherwise,
          // calculate the total from the individual scored answers.
          const totalPoints =
            slip.points_awarded ??
            scoredAnswers.reduce(
              (total, answer) => total + Number(answer.points_awarded || 0),
              0
            );

          return {
            ...slip,
            match,
            homeTeam: teamMap[match?.home_team_id] || 'Team TBA',
            awayTeam: teamMap[match?.away_team_id] || 'Team TBA',
            answers: slipAnswers,
            scoredCount: scoredAnswers.length,
            correctCount: correctAnswers.length,
            totalPoints: Number(totalPoints || 0),
          };
        });

        if (isActive) setBetslips(formattedSlips);
      } catch (loadError) {
        console.error('Unable to load participant betslips:', loadError);

        if (isActive) {
          setError(
            'We could not load your betslips. Please refresh the page and try again.'
          );
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadBetslips();

    return () => {
      isActive = false;
    };
  }, []);

  // Calculate participant-wide totals from the loaded slips.
  const totalPoints = betslips.reduce(
    (total, slip) => total + slip.totalPoints,
    0
  );

  const totalAnswers = betslips.reduce(
    (total, slip) => total + slip.answers.length,
    0
  );

  const scoredAnswers = betslips.reduce(
    (total, slip) => total + slip.scoredCount,
    0
  );

  return (
    <div className="my-betslips-page">
      <Navbar />

      <main className="my-betslips-container">
        <Link to="/dashboard" className="betslips-back-link">
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        <section className="betslips-heading">
          <div>
            <span className="betslips-eyebrow">
              YOUR PREDICTIONS
            </span>

            <h1>My Betslips</h1>

            <p>
              Review your submitted predictions and follow your points
              throughout the tournament.
            </p>
          </div>

          <div className="betslips-heading-icon">
            <ClipboardList size={34} />
          </div>
        </section>

        {!loading && !error && (
          <section className="betslips-summary">
            <article className="betslips-summary-card">
              <ClipboardList size={22} />
              <div>
                <strong>{betslips.length}</strong>
                <span>Prediction Slips</span>
              </div>
            </article>

            <article className="betslips-summary-card">
              <Trophy size={22} />
              <div>
                <strong>{totalPoints}</strong>
                <span>Total Points</span>
              </div>
            </article>

            <article className="betslips-summary-card">
              <Target size={22} />
              <div>
                <strong>{scoredAnswers}/{totalAnswers}</strong>
                <span>Scored Answers</span>
              </div>
            </article>
          </section>
        )}

        {loading && (
          <div className="betslips-message">
            <Hourglass size={23} />
            <p>Loading your betslips...</p>
          </div>
        )}

        {!loading && error && (
          <div className="betslips-message betslips-error">
            <AlertCircle size={23} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && betslips.length === 0 && (
          <div className="betslips-empty">
            <ClipboardList size={42} />

            <h2>No betslips yet</h2>

            <p>
              You have not submitted any predictions. Visit the fixtures
              page and make your first predictions before kickoff.
            </p>

            <Link to="/fixtures" className="betslips-primary-button">
              Explore Fixtures
            </Link>
          </div>
        )}

        {!loading && !error && betslips.length > 0 && (
          <section className="betslips-list">
            {betslips.map((slip) => {
              const matchStatus = slip.match?.status || 'unknown';
              const isCompleted = matchStatus === 'completed';

              return (
                <article className="betslip-card" key={slip.id}>
                  <div className="betslip-card-header">
                    <div>
                      <span className="betslip-stage">
                        {(slip.match?.stage || 'match').replaceAll('_', ' ')}
                      </span>

                      <span className="betslip-date">
                        {formatDate(slip.match?.kickoff_at)}
                        {' · '}
                        {formatTime(slip.match?.kickoff_at)}
                      </span>
                    </div>

                    <span
                      className={`betslip-status status-${matchStatus}`}
                    >
                      {formatStatus(matchStatus)}
                    </span>
                  </div>

                  <div className="betslip-match">
                    <div className="betslip-team">
                      <strong>{slip.homeTeam}</strong>
                      <span>HOME</span>
                    </div>

                    <div className="betslip-score">
                      {isCompleted &&
                      slip.match?.home_score !== null &&
                      slip.match?.away_score !== null ? (
                        <>
                          {slip.match.home_score}
                          <span>:</span>
                          {slip.match.away_score}
                        </>
                      ) : (
                        <span>VS</span>
                      )}
                    </div>

                    <div className="betslip-team away-team">
                      <strong>{slip.awayTeam}</strong>
                      <span>AWAY</span>
                    </div>
                  </div>

                  <div className="betslip-points">
                    <div>
                      <span>Points earned</span>
                      <strong>{slip.totalPoints} pts</strong>
                    </div>

                    <div>
                      <span>Correct answers</span>
                      <strong>
                        {slip.correctCount}/{slip.scoredCount}
                      </strong>
                    </div>
                  </div>

                  <div className="betslip-answers-heading">
                    <h3>Your Selections</h3>
                    <span>{slip.answers.length} markets</span>
                  </div>

                  {slip.answers.length === 0 ? (
                    <p className="betslip-no-answers">
                      No prediction answers were found for this slip.
                    </p>
                  ) : (
                    <div className="betslip-answers">
                      {slip.answers.map((answer) => {
                        const isScored = answer.scored_at !== null;

                        return (
                          <div
                            className="betslip-answer"
                            key={answer.id}
                          >
                            <div className="betslip-answer-details">
                              <strong>{answer.marketName}</strong>
                              <span>
                                {capitalise(answer.selected_value)}
                              </span>
                            </div>

                            <div className="betslip-answer-result">
                              {isScored ? (
                                answer.is_correct ? (
                                  <span className="answer-correct">
                                    <CheckCircle2 size={15} />
                                    Correct
                                  </span>
                                ) : (
                                  <span className="answer-incorrect">
                                    <XCircle size={15} />
                                    Incorrect
                                  </span>
                                )
                              ) : (
                                <span className="answer-pending">
                                  <Clock size={15} />
                                  Pending
                                </span>
                              )}

                              <strong>
                                {isScored
                                  ? `${Number(answer.points_awarded || 0)} pts`
                                  : '—'}
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="betslip-footer">
                    <span>
                      Submitted {formatDate(slip.created_at)}
                    </span>

                    <Link to={`/predict/${slip.match_id}`}>
                      View Match
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

export default MyBetslips;
