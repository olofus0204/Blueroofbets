
import {
  Trophy,
  CalendarDays,
  Clock,
  ArrowRight,
  Target,
  Medal,
  Zap,
} from 'lucide-react';

import Navbar from '../components/Navbar';

// Temporary sample fixtures.
// These will eventually come from our Supabase database.
const upcomingMatches = [
  {
    id: 1,
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    date: 'TBD',
    time: 'TBD',
    status: 'Coming Soon',
  },
  {
    id: 2,
    homeTeam: 'Team C',
    awayTeam: 'Team D',
    date: 'TBD',
    time: 'TBD',
    status: 'Coming Soon',
  },
  {
    id: 3,
    homeTeam: 'Team E',
    awayTeam: 'Team F',
    date: 'TBD',
    time: 'TBD',
    status: 'Coming Soon',
  },
];

// Temporary leaderboard data for the homepage preview.
const leaderboard = [
  { position: 1, name: 'Participant One', points: 0 },
  { position: 2, name: 'Participant Two', points: 0 },
  { position: 3, name: 'Participant Three', points: 0 },
];

function Home() {
  return (
    <div className="home-page">

      {/* Website navigation. */}
      <Navbar />

      <main>

        {/* Hero section introduces the prediction competition. */}
        <section className="hero-section">
          <div className="hero-content">

            <span className="hero-badge">
              <Zap size={15} />
              BLUEROOF FOOTBALL TOURNAMENT
            </span>

            <h1>
              PREDICT.
              <span> COMPETE.</span>
              <br />
              <span className="hero-highlight">CONQUER.</span>
            </h1>

            <p>
              Think you know football? Predict match outcomes,
              earn points and compete with other football fans
              for the top position on the Blueroof leaderboard.
            </p>

            <div className="hero-actions">
              <a href="/register" className="primary-button">
                Join the Competition
                <ArrowRight size={18} />
              </a>

              <a href="#fixtures" className="secondary-button">
                View Fixtures
              </a>
            </div>

            {/* Quick competition information. */}
            <div className="hero-stats">
              <div>
                <strong>FREE</strong>
                <span>To Predict</span>
              </div>

              <div>
                <strong>POINTS</strong>
                <span>Earn Rewards</span>
              </div>

              <div>
                <strong>LIVE</strong>
                <span>Leaderboard</span>
              </div>
            </div>
          </div>

          {/* Decorative football artwork. */}
          <div className="hero-visual">
            <div className="hero-glow"></div>

            <img
              src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=900"
              alt="Football stadium with a green football pitch"
            />

            <div className="hero-image-label">
              <Trophy size={20} />
              <span>
                THE COMPETITION STARTS HERE
              </span>
            </div>
          </div>
        </section>

        {/* Upcoming fixtures section. */}
        <section className="content-section" id="fixtures">

          <div className="section-heading">
            <div>
              <span className="section-label">THE ACTION</span>
              <h2>Upcoming Fixtures</h2>
              <p>Get ready to make your predictions.</p>
            </div>

            <a href="/fixtures" className="text-link">
              All Fixtures <ArrowRight size={16} />
            </a>
          </div>

          <div className="fixtures-grid">
            {upcomingMatches.map((match) => (
              <article className="match-card" key={match.id}>

                <div className="match-card-header">
                  <span>
                    <CalendarDays size={14} />
                    {match.date}
                  </span>

                  <span className="match-status">
                    {match.status}
                  </span>
                </div>

                <div className="teams-container">

                  <div className="team">
                    <div className="team-placeholder">
                      {match.homeTeam.charAt(0)}
                    </div>

                    <strong>{match.homeTeam}</strong>
                    <small>HOME</small>
                  </div>

                  <div className="versus">
  <span>VS</span>

  {/* Display the match kick-off time with a clock icon. */}
  <small className="match-time">
    <Clock size={12} />
    {match.time}
  </small>
</div>

                  <div className="team">
                    <div className="team-placeholder">
                      {match.awayTeam.charAt(0)}
                    </div>

                    <strong>{match.awayTeam}</strong>
                    <small>AWAY</small>
                  </div>

                </div>

                <a href="/register" className="predict-button">
                  Register to Predict
                  <ArrowRight size={16} />
                </a>

              </article>
            ))}
          </div>
        </section>

        {/* How the prediction competition works. */}
        <section className="how-section" id="about">
          <div className="section-heading centered-heading">
            <div>
              <span className="section-label">HOW IT WORKS</span>
              <h2>Your Football Knowledge Counts</h2>
              <p>Three simple steps to join the competition.</p>
            </div>
          </div>

          <div className="how-grid">

            <div className="how-card">
              <div className="how-icon blue-icon">
                <Target size={27} />
              </div>
              <h3>01. Make Predictions</h3>
              <p>
                Choose your predicted match outcomes and
                submit your scores before kickoff.
              </p>
            </div>

            <div className="how-card">
              <div className="how-icon green-icon">
                <Zap size={27} />
              </div>
              <h3>02. Earn Points</h3>
              <p>
                Get points for correct predictions and
                improve your tournament standing.
              </p>
            </div>

            <div className="how-card">
              <div className="how-icon purple-icon">
                <Trophy size={27} />
              </div>
              <h3>03. Climb the Rankings</h3>
              <p>
                Compete against other participants
                and aim for the top of the leaderboard.
              </p>
            </div>

          </div>
        </section>

        {/* Leaderboard preview. */}
        <section className="content-section leaderboard-section" id="leaderboard">

          <div className="section-heading">
            <div>
              <span className="section-label">TOP PREDICTORS</span>
              <h2>Leaderboard</h2>
              <p>See who's leading the competition.</p>
            </div>

            <a href="/leaderboard" className="text-link">
              Full Rankings <ArrowRight size={16} />
            </a>
          </div>

          <div className="leaderboard-card">

            {leaderboard.map((participant) => (
              <div className="leaderboard-row" key={participant.position}>

                <span className="rank-number">
                  {participant.position === 1 ? (
                    <Trophy size={20} />
                  ) : (
                    participant.position
                  )}
                </span>

                <div className="participant-avatar">
                  {participant.name.charAt(0)}
                </div>

                <strong>{participant.name}</strong>

                <span className="points">
                  {participant.points} pts
                </span>

              </div>
            ))}

            <div className="leaderboard-empty">
              <Medal size={19} />
              <span>
                Rankings will update as predictions are scored.
              </span>
            </div>

          </div>
        </section>

        {/* Final call to action. */}
        <section className="join-section">
          <div>
            <span className="section-label">YOUR GAME STARTS HERE</span>
            <h2>Ready to Prove Your Football Knowledge?</h2>
            <p>
              Join Blueroof and compete with other football fans.
            </p>
          </div>

          <a href="/register" className="primary-button">
            Create Your Account
            <ArrowRight size={18} />
          </a>
        </section>

      </main>

      {/* Website footer. */}
      <footer className="footer">
        <div className="footer-brand">
          <Trophy size={20} />
          <strong>BLUEROOF</strong>
        </div>

        <p>
          Blueroof Football Tournament. Predict. Compete. Conquer.
        </p>

        <span>© {new Date().getFullYear()} Blueroofbets.</span>
      </footer>

    </div>
  );
}

export default Home;
