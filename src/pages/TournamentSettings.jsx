import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Save, Settings2 } from 'lucide-react';
import { supabase } from '../services/supabase';

function TournamentSettings() {
  const [settings, setSettings] = useState({
    tournament_name: '',
    timezone: 'Africa/Lagos',
    prediction_lock_minutes: 0,
  });
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load the singleton tournament settings and all nine market defaults.
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [settingsResult, marketsResult] = await Promise.all([
        supabase
          .from('tournament_settings')
          .select('id, tournament_name, timezone, prediction_lock_minutes')
          .eq('id', true)
          .single(),
        supabase
          .from('prediction_market_types')
          .select('id, market_key, name, description, default_points, is_active, sort_order')
          .order('sort_order', { ascending: true }),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (marketsResult.error) throw marketsResult.error;

      setSettings({
        tournament_name: settingsResult.data.tournament_name ?? '',
        timezone: settingsResult.data.timezone ?? 'Africa/Lagos',
        prediction_lock_minutes:
          settingsResult.data.prediction_lock_minutes ?? 0,
      });
      setMarkets(marketsResult.data ?? []);
    } catch (loadError) {
      console.error('Tournament settings load error:', loadError);
      setError(loadError.message || 'Unable to load tournament settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Defer initial state updates so React effects remain side-effect safe.
  useEffect(() => {
    Promise.resolve().then(fetchSettings);
  }, [fetchSettings]);

  const updateSetting = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
    setSuccess('');
  };

  const updateMarket = (marketId, field, value) => {
    setMarkets((current) =>
      current.map((market) =>
        market.id === marketId ? { ...market, [field]: value } : market
      )
    );
    setSuccess('');
  };

  // Save settings and global market values through one admin-only RPC.
  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const tournamentName = settings.tournament_name.trim();
    const timezone = settings.timezone.trim();
    const lockMinutes = Number(settings.prediction_lock_minutes);

    if (!tournamentName || !timezone) {
      setError('Tournament name and timezone are required.');
      return;
    }

    if (!Number.isInteger(lockMinutes) || lockMinutes < 0 || lockMinutes > 10080) {
      setError('Prediction lock must be between 0 and 10,080 minutes.');
      return;
    }

    if (markets.length !== 9) {
      setError('The nine prediction markets could not be loaded. Refresh and try again.');
      return;
    }

    const invalidMarket = markets.find(
      (market) =>
        !Number.isInteger(Number(market.default_points)) ||
        Number(market.default_points) < 0 ||
        Number(market.default_points) > 100
    );

    if (invalidMarket) {
      setError(`${invalidMarket.name} must have a whole-number value from 0 to 100.`);
      return;
    }

    setSaving(true);

    try {
      const { error: saveError } = await supabase.rpc(
        'admin_update_tournament_configuration',
        {
          p_tournament_name: tournamentName,
          p_timezone: timezone,
          p_prediction_lock_minutes: lockMinutes,
          p_markets: markets.map((market) => ({
            id: market.id,
            market_key: market.market_key,
            default_points: Number(market.default_points),
            is_active: Boolean(market.is_active),
          })),
        }
      );

      if (saveError) throw saveError;

      setSuccess(
        'Tournament settings saved. Market points and activation now apply to all existing fixtures and future fixtures.'
      );
      await fetchSettings();
    } catch (saveError) {
      console.error('Tournament settings save error:', saveError);
      setError(
        saveError.message ||
          'Unable to save settings. Confirm that the database migration has been run.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-section-card flex items-center gap-3 p-6 text-slate-600">
        <LoaderCircle className="animate-spin" size={20} />
        Loading tournament settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        <section className="admin-section-card space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <Settings2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tournament Configuration</h3>
              <p className="text-sm text-slate-500">
                Set the tournament identity, local timezone and prediction deadline.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Tournament name
              </span>
              <input
                value={settings.tournament_name}
                onChange={(event) => updateSetting('tournament_name', event.target.value)}
                maxLength={120}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Timezone
              </span>
              <input
                value={settings.timezone}
                onChange={(event) => updateSetting('timezone', event.target.value)}
                placeholder="Africa/Lagos"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Use an IANA timezone, for example Africa/Lagos.
              </span>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Prediction lock before kick-off (minutes)
              </span>
              <input
                type="number"
                min="0"
                max="10080"
                step="1"
                value={settings.prediction_lock_minutes}
                onChange={(event) =>
                  updateSetting('prediction_lock_minutes', event.target.value)
                }
                required
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                0 means predictions close at kick-off. 15 means they close 15 minutes before kick-off.
              </span>
            </label>
          </div>
        </section>

        <section className="admin-section-card space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Prediction Markets</h3>
            <p className="text-sm text-slate-500">
              Configure the points awarded for each correct answer and choose which markets participants can use.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Market</th>
                  <th className="px-3 py-3">Points</th>
                  <th className="px-3 py-3">Available</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-4">
                      <div className="font-semibold text-slate-800">{market.name}</div>
                      <div className="text-xs text-slate-500">{market.description}</div>
                    </td>
                    <td className="px-3 py-4">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={market.default_points}
                        onChange={(event) =>
                          updateMarket(market.id, 'default_points', event.target.value)
                        }
                        aria-label={`${market.name} points`}
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                      />
                    </td>
                    <td className="px-3 py-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(market.is_active)}
                          onChange={(event) =>
                            updateMarket(market.id, 'is_active', event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-slate-700">
                          {market.is_active ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Saving applies these point values and enabled/disabled choices to all existing fixtures as well as future fixtures. Completed matches are not automatically rescored; use Predictions to explicitly rescore a completed match when required.
          </p>
        </section>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? 'Saving settings...' : 'Save Tournament Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TournamentSettings;
