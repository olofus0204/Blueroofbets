import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Medal, RefreshCw, Trophy } from 'lucide-react';

import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';
import './Leaderboard.css';

// Display a participant's accuracy as a percentage.
const formatAccuracy = (value) => `${Number(value || 0).toFixed(1)}%`;

function Leaderboard() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    // Defer the initial request so state updates happen asynchronously
    // rather than directly inside the effect body.
    const requestTimer = window.setTimeout(async () => {
      try {
        const { data, error: leaderboardError } = await supabase.rpc(
          'get_blueroof_public_leaderboard',
          { p_limit: 100 }
        );

        if (leaderboardError) throw leaderboardError;

        if (isActive) {
          setParticipants(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError.message || 'Unable to load the tournament leaderboard.'
          );
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(requestTimer);
    };
  }, [refreshKey]);

  // Refresh the public rankings when the visitor requests it.
  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((current) => current + 1);
  };

  const topThree = participants.slice(0, 3);

  return (
    <main className="public-leaderboard-page">
      <Navbar />

      <div className="public-leaderboard-content">
        <section className="public-leaderboard-hero">
          <div className="public-leaderboard-hero-copy">
            <span className="public-leaderboard-eyebrow">
              BLUEROOF FOOTBALL TOURNAMENT
            </span>
            <h1>Leaderboard</h1>
            <p>
              Follow the top predictors, track the points race and see who is
              leading the Blueroof competition.
            </p>
          </div>
          <div className="public-leaderboard-hero-icon" aria-hidden="true">
            <Trophy size={58} />
          </div>
        </section>

        <section className="public-leaderboard-section">
          <div className="public-leaderboard-section-heading">
            <div>
              <span className="public-leaderboard-eyebrow">TOP PREDICTORS</span>
              <h2>Competition rankings</h2>
              <p>Ranked by points, correct answers and prediction accuracy.</p>
            </div>

            <button
              type="button"
              className="public-leaderboard-refresh"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="public-leaderboard-error" role="alert">
              <AlertCircle size={19} />
              <div>
                <strong>We couldn't load the leaderboard.</strong>
                <p>{error}</p>
                <p className="public-leaderboard-error-help">
                  Check that the leaderboard SQL function has been installed in
                  Supabase and that public execution is enabled.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="public-leaderboard-empty">
              <div className="public-leaderboard-spinner" />
              <p>Loading tournament rankings...</p>
            </div>
          ) : !error && participants.length === 0 ? (
            <div className="public-leaderboard-empty">
              <Medal size={34} />
              <h3>No rankings yet</h3>
              <p>
                Participant rankings will appear here after predictions have
                been scored.
              </p>
              <Link to="/register" className="public-leaderboard-join-link">
                Join the competition
              </Link>
            </div>
          ) : !error ? (
            <>
              {topThree.length > 0 && (
                <div className="public-leaderboard-podium">
                  {topThree.map((participant) => (
                    <article
                      className={`public-leaderboard-podium-card podium-rank-${participant.rank}`}
                      key={`${participant.rank}-${participant.display_name}`}
                    >
                      <div className="public-leaderboard-rank-icon">
                        {Number(participant.rank) === 1 ? (
                          <Trophy size={23} />
                        ) : (
                          <Medal size={22} />
                        )}
                      </div>
                      <span className="public-leaderboard-podium-rank">
                        #{participant.rank}
                      </span>
                      <h3>{participant.display_name}</h3>
                      <strong className="public-leaderboard-podium-points">
                        {Number(participant.total_points || 0)} pts
                      </strong>
                      <span className="public-leaderboard-podium-detail">
                        {Number(participant.correct_answers || 0)} correct ·{' '}
                        {formatAccuracy(participant.accuracy)} accuracy
                      </span>
                    </article>
                  ))}
                </div>
              )}

              <div className="public-leaderboard-table-wrap">
                <table className="public-leaderboard-table">
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Participant</th>
                      <th scope="col">Points</th>
                      <th scope="col">Correct answers</th>
                      <th scope="col">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant) => (
                      <tr key={`${participant.rank}-${participant.display_name}`}>
                        <td className="public-leaderboard-rank-cell">
                          #{participant.rank}
                        </td>
                        <td className="public-leaderboard-name-cell">
                          <span className="public-leaderboard-avatar">
                            {(participant.display_name || 'P').charAt(0).toUpperCase()}
                          </span>
                          <strong>{participant.display_name}</strong>
                        </td>
                        <td className="public-leaderboard-points-cell">
                          {Number(participant.total_points || 0)} pts
                        </td>
                        <td>{Number(participant.correct_answers || 0)}</td>
                        <td>{formatAccuracy(participant.accuracy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="public-leaderboard-footnote">
                Accuracy is calculated from scored answers only. Pending and
                unanswered markets are excluded.
              </p>
            </>
          ) : null}
        </section>

        <section className="public-leaderboard-cta">
          <div>
            <h2>Ready to climb the rankings?</h2>
            <p>Make your predictions and compete for the top position.</p>
          </div>
          <Link to="/dashboard" className="public-leaderboard-cta-link">
            Go to dashboard
          </Link>
        </section>

        <footer className="public-leaderboard-footer">
          Blueroof Football Tournament · Predict. Compete. Conquer.
        </footer>
      </div>
    </main>
  );
}

export default Leaderboard;
