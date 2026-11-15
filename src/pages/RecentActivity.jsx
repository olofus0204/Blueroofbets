import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import { supabase } from '../services/supabase';

const EVENT_PRESENTATION = {
  participant_registered: {
    label: 'New registration',
    icon: UserPlus,
    color: 'bg-blue-50 text-blue-700',
  },
  prediction_submitted: {
    label: 'Prediction submitted',
    icon: Activity,
    color: 'bg-purple-50 text-purple-700',
  },
  fixture_created: {
    label: 'Fixture created',
    icon: CalendarDays,
    color: 'bg-sky-50 text-sky-700',
  },
  fixture_updated: {
    label: 'Fixture updated',
    icon: CalendarDays,
    color: 'bg-amber-50 text-amber-700',
  },
  match_completed: {
    label: 'Match completed',
    icon: CheckCircle2,
    color: 'bg-green-50 text-green-700',
  },
};

function formatActivityDate(value) {
  if (!value) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function RecentActivity({ limit = 50 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Retrieve activity rows and resolve actor display names.
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: activityError } = await supabase
        .from('activity_logs')
        .select('id, event_type, description, created_at, actor_id')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (activityError) throw activityError;

      const actorIds = [
        ...new Set((data ?? []).map((item) => item.actor_id).filter(Boolean)),
      ];

      let profilesById = {};

      if (actorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', actorIds);

        if (profilesError) throw profilesError;

        profilesById = Object.fromEntries(
          (profiles ?? []).map((profile) => [profile.id, profile.display_name])
        );
      }

      setActivities(
        (data ?? []).map((item) => ({
          ...item,
          actorName: profilesById[item.actor_id] || 'System',
        }))
      );
    } catch (loadError) {
      console.error('Recent activity error:', loadError);
      setError(
        loadError.message ||
          'Unable to load activity. Run the activity-log database migration first.'
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Defer initial loading to avoid synchronous state updates inside effects.
  useEffect(() => {
    Promise.resolve().then(fetchActivities);
  }, [fetchActivities]);

  return (
    <section className="admin-section-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
          <p className="text-sm text-slate-500">
            Registrations, prediction submissions and fixture events.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchActivities}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <RefreshCw size={17} className="animate-spin" />
          Loading activity...
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && activities.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
          <Users size={28} className="mx-auto mb-2 text-slate-400" />
          <p className="font-semibold text-slate-700">No activity recorded yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            New registrations, predictions and fixture changes will appear here.
          </p>
        </div>
      )}

      {!loading && !error && activities.length > 0 && (
        <div className="divide-y divide-slate-100">
          {activities.map((item) => {
            const presentation =
              EVENT_PRESENTATION[item.event_type] || {
                label: 'Tournament activity',
                icon: Activity,
                color: 'bg-slate-100 text-slate-700',
              };
            const Icon = presentation.icon;

            return (
              <article key={item.id} className="flex gap-3 py-4 first:pt-1 last:pb-1">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${presentation.color}`}>
                  <Icon size={19} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {presentation.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      by {item.actorName}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {item.description}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={12} />
                    {formatActivityDate(item.created_at)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RecentActivity;
