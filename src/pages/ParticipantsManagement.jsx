
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Trophy,
  Target,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  AlertCircle,
  Clock3,
} from 'lucide-react';

import { supabase } from '../services/supabase';

// Format dates using Nigerian local time.
function formatDate(value) {
  if (!value) return 'Date unavailable';

  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  });
}

// Display prediction selections in a readable format.
function formatAnswer(value) {
  const labels = {
    home: 'Home win',
    away: 'Away win',
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

  return labels[value] || value || 'Not available';
}

function ParticipantsManagement() {
  // Store the information retrieved from Supabase.
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedParticipant, setExpandedParticipant] = useState(null);

  // Retrieve participants and their prediction information.
  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch the participant directory and related tournament data.
      const [
        profilesResult,
        predictionsResult,
        answersResult,
        matchesResult,
        teamsResult,
        marketsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, role, created_at')
          .eq('role', 'participant')
          .order('created_at', { ascending: false }),

        supabase
          .from('predictions')
          .select('id, user_id, match_id, points_awarded, created_at'),

        supabase
          .from('prediction_answers')
          .select(
            'id, prediction_id, market_id, selected_value, is_correct, points_awarded'
          ),

        supabase
          .from('matches')
          .select(
            'id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score'
          ),

        supabase
          .from('teams')
          .select('id, name'),

        supabase
          .from('prediction_market_types')
          .select('id, name, market_key'),
      ]);

      // Stop if any database request fails.
      if (profilesResult.error) throw profilesResult.error;
      if (predictionsResult.error) throw predictionsResult.error;
      if (answersResult.error) throw answersResult.error;
      if (matchesResult.error) throw matchesResult.error;
      if (teamsResult.error) throw teamsResult.error;
      if (marketsResult.error) throw marketsResult.error;

      // Create lookup maps so we can connect related records.
      const teamMap = new Map(
        teamsResult.data.map((team) => [team.id, team.name])
      );

      const matchMap = new Map(
        matchesResult.data.map((match) => [
          match.id,
          {
            ...match,
            homeTeam: teamMap.get(match.home_team_id) || 'Unknown team',
            awayTeam: teamMap.get(match.away_team_id) || 'Unknown team',
          },
        ])
      );

      const marketMap = new Map(
        marketsResult.data.map((market) => [market.id, market.name])
      );

      const answerMap = new Map();

      // Group individual market answers under their prediction slips.
      answersResult.data.forEach((answer) => {
        const existing = answerMap.get(answer.prediction_id) || [];

        existing.push({
          ...answer,
          marketName: marketMap.get(answer.market_id) || 'Prediction market',
        });

        answerMap.set(answer.prediction_id, existing);
      });

      // Attach answers and fixture information to every prediction.
      const enrichedPredictions = predictionsResult.data.map((prediction) => ({
        ...prediction,
        match: matchMap.get(prediction.match_id) || null,
        answers: answerMap.get(prediction.id) || [],
      }));

      // Calculate each participant's performance statistics.
      const enrichedParticipants = profilesResult.data.map((profile) => {
        const userPredictions = enrichedPredictions.filter(
          (prediction) => prediction.user_id === profile.id
        );

        const userAnswers = userPredictions.flatMap(
          (prediction) => prediction.answers
        );

        const correctAnswers = userAnswers.filter(
          (answer) => answer.is_correct === true
        ).length;

        const scoredAnswers = userAnswers.filter(
          (answer) => answer.is_correct !== null
        ).length;

        const totalPoints = userPredictions.reduce(
          (total, prediction) => total + (prediction.points_awarded || 0),
          0
        );

        // Accuracy excludes answers that are still awaiting scoring.
        const accuracy = scoredAnswers > 0
          ? (correctAnswers / scoredAnswers) * 100
          : 0;

        return {
          ...profile,
          predictions: userPredictions,
          totalPredictions: userPredictions.length,
          totalAnswers: userAnswers.length,
          correctAnswers,
          scoredAnswers,
          totalPoints,
          accuracy,
        };
      });

      // Rank participants by points, correct answers, then accuracy.
      enrichedParticipants.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }

        if (b.correctAnswers !== a.correctAnswers) {
          return b.correctAnswers - a.correctAnswers;
        }

        return b.accuracy - a.accuracy;
      });

      // Assign leaderboard positions after sorting.
      const rankedParticipants = enrichedParticipants.map(
        (participant, index) => ({
          ...participant,
          rank: index + 1,
        })
      );

      setParticipants(rankedParticipants);
    } catch (fetchError) {
      console.error('Participants management error:', fetchError);
      setError(
        fetchError.message || 'Unable to load participants. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load participant data when the component is mounted.
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchParticipants();
    });
  }, [fetchParticipants]);

  // Filter participants using their display names.
  const filteredParticipants = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return participants;

    return participants.filter((participant) =>
      (participant.display_name || 'Participant')
        .toLowerCase()
        .includes(search)
    );
  }, [participants, searchTerm]);

  // Calculate the overall participant statistics.
  const summary = useMemo(() => {
    return {
      participants: participants.length,

      predictions: participants.reduce(
        (total, participant) => total + participant.totalPredictions,
        0
      ),

      points: participants.reduce(
        (total, participant) => total + participant.totalPoints,
        0
      ),

      correct: participants.reduce(
        (total, participant) => total + participant.correctAnswers,
        0
      ),
    };
  }, [participants]);

  // Expand or collapse an individual participant's history.
  const toggleParticipant = (participantId) => {
    setExpandedParticipant((current) =>
      current === participantId ? null : participantId
    );
  };

  return (
    <div className="space-y-6">
      {/* Participants management heading and refresh action. */}
      <div className="admin-section-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Participants Management
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              View registered participants and monitor their tournament performance.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchParticipants}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall participant statistics. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-stat-card">
          <div className="stat-icon participants-icon">
            <Users size={21} />
          </div>
          <span>Registered Participants</span>
          <h3>{loading ? '...' : summary.participants}</h3>
          <small>Active participant profiles</small>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon fixtures-icon">
            <CalendarDays size={21} />
          </div>
          <span>Prediction Slips</span>
          <h3>{loading ? '...' : summary.predictions}</h3>
          <small>Total submitted slips</small>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon predictions-icon">
            <Trophy size={21} />
          </div>
          <span>Total Points Earned</span>
          <h3>{loading ? '...' : summary.points}</h3>
          <small>Points across all participants</small>
        </div>

        <div className="admin-stat-card">
          <div className="stat-icon teams-icon">
            <Target size={21} />
          </div>
          <span>Correct Answers</span>
          <h3>{loading ? '...' : summary.correct}</h3>
          <small>Correct market predictions</small>
        </div>
      </div>

      {/* Search and participant directory. */}
      <div className="admin-section-card">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-slate-900">
            Participant Directory
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Search participants and inspect their prediction performance.
          </p>
        </div>

        <div className="relative mb-5">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search participant by name..."
            className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Loading, error and empty states. */}
        {loading && (
          <div className="py-12 text-center text-sm text-slate-500">
            <RefreshCw size={25} className="mx-auto mb-3 animate-spin" />
            Loading participant information...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle size={18} />
              Unable to load participants
            </div>
            <p className="mt-2">{error}</p>
          </div>
        )}

        {!loading && !error && filteredParticipants.length === 0 && (
          <div className="py-12 text-center">
            <Users size={32} className="mx-auto mb-3 text-slate-400" />

            <h4 className="font-semibold text-slate-800">
              {searchTerm ? 'No matching participants' : 'No participants yet'}
            </h4>

            <p className="mt-1 text-sm text-slate-500">
              {searchTerm
                ? 'Try another participant name.'
                : 'Registered participants will appear here.'}
            </p>
          </div>
        )}

        {/* Participant records. */}
        {!loading && !error && filteredParticipants.length > 0 && (
          <div className="space-y-3">
            {filteredParticipants.map((participant) => {
              const isExpanded = expandedParticipant === participant.id;

              return (
                <div
                  key={participant.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {/* Participant summary row. */}
                  <button
                    type="button"
                    onClick={() => toggleParticipant(participant.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-4 p-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                        {(participant.display_name || 'P')
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-slate-900">
                          {participant.display_name || 'Participant'}
                        </h4>

                        <p className="text-xs text-slate-500">
                          Joined {formatDate(participant.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-5">
                      <div className="text-center">
                        <span className="block text-xs text-slate-500">
                          Rank
                        </span>
                        <strong className="text-sm text-slate-900">
                          #{participant.rank}
                        </strong>
                      </div>

                      <div className="text-center">
                        <span className="block text-xs text-slate-500">
                          Slips
                        </span>
                        <strong className="text-sm text-slate-900">
                          {participant.totalPredictions}
                        </strong>
                      </div>

                      <div className="text-center">
                        <span className="block text-xs text-slate-500">
                          Points
                        </span>
                        <strong className="text-sm text-blue-700">
                          {participant.totalPoints}
                        </strong>
                      </div>

                      <div className="text-center">
                        <span className="block text-xs text-slate-500">
                          Accuracy
                        </span>
                        <strong className="text-sm text-slate-900">
                          {participant.accuracy.toFixed(1)}%
                        </strong>
                      </div>

                      {isExpanded ? (
                        <ChevronUp size={19} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={19} className="text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded participant statistics and prediction history. */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-white p-3">
                          <span className="text-xs text-slate-500">
                            Total answers
                          </span>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {participant.totalAnswers}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white p-3">
                          <span className="text-xs text-slate-500">
                            Correct answers
                          </span>
                          <p className="mt-1 text-lg font-bold text-green-700">
                            {participant.correctAnswers}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white p-3">
                          <span className="text-xs text-slate-500">
                            Scored answers
                          </span>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {participant.scoredAnswers}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white p-3">
                          <span className="text-xs text-slate-500">
                            Accuracy
                          </span>
                          <p className="mt-1 text-lg font-bold text-blue-700">
                            {participant.accuracy.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <h5 className="mb-3 font-bold text-slate-800">
                        Prediction History
                      </h5>

                      {participant.predictions.length === 0 ? (
                        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">
                          This participant has not submitted any predictions.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {participant.predictions.map((prediction) => (
                            <div
                              key={prediction.id}
                              className="rounded-lg border border-slate-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {prediction.match
                                      ? `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`
                                      : 'Fixture unavailable'}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {formatDate(prediction.created_at)}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <p className="font-bold text-blue-700">
                                    {prediction.points_awarded || 0} points
                                  </p>

                                  {prediction.match?.status === 'completed' ? (
                                    <span className="text-xs text-green-700">
                                      Match completed
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                      <Clock3 size={12} />
                                      Awaiting result
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Show the individual market selections. */}
                              {prediction.answers.length > 0 && (
                                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                                  {prediction.answers.map((answer) => (
                                    <div
                                      key={answer.id}
                                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                    >
                                      <div>
                                        <span className="text-slate-600">
                                          {answer.marketName}:
                                        </span>
                                        <strong className="ml-2 text-slate-900">
                                          {formatAnswer(answer.selected_value)}
                                        </strong>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {answer.is_correct === true && (
                                          <CheckCircle2
                                            size={16}
                                            className="text-green-600"
                                          />
                                        )}

                                        {answer.is_correct === false && (
                                          <AlertCircle
                                            size={16}
                                            className="text-red-500"
                                          />
                                        )}

                                        {answer.is_correct === null && (
                                          <Clock3
                                            size={16}
                                            className="text-amber-500"
                                          />
                                        )}

                                        <span className="font-semibold text-slate-700">
                                          {answer.points_awarded || 0} pts
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filteredParticipants.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">
            Showing {filteredParticipants.length} of {participants.length} participants.
          </p>
        )}
      </div>
    </div>
  );
}

export default ParticipantsManagement;
