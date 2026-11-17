
import { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  CalendarDays,
  Trophy,
  Save,
  Search,
  Filter,
  Clock,
  Activity,
  Medal,
  GitBranch,
} from 'lucide-react';

import { supabase } from '../services/supabase';

// Available match statuses.
const MATCH_STATUSES = [
  'upcoming',
  'live',
  'completed',
  'postponed',
  'cancelled',
];

// Available competition stages.
const MATCH_STAGES = [
  { value: 'group', label: 'Group Stage' },
  { value: 'quarter_final', label: 'Quarter-final' },
  { value: 'semi_final', label: 'Semi-final' },
  { value: 'final', label: 'Final' },
];

// Official tournament groups.
const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

// Official quarter-final bracket codes.
const QUARTER_FINAL_CODES = ['QF1', 'QF2', 'QF3', 'QF4'];

// Convert a database timestamp into Nigeria-local date and time.
function getNigeriaDateTime(timestamp) {
  if (!timestamp) return { date: '', time: '' };

  const date = new Date(timestamp);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const getPart = (items, type) =>
    items.find((item) => item.type === type)?.value || '';

  return {
    date: `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`,
    time: `${getPart(timeParts, 'hour')}:${getPart(timeParts, 'minute')}`,
  };
}

// Convert Nigeria-local date and time into a UTC ISO timestamp.
// Nigeria uses UTC+1.
function getNigeriaTimestamp(date, time) {
  return new Date(`${date}T${time}:00+01:00`).toISOString();
}

// Format a fixture date in Nigeria local time.
function formatKickoff(timestamp) {
  if (!timestamp) return 'Date not set';

  return new Date(timestamp).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Get a readable label for each competition stage.
function getStageLabel(stage) {
  return MATCH_STAGES.find((item) => item.value === stage)?.label
    || 'Group Stage';
}

// Convert optional score inputs into numbers.
function readOptionalScore(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const score = Number(value);

  if (!Number.isInteger(score) || score < 0) {
    return NaN;
  }

  return score;
}

function FixturesManagement() {
  // Store teams, fixtures and page feedback.
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Search and filter controls.
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [matchdayFilter, setMatchdayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  // New fixture form.
  const [form, setForm] = useState({
    stage: 'group',
    matchday: '1',
    home_team_id: '',
    away_team_id: '',
    date: '',
    time: '',
  });

  // Editable values for existing fixtures.
  const [drafts, setDrafts] = useState({});

  // Fetch active teams and all fixtures.
  async function fetchData(showLoading = true) {
    if (showLoading) setLoading(true);

    setError('');

    try {
      const [teamsResult, matchesResult] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, group_name')
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('matches')
          .select('*')
          .order('kickoff_at', { ascending: true }),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (matchesResult.error) throw matchesResult.error;

      const loadedTeams = teamsResult.data || [];
      const loadedMatches = matchesResult.data || [];

      setTeams(loadedTeams);
      setMatches(loadedMatches);

      // Prepare editable values for every fixture.
      const initialDrafts = {};

      loadedMatches.forEach((match) => {
        const kickoff = getNigeriaDateTime(match.kickoff_at);

        initialDrafts[match.id] = {
          stage: match.stage || 'group',
          home_score: match.home_score ?? '',
          away_score: match.away_score ?? '',
          // Store half-time scores separately from normal-time full-time scores.
          half_time_home_score: match.half_time_home_score ?? '',
          half_time_away_score: match.half_time_away_score ?? '',
          // Record which side scored first, or no_goal for a 0-0 match.
          first_goal_outcome: match.first_goal_outcome ?? '',
          extra_time_home_score: match.extra_time_home_score ?? '',
          extra_time_away_score: match.extra_time_away_score ?? '',
          home_penalty_score: match.home_penalty_score ?? '',
          away_penalty_score: match.away_penalty_score ?? '',
          status: match.status,
          matchday: String(match.matchday || 1),
          date: kickoff.date,
          time: kickoff.time,
        };
      });

      setDrafts(initialDrafts);
    } catch (err) {
      setError(err.message || 'Unable to load tournament fixtures.');
    } finally {
      setLoading(false);
    }
  }

  // Load tournament data when the page opens.
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Update the new fixture form.
  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Find a team using its database ID.
  function getTeam(teamId) {
    return teams.find((team) => team.id === teamId);
  }

  // Prevent the same pairing from appearing twice within the same stage.
  // A group-stage pairing may legitimately meet again in a knockout stage.
  function findDuplicateFixture(
    homeTeamId,
    awayTeamId,
    stage,
    excludedMatchId = null
  ) {
    return matches.find((match) => {
      if (match.id === excludedMatchId) return false;

      if ((match.stage || 'group') !== stage) return false;

      return (
        (
          match.home_team_id === homeTeamId &&
          match.away_team_id === awayTeamId
        ) ||
        (
          match.home_team_id === awayTeamId &&
          match.away_team_id === homeTeamId
        )
      );
    });
  }

  // Prevent a team from being scheduled more than once
  // in the same group matchday or knockout round.
  function validateStageAvailability(
    homeTeamId,
    awayTeamId,
    stage,
    matchday,
    excludedMatchId = null
  ) {
    const conflict = matches.find((match) => {
      if (match.id === excludedMatchId) return false;

      if (match.status === 'cancelled') return false;

      if ((match.stage || 'group') !== stage) return false;

      // Group-stage teams can only play once per matchday.
      if (
        stage === 'group' &&
        Number(match.matchday || 1) !== Number(matchday)
      ) {
        return false;
      }

      return (
        match.home_team_id === homeTeamId ||
        match.away_team_id === homeTeamId ||
        match.home_team_id === awayTeamId ||
        match.away_team_id === awayTeamId
      );
    });

    if (conflict) {
      const conflictingHome = getTeam(conflict.home_team_id)?.name;
      const conflictingAway = getTeam(conflict.away_team_id)?.name;

      return `${conflictingHome || 'A team'} vs ${conflictingAway || 'another team'} already has a fixture in this ${stage === 'group' ? `Matchday ${matchday}` : getStageLabel(stage)}.`;
    }

    return '';
  }

  // Generate the four official quarter-finals through the Supabase function.
  async function handleGenerateQuarterFinals() {
    setError('');
    setMessage('');

    if (!allGroupMatchesCompleted) {
      setError(
        'Complete every group-stage fixture and enter its result before generating quarter-finals.'
      );
      return;
    }

    if (quarterFinalsExist) {
      setError(
        'Quarter-final fixtures already exist. Check the knockout fixtures before taking further action.'
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'generate_quarter_finals'
      );

      if (rpcError) throw rpcError;

      await fetchData(false);

      setMessage(
        typeof data === 'string'
          ? data
          : 'Quarter-finals generated successfully using the official group standings.'
      );
    } catch (err) {
      setError(
        err.message || 'Unable to generate the quarter-final fixtures.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Validate and create a fixture.
  async function handleCreateFixture(event) {
    event.preventDefault();

    setError('');
    setMessage('');

    const matchday = Number(form.matchday);
    const stage = form.stage;

    if (
      !Number.isInteger(matchday) ||
      matchday < 1 ||
      !MATCH_STAGES.some((item) => item.value === stage) ||
      !form.home_team_id ||
      !form.away_team_id ||
      !form.date ||
      !form.time
    ) {
      setError('Please complete all fixture fields correctly.');
      return;
    }

    if (form.home_team_id === form.away_team_id) {
      setError('A team cannot play against itself.');
      return;
    }

    // Prevent a duplicate pairing within the selected competition stage.
    if (
      findDuplicateFixture(
        form.home_team_id,
        form.away_team_id,
        stage
      )
    ) {
      setError(
        'These two teams already have a fixture in this competition stage.'
      );
      return;
    }

    // Check that neither team is already scheduled in this round.
    const availabilityError = validateStageAvailability(
      form.home_team_id,
      form.away_team_id,
      stage,
      matchday
    );

    if (availabilityError) {
      setError(availabilityError);
      return;
    }

    let kickoff;

    try {
      kickoff = getNigeriaTimestamp(form.date, form.time);
    } catch {
      setError('Please enter a valid Nigeria-local date and time.');
      return;
    }

    if (Number.isNaN(new Date(kickoff).getTime())) {
      setError('Please enter a valid kick-off date and time.');
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from('matches')
        .insert({
          stage,
          matchday,
          home_team_id: form.home_team_id,
          away_team_id: form.away_team_id,
          kickoff_at: kickoff,
          status: 'upcoming',
        });

      if (insertError) throw insertError;

      setMessage(`${getStageLabel(stage)} fixture created successfully.`);

      setForm({
        stage: 'group',
        matchday: '1',
        home_team_id: '',
        away_team_id: '',
        date: '',
        time: '',
      });

      await fetchData(false);
    } catch (err) {
      setError(err.message || 'Unable to create fixture.');
    } finally {
      setSaving(false);
    }
  }

  // Update a field in an existing fixture.
  function updateDraft(matchId, field, value) {
    setDrafts((current) => ({
      ...current,
      [matchId]: {
        ...current[matchId],
        [field]: value,
      },
    }));
  }

  // Save changes to an existing fixture and calculate its winner.
  async function handleUpdateFixture(match) {
    const draft = drafts[match.id];

    if (!draft) return;

    setError('');
    setMessage('');

    const stage = draft.stage;
    const matchday = Number(draft.matchday);

    // Generated bracket fixtures must remain in their assigned stage.
    if (match.bracket_code && stage !== match.stage) {
      setError('The stage of an automatically generated fixture cannot be changed.');
      return;
    }

    if (
      !MATCH_STAGES.some((item) => item.value === stage) ||
      !Number.isInteger(matchday) ||
      matchday < 1 ||
      !draft.date ||
      !draft.time
    ) {
      setError('Enter a valid stage, matchday, date and kick-off time.');
      return;
    }

    if (!MATCH_STATUSES.includes(draft.status)) {
      setError('Please select a valid match status.');
      return;
    }

    // Read normal-time full-time scores.
    const homeScore = readOptionalScore(draft.home_score);
    const awayScore = readOptionalScore(draft.away_score);

    // Read the half-time scores used by the half-time and second-half markets.
    const halfTimeHome = readOptionalScore(draft.half_time_home_score);
    const halfTimeAway = readOptionalScore(draft.half_time_away_score);

    // Read the first-goal selection used by the first-team-to-score market.
    const firstGoalOutcome = draft.first_goal_outcome || null;

    // Read extra-time scores.
    const extraHome = readOptionalScore(draft.extra_time_home_score);
    const extraAway = readOptionalScore(draft.extra_time_away_score);

    // Read penalty shootout scores.
    const homePenalties = readOptionalScore(draft.home_penalty_score);
    const awayPenalties = readOptionalScore(draft.away_penalty_score);

    const scores = [
      homeScore,
      awayScore,
      halfTimeHome,
      halfTimeAway,
      extraHome,
      extraAway,
      homePenalties,
      awayPenalties,
    ];

    if (scores.some((score) => Number.isNaN(score))) {
      setError('All scores must be whole numbers of zero or more.');
      return;
    }

    if ((homeScore === null) !== (awayScore === null)) {
      setError('Enter both normal-time scores, or leave both empty.');
      return;
    }

    // Half-time scores must be entered as a pair.
    if ((halfTimeHome === null) !== (halfTimeAway === null)) {
      setError('Enter both half-time scores, or leave both empty.');
      return;
    }

    // A half-time score cannot exist without the corresponding full-time score.
    if (halfTimeHome !== null && (homeScore === null || awayScore === null)) {
      setError('Enter both normal-time scores before entering half-time scores.');
      return;
    }

    // Half-time scores cannot exceed the final normal-time scores.
    if (
      halfTimeHome !== null &&
      (halfTimeHome > homeScore || halfTimeAway > awayScore)
    ) {
      setError('Half-time scores cannot be higher than the corresponding full-time scores.');
      return;
    }

    // Validate the first-goal value and ensure it is compatible with the final score.
    if (
      firstGoalOutcome !== null &&
      !['home', 'away', 'no_goal'].includes(firstGoalOutcome)
    ) {
      setError('Select a valid first-team-to-score result.');
      return;
    }

    if (firstGoalOutcome !== null && (homeScore === null || awayScore === null)) {
      setError('Enter both normal-time scores before recording the first team to score.');
      return;
    }

    if (
      (firstGoalOutcome === 'home' && homeScore === 0) ||
      (firstGoalOutcome === 'away' && awayScore === 0) ||
      (firstGoalOutcome === 'no_goal' && (homeScore !== 0 || awayScore !== 0))
    ) {
      setError('The first team to score must be consistent with the final score. Use No goal only for a 0-0 result.');
      return;
    }

    if ((extraHome === null) !== (extraAway === null)) {
      setError('Enter both extra-time scores, or leave both empty.');
      return;
    }

    if ((homePenalties === null) !== (awayPenalties === null)) {
      setError('Enter both penalty scores, or leave both empty.');
      return;
    }

    let winnerTeamId = null;

    // A completed fixture must have normal-time scores.
    if (draft.status === 'completed' && homeScore === null) {
      setError(
        'Enter both normal-time scores before completing the fixture.'
      );
      return;
    }

    if (stage === 'group') {
      // Group matches use normal-time scores only.
      if (
        extraHome !== null ||
        extraAway !== null ||
        homePenalties !== null ||
        awayPenalties !== null
      ) {
        setError(
          'Group-stage fixtures do not use extra time or penalties.'
        );
        return;
      }
    } else if (draft.status === 'completed') {
      // Knockout winner calculation starts with normal-time scores.
      if (homeScore !== awayScore) {
        // A normal-time winner means no extra time or penalties are needed.
        if (
          extraHome !== null ||
          extraAway !== null ||
          homePenalties !== null ||
          awayPenalties !== null
        ) {
          setError(
            'Extra time and penalties are only used when normal time ends in a draw.'
          );
          return;
        }

        winnerTeamId =
          homeScore > awayScore
            ? match.home_team_id
            : match.away_team_id;
      } else {
        // A drawn normal-time score requires extra-time scores.
        if (extraHome === null || extraAway === null) {
          setError(
            'The match is tied after normal time. Enter both extra-time scores.'
          );
          return;
        }

        const totalHome = homeScore + extraHome;
        const totalAway = awayScore + extraAway;

        if (totalHome !== totalAway) {
          // Extra time has produced a winner.
          if (homePenalties !== null || awayPenalties !== null) {
            setError(
              'Penalty scores are not needed when extra time produces a winner.'
            );
            return;
          }

          winnerTeamId =
            totalHome > totalAway
              ? match.home_team_id
              : match.away_team_id;
        } else {
          // A penalty shootout is required if still tied after extra time.
          if (homePenalties === null || awayPenalties === null) {
            setError(
              'The match is still tied after extra time. Enter both penalty scores.'
            );
            return;
          }

          if (homePenalties === awayPenalties) {
            setError(
              'Penalty scores cannot be tied. Enter the shootout result.'
            );
            return;
          }

          winnerTeamId =
            homePenalties > awayPenalties
              ? match.home_team_id
              : match.away_team_id;
        }
      }
    }

    // Prevent duplicate pairings within the selected stage.
    const duplicate = findDuplicateFixture(
      match.home_team_id,
      match.away_team_id,
      stage,
      match.id
    );

    if (duplicate) {
      setError(
        'These two teams already have another fixture in this competition stage.'
      );
      return;
    }

    // Prevent either team from appearing twice in the same round.
    const availabilityError = validateStageAvailability(
      match.home_team_id,
      match.away_team_id,
      stage,
      matchday,
      match.id
    );

    if (availabilityError) {
      setError(availabilityError);
      return;
    }

    let kickoff;

    try {
      kickoff = getNigeriaTimestamp(draft.date, draft.time);
    } catch {
      setError('Please enter a valid Nigeria-local date and time.');
      return;
    }

    if (Number.isNaN(new Date(kickoff).getTime())) {
      setError('Please enter a valid kick-off date and time.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          stage,
          matchday,
          kickoff_at: kickoff,
          home_score: homeScore,
          away_score: awayScore,
          // Save half-time scores for half-time and second-half prediction scoring.
          half_time_home_score: halfTimeHome,
          half_time_away_score: halfTimeAway,
          // Save the manually verified first scorer for its prediction market.
          first_goal_outcome: firstGoalOutcome,

          // Extra-time and penalty scores are only used in knockout matches.
          extra_time_home_score: stage === 'group' ? null : extraHome,
          extra_time_away_score: stage === 'group' ? null : extraAway,
          home_penalty_score: stage === 'group' ? null : homePenalties,
          away_penalty_score: stage === 'group' ? null : awayPenalties,

          // Save the calculated knockout winner.
          winner_team_id: stage === 'group' ? null : winnerTeamId,

          status: draft.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      if (updateError) throw updateError;

      setMessage(
        winnerTeamId
          ? `Fixture updated. ${getTeam(winnerTeamId)?.name || 'The winner'} advances.`
          : 'Fixture updated successfully.'
      );

      await fetchData(false);
    } catch (err) {
      setError(err.message || 'Unable to update fixture.');
    } finally {
      setSaving(false);
    }
  }

  // Delete a fixture after administrator confirmation.
  async function handleDeleteFixture(match) {
    // Protect generated bracket fixtures from accidental deletion.
    if (match.bracket_code) {
      setError(
        'Automatically generated knockout fixtures are protected to preserve tournament progression.'
      );
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this fixture? Associated predictions may also be affected.'
    );

    if (!confirmed) return;

    setError('');
    setMessage('');
    setSaving(true);

    try {
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('id', match.id);

      if (deleteError) throw deleteError;

      setMessage('Fixture deleted successfully.');
      await fetchData(false);
    } catch (err) {
      setError(err.message || 'Unable to delete fixture.');
    } finally {
      setSaving(false);
    }
  }

  // Separate group fixtures from knockout fixtures.
  const groupMatches = matches.filter(
    (match) => (match.stage || 'group') === 'group'
  );

  // Only completed group matches with both scores count as finished.
  const completedGroupMatches = groupMatches.filter(
    (match) =>
      match.status === 'completed' &&
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined
  );

  // Every group fixture must have a completed result before qualification.
  const allGroupMatchesCompleted =
    groupMatches.length > 0 &&
    completedGroupMatches.length === groupMatches.length;

  // Detect existing quarter-finals using their permanent bracket codes.
  const quarterFinalCount = matches.filter(
    (match) => QUARTER_FINAL_CODES.includes(match.bracket_code)
  ).length;

  // Also detect manually created quarter-finals to prevent duplicates.
  const quarterFinalFixtureCount = matches.filter(
    (match) => (match.stage || 'group') === 'quarter_final'
  ).length;

  const quarterFinalsExist =
    quarterFinalCount > 0 || quarterFinalFixtureCount > 0;

  // Calculate fixture summary statistics.
  const completedCount = matches.filter(
    (match) => match.status === 'completed'
  ).length;

  const upcomingCount = matches.filter(
    (match) => match.status === 'upcoming'
  ).length;

  const liveCount = matches.filter(
    (match) => match.status === 'live'
  ).length;

  const postponedCount = matches.filter(
    (match) => match.status === 'postponed'
  ).length;

  const groupCount = groupMatches.length;

  const knockoutCount = matches.filter(
    (match) => (match.stage || 'group') !== 'group'
  ).length;

  // Get unique group-stage matchdays.
  const matchdays = [
    ...new Set(
      groupMatches.map((match) => match.matchday || 1)
    ),
  ].sort((a, b) => a - b);

  // Apply search and filters.
  const filteredMatches = matches.filter((match) => {
    const homeTeam = getTeam(match.home_team_id);
    const awayTeam = getTeam(match.away_team_id);
    const stage = match.stage || 'group';

    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      homeTeam?.name?.toLowerCase().includes(search) ||
      awayTeam?.name?.toLowerCase().includes(search) ||
      match.bracket_code?.toLowerCase().includes(search);

    const matchesGroup =
      groupFilter === 'all' ||
      homeTeam?.group_name === groupFilter ||
      awayTeam?.group_name === groupFilter;

    const matchesMatchday =
      matchdayFilter === 'all' ||
      Number(match.matchday || 1) === Number(matchdayFilter);

    const matchesStatus =
      statusFilter === 'all' || match.status === statusFilter;

    const matchesStage =
      stageFilter === 'all' || stage === stageFilter;

    return (
      matchesSearch &&
      matchesGroup &&
      matchesMatchday &&
      matchesStatus &&
      matchesStage
    );
  });

  // Group the filtered fixtures by competition stage.
  const filteredStages = MATCH_STAGES
    .filter((stage) => (
      filteredMatches.some(
        (match) => (match.stage || 'group') === stage.value
      )
    ))
    .map((stage) => ({
      ...stage,
      fixtures: filteredMatches.filter(
        (match) => (match.stage || 'group') === stage.value
      ),
    }));

  return (
    <div className="space-y-6">
      {/* Page heading and refresh control. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Fixtures Management
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage group fixtures, knockout matches, results and progression.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData()}
          disabled={loading || saving}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Database feedback messages. */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* Automatic qualification and quarter-final generation. */}
      <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
              <GitBranch size={23} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Tournament Progression
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                The top two teams in each group qualify for the quarter-finals.
              </p>

              <p className="mt-2 text-sm font-semibold text-slate-800">
                Group results completed: {completedGroupMatches.length} of {groupMatches.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateQuarterFinals}
            disabled={
              loading ||
              saving ||
              !allGroupMatchesCompleted ||
              quarterFinalsExist
            }
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trophy size={17} />
            {saving
              ? 'Processing...'
              : quarterFinalsExist
                ? 'Quarter-finals Created'
                : 'Generate Quarter-finals'}
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          {quarterFinalCount === 4 ? (
            <p className="font-semibold text-green-700">
              All four automatically generated quarter-finals are in the fixture list.
            </p>
          ) : quarterFinalsExist ? (
            <p className="font-semibold text-orange-700">
              Quarter-final fixtures already exist. Review the knockout fixture list before proceeding.
            </p>
          ) : allGroupMatchesCompleted ? (
            <p className="font-semibold text-green-700">
              All group matches are complete. You can now generate the quarter-finals.
            </p>
          ) : (
            <p>
              Finish all group matches and save their results to unlock quarter-final generation.
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            Quarter-finals: A1 vs C2, C1 vs A2, B1 vs D2, and D1 vs B2.
            Semi-finals and the final are created automatically as knockout winners are confirmed.
          </p>
        </div>
      </section>

      {/* Create fixture form. */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Plus size={20} />
          <h3 className="text-lg font-semibold text-slate-900">
            Add New Fixture
          </h3>
        </div>

        <form onSubmit={handleCreateFixture} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Competition Stage
              <select
                name="stage"
                required
                value={form.stage}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              >
                {MATCH_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Matchday
              <input
                type="number"
                name="matchday"
                min="1"
                required
                value={form.matchday}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Home Team
              <select
                name="home_team_id"
                required
                value={form.home_team_id}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              >
                <option value="">Select home team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.group_name || 'No group'})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Away Team
              <select
                name="away_team_id"
                required
                value={form.away_team_id}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              >
                <option value="">Select away team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.group_name || 'No group'})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Match Date
              <input
                type="date"
                name="date"
                required
                value={form.date}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Kick-off Time (Nigeria)
              <input
                type="time"
                name="time"
                required
                value={form.time}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || teams.length < 2}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            <Plus size={17} />
            {saving ? 'Saving...' : 'Create Fixture'}
          </button>
        </form>
      </section>

      {/* Fixture summary cards. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <CalendarDays className="mb-2 text-blue-700" size={22} />
          <p className="text-sm text-slate-500">Total Fixtures</p>
          <p className="text-2xl font-bold text-slate-900">{matches.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Clock className="mb-2 text-orange-600" size={22} />
          <p className="text-sm text-slate-500">Upcoming</p>
          <p className="text-2xl font-bold text-slate-900">{upcomingCount}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Activity className="mb-2 text-red-600" size={22} />
          <p className="text-sm text-slate-500">Live</p>
          <p className="text-2xl font-bold text-slate-900">{liveCount}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Trophy className="mb-2 text-green-700" size={22} />
          <p className="text-sm text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Medal className="mb-2 text-purple-700" size={22} />
          <p className="text-sm text-slate-500">Knockout Fixtures</p>
          <p className="text-2xl font-bold text-slate-900">{knockoutCount}</p>
          <p className="text-xs text-slate-400">
            {groupCount} group fixtures
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <CalendarDays className="mb-2 text-yellow-600" size={22} />
          <p className="text-sm text-slate-500">Postponed</p>
          <p className="text-2xl font-bold text-slate-900">
            {postponedCount}
          </p>
        </div>
      </div>

      {/* Search and filter controls. */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={19} className="text-slate-600" />
          <h3 className="font-semibold text-slate-900">
            Find Fixtures
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-700">
            Search team
            <div className="relative mt-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Enter team name or bracket"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3"
              />
            </div>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Stage
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            >
              <option value="all">All Stages</option>
              {MATCH_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Group
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            >
              <option value="all">All Groups</option>
              {GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Matchday
            <select
              value={matchdayFilter}
              onChange={(event) => setMatchdayFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            >
              <option value="all">All Matchdays</option>
              {matchdays.map((matchday) => (
                <option key={matchday} value={matchday}>
                  Matchday {matchday}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
            >
              <option value="all">All Statuses</option>
              {MATCH_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Showing {filteredMatches.length} of {matches.length} fixtures.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setGroupFilter('all');
              setMatchdayFilter('all');
              setStatusFilter('all');
              setStageFilter('all');
            }}
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      </section>

      {/* Display fixtures grouped by competition stage. */}
      {loading ? (
        <p className="py-8 text-center text-slate-500">
          Loading fixtures...
        </p>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <CalendarDays className="mx-auto mb-3 text-slate-400" size={32} />
          <h3 className="font-semibold text-slate-800">
            No matching fixtures found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Try changing your search or filter selections.
          </p>
        </div>
      ) : (
        filteredStages.map((stageGroup) => (
          <section
            key={stageGroup.value}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="font-semibold text-slate-800">
                {stageGroup.label}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({stageGroup.fixtures.length} fixtures)
                </span>
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {stageGroup.fixtures.map((match) => {
                const homeTeam = getTeam(match.home_team_id);
                const awayTeam = getTeam(match.away_team_id);
                const draft = drafts[match.id] || {};

                const isKnockout =
                  (draft.stage || match.stage || 'group') !== 'group';

                const normalHome = readOptionalScore(draft.home_score);
                const normalAway = readOptionalScore(draft.away_score);

                // Show extra-time inputs only when normal-time scores are tied.
                const showExtraTime =
                  isKnockout &&
                  normalHome !== null &&
                  normalAway !== null &&
                  normalHome === normalAway;

                const extraHome = readOptionalScore(
                  draft.extra_time_home_score
                );

                const extraAway = readOptionalScore(
                  draft.extra_time_away_score
                );

                // Show penalty inputs when the aggregate score remains tied.
                const showPenalties =
                  showExtraTime &&
                  extraHome !== null &&
                  extraAway !== null &&
                  normalHome + extraHome === normalAway + extraAway;

                const winner = getTeam(match.winner_team_id);
                const isGeneratedFixture = Boolean(match.bracket_code);

                return (
                  <div key={match.id} className="space-y-4 p-5">
                    {/* Fixture details and current status. */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          {getStageLabel(match.stage || 'group')}
                          {match.bracket_code && (
                            <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
                              {match.bracket_code}
                            </span>
                          )}
                          {' • '}
                          {homeTeam?.group_name || 'Group not assigned'}
                          {' • '}
                          {formatKickoff(match.kickoff_at)}
                        </p>

                        <p className="mt-1 font-semibold text-slate-900">
                          {homeTeam?.name || 'Unknown team'}
                          <span className="mx-2 text-slate-400">vs</span>
                          {awayTeam?.name || 'Unknown team'}
                        </p>

                        {winner && (
                          <p className="mt-1 text-xs font-semibold text-green-700">
                            Winner: {winner.name}
                          </p>
                        )}

                        {isGeneratedFixture && (
                          <p className="mt-1 text-xs text-purple-700">
                            Automatically generated bracket fixture
                          </p>
                        )}
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {match.status}
                      </span>
                    </div>

                    {/* Editable stage and scheduling information. */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs font-medium text-slate-600">
                        Competition Stage
                        <select
                          value={draft.stage || match.stage || 'group'}
                          disabled={isGeneratedFixture}
                          onChange={(event) =>
                            updateDraft(
                              match.id,
                              'stage',
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          {MATCH_STAGES.map((stage) => (
                            <option key={stage.value} value={stage.value}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Matchday
                        <input
                          type="number"
                          min="1"
                          value={draft.matchday ?? match.matchday ?? 1}
                          onChange={(event) =>
                            updateDraft(
                              match.id,
                              'matchday',
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                        />
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Match Date
                        <input
                          type="date"
                          value={draft.date || ''}
                          onChange={(event) =>
                            updateDraft(match.id, 'date', event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                        />
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Kick-off Time (Nigeria)
                        <input
                          type="time"
                          value={draft.time || ''}
                          onChange={(event) =>
                            updateDraft(match.id, 'time', event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                        />
                      </label>
                    </div>

                    {/* Normal-time score inputs. */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Normal Time — 25 minutes per half
                      </p>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-xs font-medium text-slate-600">
                          Home Score
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.home_score ?? ''}
                            onChange={(event) =>
                              updateDraft(
                                match.id,
                                'home_score',
                                event.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                          />
                        </label>

                        <label className="text-xs font-medium text-slate-600">
                          Away Score
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.away_score ?? ''}
                            onChange={(event) =>
                              updateDraft(
                                match.id,
                                'away_score',
                                event.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                          />
                        </label>

                        <label className="text-xs font-medium text-slate-600">
                          Match Status
                          <select
                            value={draft.status || match.status}
                            onChange={(event) =>
                              updateDraft(
                                match.id,
                                'status',
                                event.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                          >
                            {MATCH_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Half-time and first-scorer details feed three prediction markets. */}
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                      <p className="mb-1 text-sm font-semibold text-indigo-900">
                        Half-time and First Goal Details
                      </p>

                      <p className="mb-3 text-xs text-indigo-800">
                        Enter these match details from the official result. They are used to score half-time result,
                        second-half winner and first-team-to-score predictions. These are separate from extra-time scores.
                      </p>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-xs font-medium text-slate-700">
                          Home Half-time Score
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.half_time_home_score ?? ''}
                            onChange={(event) =>
                              updateDraft(
                                match.id,
                                'half_time_home_score',
                                event.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-indigo-300 bg-white p-2.5 text-sm"
                          />
                        </label>

                        <label className="text-xs font-medium text-slate-700">
                          Away Half-time Score
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.half_time_away_score ?? ''}
                            onChange={(event) =>
                              updateDraft(
                                match.id,
                                'half_time_away_score',
                                event.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-indigo-300 bg-white p-2.5 text-sm"
                          />
                        </label>

                        <label className="text-xs font-medium text-slate-700">
                          First Team to Score
                          <select
                            value={draft.first_goal_outcome ?? ''}
                            onChange={(event) =>
                              updateDraft(
                                match.id,
                                'first_goal_outcome',
                                event.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-indigo-300 bg-white p-2.5 text-sm"
                          >
                            <option value="">Select first scorer</option>
                            <option value="home">{homeTeam?.name || 'Home team'}</option>
                            <option value="away">{awayTeam?.name || 'Away team'}</option>
                            <option value="no_goal">No goal (0-0)</option>
                          </select>
                        </label>
                      </div>

                      <p className="mt-3 text-xs text-indigo-800">
                        For a 0-0 match, enter 0-0 at half-time and full-time, then select No goal.
                        If these details are left blank, the related prediction markets cannot be fully scored yet.
                      </p>
                    </div>

                    {/* Knockout extra-time inputs appear when normal time is tied. */}
                    {isKnockout && showExtraTime && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                        <p className="mb-1 text-sm font-semibold text-orange-900">
                          Extra Time — 10 minutes per half
                        </p>

                        <p className="mb-3 text-xs text-orange-800">
                          Enter the additional goals scored during extra time.
                          These are added to the normal-time score.
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-medium text-slate-700">
                            Home Extra-time Goals
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.extra_time_home_score ?? ''}
                              onChange={(event) =>
                                updateDraft(
                                  match.id,
                                  'extra_time_home_score',
                                  event.target.value
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-orange-300 bg-white p-2.5 text-sm"
                            />
                          </label>

                          <label className="text-xs font-medium text-slate-700">
                            Away Extra-time Goals
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.extra_time_away_score ?? ''}
                              onChange={(event) =>
                                updateDraft(
                                  match.id,
                                  'extra_time_away_score',
                                  event.target.value
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-orange-300 bg-white p-2.5 text-sm"
                            />
                          </label>
                        </div>

                        {extraHome !== null && extraAway !== null && (
                          <p className="mt-3 text-sm font-semibold text-orange-900">
                            Aggregate score: {normalHome + extraHome} - {normalAway + extraAway}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Penalty inputs appear if extra time also ends level. */}
                    {isKnockout && showPenalties && (
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                        <p className="mb-1 text-sm font-semibold text-purple-900">
                          Penalty Shootout
                        </p>

                        <p className="mb-3 text-xs text-purple-800">
                          Enter the penalty shootout scores to determine who advances.
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-medium text-slate-700">
                            Home Penalty Score
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.home_penalty_score ?? ''}
                              onChange={(event) =>
                                updateDraft(
                                  match.id,
                                  'home_penalty_score',
                                  event.target.value
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-purple-300 bg-white p-2.5 text-sm"
                            />
                          </label>

                          <label className="text-xs font-medium text-slate-700">
                            Away Penalty Score
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={draft.away_penalty_score ?? ''}
                              onChange={(event) =>
                                updateDraft(
                                  match.id,
                                  'away_penalty_score',
                                  event.target.value
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-purple-300 bg-white p-2.5 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Save changes or delete the fixture. */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {isGeneratedFixture && (
                        <p className="text-xs text-slate-500">
                          Generated fixtures cannot be deleted.
                        </p>
                      )}

                      <div className="ml-auto flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteFixture(match)}
                          disabled={saving || isGeneratedFixture}
                          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateFixture(match)}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                        >
                          <Save size={15} />
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default FixturesManagement;
