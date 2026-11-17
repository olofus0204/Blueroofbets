
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trophy,
  LogOut,
  Target,
  ClipboardList,
  Medal,
  CalendarDays,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

import { supabase } from '../services/supabase';
import './ParticipantDashboard.css';

// Format fixture dates using the tournament's Nigeria timezone.
const formatKickoff = (kickoffAt) => {
  if (!kickoffAt) return 'Kick-off not scheduled';

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(kickoffAt));
};

// Make database stage values readable on the dashboard.
const formatStage = (stage) => {
  const stageNames = {
    group: 'Group Stage',
    quarter_final: 'Quarter-final',
    semi_final: 'Semi-final',
    final: 'Final',
  };

  return stageNames[stage] || 'Tournament Match';
};

function ParticipantDashboard() {
  const navigate = useNavigate();

  // Store all information needed by the participant dashboard.
  const [dashboard, setDashboard] = useState({
    profile: null,
    email: '',
    predictions: [],
    answers: [],
    upcomingMatches: [],
    recentMatches: [],
    teams: {},
  });

  // Track the dashboard loading and error states.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Prevent state updates if the component is no longer mounted.
    let isActive = true;

    const loadDashboard = async () => {
      try {
        // Get the currently authenticated participant.
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        // Load the participant's profile, predictions and fixtures.
        const [
          profileResult,
          predictionsResult,
          upcomingResult,
          recentResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, role')
            .eq('id', user.id)
            .single(),

          supabase
            .from('predictions')
            .select('id, match_id, points_awarded, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('matches')
            .select(
              'id, home_team_id, away_team_id, kickoff_at, stage, status'
            )
            .eq('status', 'upcoming')
            .not('kickoff_at', 'is', null)
            .gt('kickoff_at', new Date().toISOString())
            .order('kickoff_at', { ascending: true })
            .limit(10),

          supabase
            .from('matches')
            .select(
              'id, home_team_id, away_team_id, home_score, away_score, stage, updated_at'
            )
            .eq('status', 'completed')
            .order('updated_at', { ascending: false })
            .limit(5),
        ]);

        // Stop loading if any of the main database requests failed.
        const queryResults = [
          profileResult,
          predictionsResult,
          upcomingResult,
          recentResult,
        ];

        const failedQuery = queryResults.find((result) => result.error);

        if (failedQuery) throw failedQuery.error;

        const predictions = predictionsResult.data || [];
        const upcomingMatches = upcomingResult.data || [];
        const recentMatches = recentResult.data || [];

        // Retrieve the participant's answers for scoring statistics.
        let answers = [];

        if (predictions.length > 0) {
          const predictionIds = predictions.map(
            (prediction) => prediction.id
          );

          const { data: answerData, error: answerError } = await supabase
            .from('prediction_answers')
            .select('id, prediction_id, is_correct, points_awarded, scored_at')
            .in('prediction_id', predictionIds);

          if (answerError) throw answerError;

          answers = answerData || [];
        }

        // Collect team IDs used by the upcoming and completed fixtures.
        const teamIds = [
          ...new Set(
            [...upcomingMatches, ...recentMatches].flatMap((match) => [
              match.home_team_id,
              match.away_team_id,
            ])
          ),
        ].filter(Boolean);

        // Load team names so fixture cards can display readable names.
        let teams = {};

        if (teamIds.length > 0) {
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);

          if (teamError) throw teamError;

          teams = Object.fromEntries(
            (teamData || []).map((team) => [team.id, team.name])
          );
        }

        // Save the completed dashboard data.
        if (isActive) {
          setDashboard({
            profile: profileResult.data,
            email: user.email || '',
            predictions,
            answers,
            upcomingMatches,
            recentMatches,
            teams,
          });
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError.message || 'Unable to load your dashboard.'
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [navigate]);

  // Sign the participant out safely.
  const handleLogout = async () => {
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    navigate('/login', { replace: true });
  };

  // Calculate points and accuracy from the participant's records.
  const totalPoints = dashboard.predictions.reduce(
    (total, prediction) =>
      total + Number(prediction.points_awarded || 0),
    0
  );

  // Only scored answers count towards prediction accuracy.
  const scoredAnswers = dashboard.answers.filter(
    (answer) => answer.scored_at !== null
  );

  const correctAnswers = scoredAnswers.filter(
    (answer) => answer.is_correct === true
  ).length;

  const accuracy = scoredAnswers.length
    ? Math.round((correctAnswers / scoredAnswers.length) * 100)
    : 0;

  const displayName =
    dashboard.profile?.display_name || 'Participant';

  if (loading) {
    return (
      <main className="participant-loading">
        <div className="participant-loading-spinner" />
        <p>Loading your dashboard...</p>
      </main>
    );
  }

  return (
    <main className="participant-page">
      {/* Dashboard navigation and branding. */}
      <header className="participant-header">
        <Link to="/" className="participant-brand">
          <span className="participant-brand-icon">
            <Trophy size={23} />
          </span>

          <span>
            Blueroof
            <span className="participant-brand-highlight">bets</span>
          </span>
        </Link>

        <nav className="participant-nav">
          <Link to="/dashboard" className="participant-nav-active">
            Dashboard
          </Link>

          <Link to="/standings">Standings</Link>
          <Link to="/">Home</Link>
        </nav>

        <div className="participant-account">
          <div className="participant-account-info">
            <strong>{displayName}</strong>
            <span>Participant</span>
          </div>

          <button
            type="button"
            className="participant-logout"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="participant-content">
        {/* Welcome section. */}
        <section className="participant-welcome">
          <div>
            <p className="participant-eyebrow">
              BLUEROOF FOOTBALL TOURNAMENT
            </p>

            <h1>Welcome back, {displayName}!</h1>

            <p>
              Track your predictions, follow the fixtures and see
              how you are performing in the tournament.
            </p>
          </div>

          <div className="participant-welcome-icon">
            <Trophy size={66} />
          </div>
        </section>

        {/* Display errors without hiding the rest of the dashboard. */}
        {error && (
          <div className="participant-error">
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        )}

        {/* Participant performance summary. */}
        <section className="participant-stats">
          <article className="participant-stat-card">
            <span className="participant-stat-icon points-icon">
              <Trophy size={22} />
            </span>
            <p>Total points</p>
            <h2>{totalPoints}</h2>
            <span>Points earned</span>
          </article>

          <article className="participant-stat-card">
            <span className="participant-stat-icon predictions-icon">
              <ClipboardList size={22} />
            </span>
            <p>Prediction slips</p>
            <h2>{dashboard.predictions.length}</h2>
            <span>Matches predicted</span>
          </article>

          <article className="participant-stat-card">
            <span className="participant-stat-icon correct-icon">
              <Target size={22} />
            </span>
            <p>Correct answers</p>
            <h2>{correctAnswers}</h2>
            <span>Successfully scored picks</span>
          </article>

          <article className="participant-stat-card">
            <span className="participant-stat-icon accuracy-icon">
              <Medal size={22} />
            </span>
            <p>Accuracy</p>
            <h2>{accuracy}%</h2>
            <span>Of scored answers</span>
          </article>
        </section>

        {/* Upcoming fixtures. */}
        <section className="participant-section">
          <div className="participant-section-heading">
            <div>
              <p className="participant-eyebrow">WHAT'S NEXT?</p>
              <h2>Upcoming fixtures</h2>
            </div>

            <span className="participant-section-count">
              {dashboard.upcomingMatches.length} matches
            </span>
          </div>

          {dashboard.upcomingMatches.length === 0 ? (
            <div className="participant-empty">
              <CalendarDays size={30} />
              <h3>No upcoming fixtures</h3>
              <p>New fixtures will appear here when they are scheduled.</p>
            </div>
          ) : (
            <div className="participant-fixture-list">
              {dashboard.upcomingMatches.map((match) => (
                <article
                  className="participant-fixture-card"
                  key={match.id}
                >
                  <div className="participant-fixture-top">
                    <span>{formatStage(match.stage)}</span>
                    <span>{formatKickoff(match.kickoff_at)}</span>
                  </div>

                  <div className="participant-fixture-teams">

                    {/* Open the prediction form for this specific fixture. */}
<Link
  to={`/predict/${match.id}`}
  className="participant-predict-link"
>
  Make predictions <ArrowRight size={16} />
</Link> 


                    <strong>
                      {dashboard.teams[match.home_team_id] || 'Home team'}
                    </strong>

                    <span>VS</span>

                    <strong>
                      {dashboard.teams[match.away_team_id] || 'Away team'}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Recent completed matches. */}
        <section className="participant-section">
          <div className="participant-section-heading">
            <div>
              <p className="participant-eyebrow">LATEST RESULTS</p>
              <h2>Recent match results</h2>
            </div>

            <Link to="/standings" className="participant-text-link">
              View standings <ArrowRight size={16} />
            </Link>
          </div>

          {dashboard.recentMatches.length === 0 ? (
            <div className="participant-empty">
              <Trophy size={30} />
              <h3>No completed matches yet</h3>
              <p>Completed match results will appear here.</p>
            </div>
          ) : (
            <div className="participant-results-list">
              {dashboard.recentMatches.map((match) => (
                <article
                  className="participant-result-card"
                  key={match.id}
                >
                  <div>
                    <strong>
                      {dashboard.teams[match.home_team_id] || 'Home team'}
                    </strong>

                    <span className="participant-result-score">
                      {match.home_score} - {match.away_score}
                    </span>

                    <strong>
                      {dashboard.teams[match.away_team_id] || 'Away team'}
                    </strong>
                  </div>

                  <span>{formatStage(match.stage)}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Helpful links. */}
        <section className="participant-quick-links">
          <div>
            <h2>Stay in the game</h2>
            <p>
              Check the latest group standings and follow the race
              for qualification.
            </p>
          </div>

          <Link to="/standings" className="participant-standings-button">
            View group standings <ArrowRight size={17} />
          </Link>
        </section>

        <footer className="participant-footer">
          Blueroof Football Tournament · Blueroofbets
        </footer>
      </div>
    </main>
  );
}

export default ParticipantDashboard;
