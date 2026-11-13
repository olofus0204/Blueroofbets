
import { useEffect, useState } from 'react';
import { Trophy, RefreshCw, AlertCircle } from 'lucide-react';

import { supabase } from '../services/supabase';

// The four official tournament groups.
const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];

// Calculate each team's statistics using completed group-stage results.
function calculateStandings(teams, matches) {
  const table = teams.map((team) => ({
    ...team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }));

  const teamMap = new Map(table.map((team) => [team.id, team]));

  // Only completed group matches with both scores count.
  matches
    .filter(
      (match) =>
        (match.stage || 'group') === 'group' &&
        match.status === 'completed' &&
        match.home_score !== null &&
        match.home_score !== undefined &&
        match.away_score !== null &&
        match.away_score !== undefined
    )
    .forEach((match) => {
      const home = teamMap.get(match.home_team_id);
      const away = teamMap.get(match.away_team_id);

      // Ignore results involving teams not found in the active team list.
      if (!home || !away) return;

      const homeScore = Number(match.home_score);
      const awayScore = Number(match.away_score);

      home.played += 1;
      away.played += 1;

      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;

      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (homeScore < awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  // Calculate goal difference and rank teams by official tournament rules.
  table.forEach((team) => {
    team.goalDifference = team.goalsFor - team.goalsAgainst;
  });

  table.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.name.localeCompare(b.name)
  );

  return table;
}

function Standings() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch active teams and all group-stage fixtures from Supabase.
  async function fetchStandingsData() {
    setLoading(true);
    setError('');

    try {
      const [teamsResult, matchesResult] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, group_name')
          .eq('is_active', true),

        // Fetch upcoming and completed group fixtures.
        // Knockout matches are deliberately excluded.
        supabase
          .from('matches')
          .select(
            'home_team_id, away_team_id, home_score, away_score, status, stage'
          )
          .eq('stage', 'group'),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (matchesResult.error) throw matchesResult.error;

      setTeams(teamsResult.data || []);
      setMatches(matchesResult.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load group standings.');
    } finally {
      setLoading(false);
    }
  }

  // Load the standings when the page opens.
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchStandingsData();
    });
  }, []);

  // Calculate the tables from the latest database records.
  const standings = calculateStandings(teams, matches);

  // Count completed group fixtures with valid results.
  const completedGroupMatches = matches.filter(
    (match) =>
      match.status === 'completed' &&
      match.home_score !== null &&
      match.home_score !== undefined &&
      match.away_score !== null &&
      match.away_score !== undefined
  );

  // Qualification becomes official only when every group fixture is complete.
  const allGroupMatchesCompleted =
    matches.length > 0 &&
    completedGroupMatches.length === matches.length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Page heading and refresh control. */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <Trophy size={22} />
              <span className="text-sm font-bold uppercase tracking-wide">
                Blueroof Football Tournament
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900">
              Group Standings
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Follow the teams and their progress in the tournament.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchStandingsData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {/* Loading, error and standings display. */}
        {loading ? (
          <p className="py-16 text-center text-slate-500">
            Loading group standings...
          </p>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 p-5 text-red-700">
            <AlertCircle size={22} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Points system and official ranking rules. */}
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <p>
                <strong>Points system:</strong> Win = 3 points, Draw = 1 point,
                Loss = 0 points.
              </p>

              <p className="mt-2">
                <strong>Official tie-breakers:</strong> Points, goal difference,
                goals scored, then alphabetical order.
              </p>
            </div>

            {/* Group-stage completion and qualification information. */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Qualification Tracker
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Top two teams in each group advance to the quarter-finals.
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    allGroupMatchesCompleted
                      ? 'bg-green-100 text-green-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {allGroupMatchesCompleted
                    ? 'Group Stage Completed'
                    : 'Qualification Provisional'}
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Group fixtures completed: {completedGroupMatches.length} of {matches.length}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {allGroupMatchesCompleted
                  ? 'The top two teams in each group have officially qualified.'
                  : 'The current top two teams are provisional qualifiers. Final qualification will be confirmed after every group fixture is completed.'}
              </p>
            </div>

            {/* Four official group tables. */}
            <div className="grid gap-6 xl:grid-cols-2">
              {GROUPS.map((group) => {
                const groupTeams = standings.filter(
                  (team) => team.group_name === group
                );

                return (
                  <section
                    key={group}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 bg-slate-900 px-5 py-4">
                      <h2 className="text-lg font-bold text-white">
                        {group}
                      </h2>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-3">Pos</th>
                            <th className="px-3 py-3">Team</th>
                            <th className="px-2 py-3 text-center">MP</th>
                            <th className="px-2 py-3 text-center">W</th>
                            <th className="px-2 py-3 text-center">D</th>
                            <th className="px-2 py-3 text-center">L</th>
                            <th className="px-2 py-3 text-center">GF</th>
                            <th className="px-2 py-3 text-center">GA</th>
                            <th className="px-2 py-3 text-center">GD</th>
                            <th className="px-3 py-3 text-center">PTS</th>
                            <th className="px-3 py-3">Qualification</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white text-slate-900">
                          {groupTeams.map((team, index) => {
                            const isTopTwo = index < 2;

                            return (
                              <tr
                                key={team.id}
                                className="bg-white text-slate-900 hover:bg-slate-50"
                              >
                                <td className="px-3 py-3 font-semibold text-slate-700">
                                  {index + 1}
                                </td>

                                <td className="px-3 py-3 font-semibold text-slate-900">
                                  {team.name}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.played}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.won}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.drawn}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.lost}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.goalsFor}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.goalsAgainst}
                                </td>

                                <td className="px-2 py-3 text-center font-medium text-slate-900">
                                  {team.goalDifference > 0
                                    ? `+${team.goalDifference}`
                                    : team.goalDifference}
                                </td>

                                <td className="px-3 py-3 text-center font-extrabold text-blue-700">
                                  {team.points}
                                </td>

                                <td className="px-3 py-3">
                                  {isTopTwo ? (
                                    <span
                                      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${
                                        allGroupMatchesCompleted
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {allGroupMatchesCompleted
                                        ? 'Qualified'
                                        : 'Provisional'}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {groupTeams.length === 0 && (
                            <tr>
                              <td
                                colSpan="11"
                                className="px-4 py-8 text-center text-slate-500"
                              >
                                No teams registered in this group.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="mt-6 text-xs text-slate-500">
              Standings use completed group-stage results only. Knockout
              results do not affect group points or goal difference. Use
              Refresh to fetch the latest results.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default Standings;
