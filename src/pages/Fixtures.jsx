import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Filter,
  RefreshCw,
  Trophy,
} from 'lucide-react';

import { supabase } from '../services/supabase';
import './Fixtures.css';

// Labels used by the public fixtures page.
const STAGES = [
  { value: 'group', label: 'Group Stage' },
  { value: 'quarter_final', label: 'Quarter-final' },
  { value: 'semi_final', label: 'Semi-final' },
  { value: 'final', label: 'Final' },
];

const STATUSES = [
  'upcoming',
  'live',
  'completed',
  'postponed',
  'cancelled',
];

const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

// Format fixture dates in the tournament's Nigeria timezone.
function formatKickoff(value) {
  if (!value) return 'Kick-off to be announced';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(date);
}

// Convert database stage values into readable labels.
function getStageLabel(stage) {
  return STAGES.find((item) => item.value === stage)?.label || 'Tournament Match';
}

// Keep status text readable while retaining its database value.
function formatStatus(status) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
}

function Fixtures() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(false);

  // Public filters let visitors find fixtures by stage, group and status.
  const [stageFilter, setStageFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load fixtures and team names from the same Supabase tables used by Admin.
  const fetchFixtures = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const [matchesResult, teamsResult] = await Promise.all([
        supabase
          .from('matches')
          .select(
            'id, home_team_id, away_team_id, kickoff_at, status, stage, matchday, bracket_code, home_score, away_score'
          )
          .order('kickoff_at', { ascending: true, nullsFirst: false }),

        supabase
          .from('teams')
          .select('id, name, group_name')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (matchesResult.error) throw matchesResult.error;
      if (teamsResult.error) throw teamsResult.error;

      // Map team IDs to names and group names for readable fixture cards.
      const teamMap = Object.fromEntries(
        (teamsResult.data || []).map((team) => [team.id, team])
      );

      const loadedFixtures = (matchesResult.data || []).map((match) => ({
        ...match,
        homeTeam: teamMap[match.home_team_id] || null,
        awayTeam: teamMap[match.away_team_id] || null,
      }));

      if (isMountedRef.current) {
        setFixtures(loadedFixtures);
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        setError(loadError.message || 'Unable to load tournament fixtures.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Fetch fixtures after the component mounts.
// Deferring the request avoids synchronous state updates inside the effect.
useEffect(() => {
  isMountedRef.current = true;

  // Schedule the initial database request outside the effect's synchronous body.
  const fetchTimer = window.setTimeout(() => {
    void fetchFixtures();
  }, 0);

  // Cancel the scheduled request and prevent updates after unmounting.
  return () => {
    window.clearTimeout(fetchTimer);
    isMountedRef.current = false;
  };
}, [fetchFixtures]);

  // Apply the selected filters without changing the database records.
  const filteredFixtures = fixtures.filter((fixture) => {
    const stage = fixture.stage || 'group';
    const homeName = fixture.homeTeam?.name || 'Home team';
    const awayName = fixture.awayTeam?.name || 'Away team';
    const search = searchTerm.trim().toLowerCase();
    const groupNames = [
      fixture.homeTeam?.group_name,
      fixture.awayTeam?.group_name,
    ];

    const matchesSearch =
      !search ||
      homeName.toLowerCase().includes(search) ||
      awayName.toLowerCase().includes(search) ||
      (fixture.bracket_code || '').toLowerCase().includes(search);

    const matchesStage = stageFilter === 'all' || stage === stageFilter;
    const matchesStatus = statusFilter === 'all' || fixture.status === statusFilter;
    const matchesGroup = groupFilter === 'all' || groupNames.includes(groupFilter);

    return matchesSearch && matchesStage && matchesStatus && matchesGroup;
  });

  const upcomingCount = fixtures.filter((fixture) => fixture.status === 'upcoming').length;
  const completedCount = fixtures.filter((fixture) => fixture.status === 'completed').length;
  const liveCount = fixtures.filter((fixture) => fixture.status === 'live').length;

  return (
    <main className="public-fixtures-page">
      {/* Public page header and navigation. */}
      <header className="public-fixtures-header">
        <Link to="/" className="public-fixtures-brand">
          <span className="public-fixtures-brand-icon"><Trophy size={22} /></span>
          <span>BLUEROOF<span className="public-fixtures-brand-highlight">bets</span></span>
        </Link>

        <nav className="public-fixtures-nav" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/standings">Standings</Link>
          <Link to="/dashboard">My Dashboard</Link>
        </nav>
      </header>

      <div className="public-fixtures-content">
        <Link to="/" className="public-fixtures-back-link">
          <ArrowLeft size={16} /> Back to homepage
        </Link>

        <section className="public-fixtures-hero">
          <div>
            <p className="public-fixtures-eyebrow">BLUEROOF FOOTBALL TOURNAMENT</p>
            <h1>All Fixtures</h1>
            <p>Follow every group-stage and knockout match, including the latest results.</p>
          </div>
          <Trophy className="public-fixtures-hero-icon" size={58} />
        </section>

        {/* Summary totals come from the live matches table. */}
        <section className="public-fixtures-summary" aria-label="Fixture totals">
          <article>
            <span>Total fixtures</span>
            <strong>{fixtures.length}</strong>
          </article>
          <article>
            <span>Upcoming</span>
            <strong>{upcomingCount}</strong>
          </article>
          <article>
            <span>Live</span>
            <strong>{liveCount}</strong>
          </article>
          <article>
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </article>
        </section>

        {/* Search, stage, group and status filters. */}
        <section className="public-fixtures-filters">
          <div className="public-fixtures-filter-title">
            <Filter size={18} />
            <h2>Find a fixture</h2>
          </div>

          <div className="public-fixtures-filter-grid">
            <label>
              Search teams or bracket
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Enter a team name"
              />
            </label>

            <label>
              Competition stage
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="all">All stages</option>
                {STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>{stage.label}</option>
                ))}
              </select>
            </label>

            <label>
              Group
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
                <option value="all">All groups</option>
                {GROUPS.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>

            <label>
              Match status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>{formatStatus(status)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="public-fixtures-filter-footer">
            <span>Showing {filteredFixtures.length} of {fixtures.length} fixtures</span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStageFilter('all');
                setGroupFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </button>
          </div>
        </section>

        {error && (
          <div className="public-fixtures-error" role="alert">
            <strong>Fixtures could not be loaded.</strong>
            <span>{error}</span>
            <span>Check that public read access is enabled for matches and active teams in Supabase.</span>
          </div>
        )}

        <div className="public-fixtures-list-heading">
          <div>
            <p className="public-fixtures-eyebrow">THE TOURNAMENT SCHEDULE</p>
            <h2>Match schedule and results</h2>
          </div>
          <button
            type="button"
            className="public-fixtures-refresh"
            onClick={() => fetchFixtures(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="public-fixtures-empty">Loading tournament fixtures...</div>
        ) : filteredFixtures.length === 0 ? (
          <div className="public-fixtures-empty">
            <CalendarDays size={32} />
            <h3>No fixtures found</h3>
            <p>There are no fixtures matching the selected filters.</p>
          </div>
        ) : (
          <div className="public-fixtures-cards">
            {filteredFixtures.map((fixture) => {
              const hasScore =
                fixture.home_score !== null && fixture.home_score !== undefined &&
                fixture.away_score !== null && fixture.away_score !== undefined;
              const groupName = fixture.homeTeam?.group_name || fixture.awayTeam?.group_name;
              const stage = fixture.stage || 'group';

              return (
                <article className="public-fixture-card" key={fixture.id}>
                  <div className="public-fixture-card-top">
                    <div className="public-fixture-tags">
                      <span className="public-fixture-stage">{getStageLabel(stage)}</span>
                      {fixture.bracket_code && <span className="public-fixture-bracket">{fixture.bracket_code}</span>}
                      {stage === 'group' && groupName && <span>{groupName}</span>}
                      {stage === 'group' && fixture.matchday && <span>Matchday {fixture.matchday}</span>}
                    </div>
                    <span className={`public-fixture-status status-${fixture.status || 'unknown'}`}>
                      {formatStatus(fixture.status)}
                    </span>
                  </div>

                  <div className="public-fixture-teams">
                    <strong>{fixture.homeTeam?.name || 'Home team'}</strong>
                    <div className="public-fixture-score">
                      {hasScore ? (
                        <span>{fixture.home_score} – {fixture.away_score}</span>
                      ) : (
                        <span className="public-fixture-vs">VS</span>
                      )}
                    </div>
                    <strong>{fixture.awayTeam?.name || 'Away team'}</strong>
                  </div>

                  <div className="public-fixture-card-footer">
                    <span><CalendarDays size={15} /> {formatKickoff(fixture.kickoff_at)}</span>
                    {fixture.status === 'upcoming' && fixture.kickoff_at ? (
                      <Link to={`/predict/${fixture.id}`} className="public-fixture-predict-link">
                        Make prediction <ArrowRight size={15} />
                      </Link>
                    ) : (
                      <span className="public-fixture-status-note">
                        {fixture.status === 'completed' ? 'Full-time result' : formatStatus(fixture.status)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="public-fixtures-bottom-links">
          <Link to="/standings">View group standings <ArrowRight size={16} /></Link>
          <Link to="/dashboard">Go to participant dashboard <ArrowRight size={16} /></Link>
        </section>
      </div>

      <footer className="public-fixtures-footer">
        Blueroof Football Tournament · Predict. Compete. Conquer.
      </footer>
    </main>
  );
}

export default Fixtures;
