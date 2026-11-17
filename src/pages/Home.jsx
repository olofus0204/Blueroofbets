import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  CalendarDays,
  Clock,
  ArrowRight,
  Target,
  Medal,
  Zap,
  ClipboardList,
} from 'lucide-react';

import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';

// Format fixture dates using the tournament's Nigeria timezone.
const formatMatchDate = (kickoffAt) => {
  if (!kickoffAt) return 'TBD';

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(new Date(kickoffAt));
};

// Format kick-off times using the tournament's Nigeria timezone.
const formatMatchTime = (kickoffAt) => {
  if (!kickoffAt) return 'TBD';

  return new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Lagos',
  }).format(new Date(kickoffAt));
};

// Convert database fixture statuses into friendly homepage labels.
const formatMatchStatus = (status, kickoffAt) => {
  if (status === 'postponed') return 'Postponed';
  if (!kickoffAt) return 'Coming Soon';
  return 'Upcoming';
};

function Home() {
  // Store upcoming fixtures and leaderboard data loaded from Supabase.
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Track loading and error states separately so one section can still load
  // when the other section encounters a database or network problem.
  const [fixturesLoading, setFixturesLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [fixturesError, setFixturesError] = useState('');
  const [leaderboardError, setLeaderboardError] = useState('');

  // Store the current account type so homepage calls-to-action are relevant.
  const [accountRole, setAccountRole] = useState(null);

  useEffect(() => {
    let isActive = true;
    let authRequestNumber = 0;

    // Load upcoming and postponed fixtures managed from the admin panel.
    const loadUpcomingFixtures = async () => {
      try {
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select(
            'id, home_team_id, away_team_id, kickoff_at, status, stage'
          )
          .in('status', ['upcoming', 'postponed'])
          .order('kickoff_at', { ascending: true, nullsFirst: false })
          .limit(3);

        if (matchesError) throw matchesError;

        const fixtureRows = matches || [];
        const teamIds = [
          ...new Set(
            fixtureRows.flatMap((match) => [
              match.home_team_id,
              match.away_team_id,
            ])
          ),
        ].filter(Boolean);

        // Fetch team names separately to avoid depending on generated
        // Supabase relationship names in the matches query.
        let teamNames = {};

        if (teamIds.length > 0) {
          const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds);

          if (teamsError) throw teamsError;

          teamNames = Object.fromEntries(
            (teams || []).map((team) => [team.id, team.name])
          );
        }

        if (!isActive) return;

        // Convert database rows into the shape used by the existing fixture cards.
        setUpcomingMatches(
          fixtureRows.map((match) => ({
            id: match.id,
            homeTeam: teamNames[match.home_team_id] || 'Team TBA',
            awayTeam: teamNames[match.away_team_id] || 'Team TBA',
            date: formatMatchDate(match.kickoff_at),
            time: formatMatchTime(match.kickoff_at),
            status: formatMatchStatus(match.status, match.kickoff_at),
          }))
        );
      } catch (error) {
        console.error('Unable to load homepage fixtures:', error.message);

        if (isActive) {
          setFixturesError('Fixtures are temporarily unavailable. Please try again later.');
        }
      } finally {
        if (isActive) setFixturesLoading(false);
      }
    };

    // Use a database function so public visitors can see aggregate standings
    // without receiving access to private profiles or individual predictions.
    const loadLeaderboard = async () => {
      try {
        const { data, error } = await supabase.rpc(
          'get_public_leaderboard',
          { p_limit: 3 }
        );

        if (error) throw error;

        if (isActive) setLeaderboard(data || []);
      } catch (error) {
        console.error('Unable to load homepage leaderboard:', error.message);

        if (isActive) {
          setLeaderboardError('Leaderboard is temporarily unavailable.');
        }
      } finally {
        if (isActive) setLeaderboardLoading(false);
      }
    };

    // Resolve the current user's role for the homepage action buttons.
    const loadAccountRole = async (user) => {
      const currentRequest = ++authRequestNumber;

      if (!user) {
        if (isActive) setAccountRole(null);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!isActive || currentRequest !== authRequestNumber) return;

      if (error) {
        console.error('Unable to load homepage account role:', error.message);
      }

      setAccountRole(profile?.role === 'admin' ? 'admin' : 'participant');
    };

    // Listen for sign-in and sign-out events so homepage buttons stay current.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer the profile query until the authentication callback completes.
      setTimeout(() => {
        void loadAccountRole(session?.user || null);
      }, 0);
    });

    // Check the existing session when the homepage first opens.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isActive) return;

      if (error) {
        console.error('Unable to retrieve homepage session:', error.message);
        setAccountRole(null);
        return;
      }

      void loadAccountRole(data.session?.user || null);
    });

    // Load the two public homepage sections independently.
    void loadUpcomingFixtures();
    void loadLeaderboard();

    return () => {
      isActive = false;
      authRequestNumber += 1;
      subscription.unsubscribe();
    };
  }, []);

  // Send signed-in users to the dashboard matching their account role.
  const dashboardPath = accountRole === 'admin' ? '/admin' : '/dashboard';
  const mainActionPath = accountRole ? dashboardPath : '/register';
  let mainActionLabel = 'Join the Competition';

  if (accountRole === 'admin') {
    mainActionLabel = 'Open Admin Dashboard';
  } else if (accountRole === 'participant') {
    mainActionLabel = 'Open My Dashboard';
  }
  // Choose the correct action for each fixture and account type.
const getFixtureAction = (matchId) => {
  // Administrators can open the admin panel to manage fixtures.
  if (accountRole === 'admin') {
    return {
      path: '/admin',
      label: 'Manage Fixtures',
    };
  }

  // Participants go directly to the prediction page for this match.
  if (accountRole === 'participant') {
    return {
      path: `/predict/${matchId}`,
      label: 'Make Predictions',
    };
  }

  // Visitors must register before submitting predictions.
  return {
    path: '/register',
    label: 'Register to Predict',
  };
};

  // Prepare fixture section content without deeply nested JSX conditions.
  let fixturesContent;

  if (fixturesLoading) {
    fixturesContent = (
      <div className="leaderboard-empty">Loading upcoming fixtures...</div>
    );
  } else if (fixturesError) {
    fixturesContent = (
      <div className="leaderboard-empty">{fixturesError}</div>
    );
  } else if (upcomingMatches.length === 0) {
    fixturesContent = (
      <div className="leaderboard-empty">
        <CalendarDays size={19} />
        <span>No upcoming fixtures have been scheduled yet.</span>
      </div>
    );
  } else {
    fixturesContent = (
      <div className="fixtures-grid">
        {upcomingMatches.map((match) => {
  // Get the correct button destination for this specific fixture.
  const action = getFixtureAction(match.id);

  return (
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

      {/* Send each visitor to the appropriate destination. */}
      <Link
        to={action.path}
        className="predict-button"
      >
        {action.label}
        <ArrowRight size={16} />
      </Link>
    </article>
  );
})}
      </div>
    );
  }

  // Prepare leaderboard content for loading, errors, and real participant rows.
  let leaderboardContent;

  if (leaderboardLoading) {
    leaderboardContent = (
      <div className="leaderboard-empty">Loading leaderboard...</div>
    );
  } else if (leaderboardError) {
    leaderboardContent = (
      <div className="leaderboard-empty">{leaderboardError}</div>
    );
  } else if (leaderboard.length === 0) {
    leaderboardContent = (
      <div className="leaderboard-empty">
        <Medal size={19} />
        <span>No participant scores yet. Be the first to compete!</span>
      </div>
    );
  } else {
    leaderboardContent = (
      <>
        {leaderboard.map((participant) => (
          <div className="leaderboard-row" key={participant.rank}>
            <span className="rank-number">
              {participant.rank === 1 ? <Trophy size={20} /> : participant.rank}
            </span>

            <div className="participant-avatar">
              {participant.display_name.charAt(0).toUpperCase()}
            </div>

            <strong>{participant.display_name}</strong>

            <span className="points">
              {Number(participant.total_points || 0)} pts
            </span>
          </div>
        ))}

        <div className="leaderboard-empty">
          <Medal size={19} />
          <span>Rankings update as predictions are scored.</span>
        </div>
      </>
    );
  }

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
  <a href={mainActionPath} className="primary-button">
    {mainActionLabel}
    <ArrowRight size={18} />
  </a>

  {/* Give logged-in participants direct access to their submitted predictions. */}
  {accountRole === 'participant' && (
    <Link to="/my-betslips" className="secondary-button">
      <ClipboardList size={17} />
      My Betslips
    </Link>
  )}

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
              <span>THE COMPETITION STARTS HERE</span>
            </div>
          </div>
        </section>

        {/* Upcoming fixtures loaded from the admin-managed Supabase records. */}
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

          {fixturesContent}
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

        {/* Leaderboard preview loaded through the safe public database function. */}
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
            {leaderboardContent}
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

          <a href={mainActionPath} className="primary-button">
            {mainActionLabel}
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
