
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';

import { supabase } from '../services/supabase';

// Format dates using Nigeria's local timezone.
function formatDate(date) {
  if (!date) return 'Date not set';

  return new Date(date).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
}

// Convert a market selection into a readable label.
function formatAnswer(value, marketKey, match) {
  if (!value) return 'No answer';

  const labels = {
    home: match?.homeTeam || 'Home',
    away: match?.awayTeam || 'Away',
    draw: 'Draw',
    yes: 'Yes',
    no: 'No',
    no_goal: 'No goal',
    '0-4': '0–4 goals',
    '5-7': '5–7 goals',
    '8-10': '8–10 goals',
    '11+': '11+ goals',
    '1': '1 goal',
    '2': '2 goals',
    '3+': '3+ goals',
  };

  // Correct scores are stored as values such as 2-1.
  if (marketKey === 'correct_score') return value;

  return labels[value] || value;
}

function PredictionsManagement() {
  const [predictions, setPredictions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [matchMarkets, setMatchMarkets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [rescoringMatch, setRescoringMatch] = useState('');

  // Retrieve all information needed by the prediction dashboard.
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const [
        predictionsResult,
        answersResult,
        matchesResult,
        profilesResult,
        teamsResult,
        marketsResult,
        matchMarketsResult,
      ] = await Promise.all([
        supabase
          .from('predictions')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('prediction_answers')
          .select('*'),

        supabase
          .from('matches')
          .select('*')
          .order('kickoff_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id, display_name, role'),

        supabase
          .from('teams')
          .select('id, name'),

        supabase
          .from('prediction_market_types')
          .select('*')
          .order('sort_order', { ascending: true }),

        supabase
          .from('match_prediction_markets')
          .select('*'),
      ]);

      // Stop if any required database request fails.
      const results = [
        predictionsResult,
        answersResult,
        matchesResult,
        profilesResult,
        teamsResult,
        marketsResult,
        matchMarketsResult,
      ];

      const failedResult = results.find((result) => result.error);

      if (failedResult) throw failedResult.error;

      setPredictions(predictionsResult.data || []);
      setAnswers(answersResult.data || []);
      setMatches(matchesResult.data || []);
      setProfiles(profilesResult.data || []);
      setTeams(teamsResult.data || []);
      setMarkets(marketsResult.data || []);
      setMatchMarkets(matchMarketsResult.data || []);
    } catch (fetchError) {
      console.error('Prediction management error:', fetchError);

      setError(
        fetchError.message ||
          'Unable to load prediction information. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load dashboard data when this component opens.
  // Load dashboard data after the component has mounted.
useEffect(() => {
  Promise.resolve().then(() => {
    fetchData();
  });
}, [fetchData]);

  // Create lookup maps so related records can be displayed easily.
  const teamMap = useMemo(
    () => new Map(teams.map((team) => [team.id, team.name])),
    [teams]
  );

  const profileMap = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile.display_name,
        ])
      ),
    [profiles]
  );

  const marketMap = useMemo(
    () => new Map(markets.map((market) => [market.id, market])),
    [markets]
  );

  const matchMap = useMemo(() => {
    const result = new Map();

    matches.forEach((match) => {
      result.set(match.id, {
        ...match,
        homeTeam: teamMap.get(match.home_team_id) || 'Unknown team',
        awayTeam: teamMap.get(match.away_team_id) || 'Unknown team',
      });
    });

    return result;
  }, [matches, teamMap]);

  // Match-specific market points override the default market points.
  const matchMarketMap = useMemo(() => {
    const result = new Map();

    matchMarkets.forEach((item) => {
      result.set(`${item.match_id}_${item.market_id}`, item);
    });

    return result;
  }, [matchMarkets]);

  // Attach market answers and related information to each prediction.
  const predictionRows = useMemo(() => {
    return predictions.map((prediction) => {
      const match = matchMap.get(prediction.match_id);

      const predictionAnswers = answers
        .filter((answer) => answer.prediction_id === prediction.id)
        .map((answer) => {
          const market = marketMap.get(answer.market_id);

          const configuration = matchMarketMap.get(
            `${prediction.match_id}_${answer.market_id}`
          );

          return {
            ...answer,
            marketName: market?.name || 'Unknown market',
            marketKey: market?.market_key || '',
            availablePoints:
              configuration?.points ?? market?.default_points ?? 0,
            marketEnabled: configuration?.is_enabled ?? true,
          };
        })
        .sort((a, b) => {
          const marketA = marketMap.get(a.market_id);
          const marketB = marketMap.get(b.market_id);

          return (
            (marketA?.sort_order || 0) -
            (marketB?.sort_order || 0)
          );
        });

      const allScored =
        predictionAnswers.length > 0 &&
        predictionAnswers.every((answer) => answer.is_correct !== null);

      const anyScored = predictionAnswers.some(
        (answer) => answer.is_correct !== null
      );

      let scoringStatus = 'Awaiting result';

      if (match?.status === 'completed') {
        if (allScored) {
          scoringStatus = 'Scored';
        } else if (anyScored) {
          scoringStatus = 'Partially scored';
        } else {
          scoringStatus = 'Pending scoring';
        }
      }

      return {
        ...prediction,
        participantName:
          profileMap.get(prediction.user_id) || 'Unknown participant',
        match,
        predictionAnswers,
        scoringStatus,
      };
    });
  }, [
    predictions,
    answers,
    matchMap,
    marketMap,
    matchMarketMap,
    profileMap,
  ]);

  // Apply the participant search and fixture/status filters.
  const filteredPredictions = useMemo(() => {
    return predictionRows.filter((prediction) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        prediction.participantName.toLowerCase().includes(search) ||
        prediction.match?.homeTeam.toLowerCase().includes(search) ||
        prediction.match?.awayTeam.toLowerCase().includes(search);

      const matchesFixture =
        selectedMatch === 'all' ||
        prediction.match_id === selectedMatch;

      const matchesStatus =
        selectedStatus === 'all' ||
        prediction.match?.status === selectedStatus;

      return matchesSearch && matchesFixture && matchesStatus;
    });
  }, [
    predictionRows,
    searchTerm,
    selectedMatch,
    selectedStatus,
  ]);

  // Calculate dashboard totals from the actual database records.
  const totalPoints = answers.reduce(
    (total, answer) => total + (answer.points_awarded || 0),
    0
  );

  const correctAnswers = answers.filter(
    (answer) => answer.is_correct === true
  ).length;

  const pendingAnswers = answers.filter(
    (answer) => answer.is_correct === null
  ).length;

  // Recalculate the predictions for a completed match.
  async function handleRescore(matchId) {
    const match = matchMap.get(matchId);

    if (!match || match.status !== 'completed') {
      setError('Only completed matches can be rescored.');
      return;
    }

    const confirmed = window.confirm(
      `Rescore all predictions for ${match.homeTeam} vs ${match.awayTeam}?`
    );

    if (!confirmed) return;

    setRescoringMatch(matchId);
    setError('');
    setNotice('');

    try {
      const { error: rescoreError } = await supabase.rpc(
        'rescore_match_predictions',
        {
          p_match_id: matchId,
        }
      );

      if (rescoreError) throw rescoreError;

      setNotice(
        `Predictions for ${match.homeTeam} vs ${match.awayTeam} were successfully rescored.`
      );

      await fetchData();
    } catch (rescoreError) {
      console.error('Prediction rescore error:', rescoreError);

      setError(
        rescoreError.message ||
          'Unable to rescore this match. Please try again.'
      );
    } finally {
      setRescoringMatch('');
    }
  }

  // Show a loading message while the database information is retrieved.
  if (loading) {
    return (
      <div className="admin-section-card flex items-center justify-center gap-3 py-12">
        <RefreshCw size={20} className="animate-spin" />
        <span>Loading prediction management...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prediction management heading. */}
      <div className="admin-section-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Prediction Management
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Monitor participant submissions and prediction scores.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Display errors and successful operations. */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
        </div>
      )}

      {/* Prediction statistics. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-stat-card">
          <div className="stat-icon predictions-icon">
            <Target size={21} />
          </div>
          <span>Total Predictions</span>
          <h3>{predictions.length}</h3>
          <small>Submitted prediction slips</small>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon participants-icon">
            <Trophy size={21} />
          </div>
          <span>Total Points Awarded</span>
          <h3>{totalPoints}</h3>
          <small>Points earned across all markets</small>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon teams-icon">
            <CheckCircle2 size={21} />
          </div>
          <span>Correct Answers</span>
          <h3>{correctAnswers}</h3>
          <small>Correct market predictions</small>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon fixtures-icon">
            <Clock3 size={21} />
          </div>
          <span>Pending Answers</span>
          <h3>{pendingAnswers}</h3>
          <small>Waiting for scoring information</small>
        </div>
      </div>

      {/* Search and filter controls. */}
      <div className="admin-section-card space-y-4">
        <div className="flex items-center gap-2">
          <Filter size={19} />
          <h3 className="font-bold text-slate-900">
            Find Predictions
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search participant or team..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={selectedMatch}
            onChange={(event) => setSelectedMatch(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All fixtures</option>

            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {teamMap.get(match.home_team_id) || 'Unknown'} vs{' '}
                {teamMap.get(match.away_team_id) || 'Unknown'}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All match statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="live">Live</option>
            <option value="completed">Completed</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <p className="text-xs text-slate-500">
          Showing {filteredPredictions.length} of {predictions.length} prediction slips.
        </p>
      </div>

      {/* Prediction records. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            Submitted Predictions
          </h3>

          <span className="text-sm text-slate-500">
            {filteredPredictions.length} records
          </span>
        </div>

        {filteredPredictions.length === 0 ? (
          <div className="admin-section-card py-12 text-center">
            <Activity size={34} className="mx-auto text-slate-400" />

            <h3 className="mt-3 font-bold text-slate-800">
              No predictions found
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Submitted predictions will appear here.
            </p>
          </div>
        ) : (
          filteredPredictions.map((prediction) => {
            const match = prediction.match;

            return (
              <div
                key={prediction.id}
                className="admin-section-card space-y-4"
              >
                {/* Participant and fixture information. */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users size={17} className="text-slate-500" />

                      <strong className="text-slate-900">
                        {prediction.participantName}
                      </strong>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <CalendarDays size={15} />

                      <span>
                        {match
                          ? `${match.homeTeam} vs ${match.awayTeam}`
                          : 'Fixture unavailable'}
                      </span>

                      {match?.bracket_code && (
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                          {match.bracket_code}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500">
                      Submitted: {formatDate(prediction.created_at)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900">
                      {prediction.points_awarded || 0} pts
                    </p>

                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                        prediction.scoringStatus === 'Scored'
                          ? 'bg-green-100 text-green-700'
                          : prediction.scoringStatus === 'Partially scored'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {prediction.scoringStatus}
                    </span>
                  </div>
                </div>

                {/* Display all submitted market answers. */}
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="mb-3 text-sm font-bold text-slate-800">
                    Market Predictions ({prediction.predictionAnswers.length})
                  </h4>

                  {prediction.predictionAnswers.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No market answers have been submitted.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {prediction.predictionAnswers.map((answer) => (
                        <div
                          key={answer.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {answer.marketName}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              Answer:{' '}
                              {formatAnswer(
                                answer.selected_value,
                                answer.marketKey,
                                match
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700">
                              {answer.points_awarded} / {answer.availablePoints} pts
                            </span>

                            {answer.is_correct === true ? (
                              <CheckCircle2
                                size={19}
                                className="text-green-600"
                                title="Correct"
                              />
                            ) : answer.is_correct === false ? (
                              <XCircle
                                size={19}
                                className="text-red-500"
                                title="Incorrect"
                              />
                            ) : (
                              <Clock3
                                size={19}
                                className="text-yellow-600"
                                title="Pending"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rescore is available only for completed fixtures. */}
                {match?.status === 'completed' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <p className="text-xs text-slate-500">
                      Match result: {match.home_score} - {match.away_score}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleRescore(match.id)}
                      disabled={Boolean(rescoringMatch)}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw
                        size={15}
                        className={
                          rescoringMatch === match.id
                            ? 'animate-spin'
                            : ''
                        }
                      />

                      {rescoringMatch === match.id
                        ? 'Rescoring...'
                        : 'Rescore Match'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default PredictionsManagement;
