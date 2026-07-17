import { useState, useEffect } from 'react';
import { getChargers, getConnectors, sendRemoteCommand, type OcppCharger, type OcppConnector } from '../lib/ocppService';
import {
  Zap, Plus, Loader2, AlertTriangle, CheckCircle,
  Settings, Clock, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchedulePeriod {
  startPeriod: number; // seconds from schedule start
  limit: number;       // W or A
}

interface ProfileForm {
  chargerId: string;
  connectorId: string; // '0' = all connectors
  purpose: 'ChargePointMaxProfile' | 'TxDefaultProfile';
  kind: 'Absolute' | 'Recurring';
  recurrencyKind: 'Daily' | 'Weekly';
  rateUnit: 'W' | 'A';
  periods: SchedulePeriod[];
  validFrom: string;
  validTo: string;
}

// ─── Period row ───────────────────────────────────────────────────────────────

function PeriodRow({ period, index, rateUnit, onChange, onRemove }: {
  period: SchedulePeriod;
  index: number;
  rateUnit: string;
  onChange: (idx: number, field: keyof SchedulePeriod, value: number) => void;
  onRemove: (idx: number) => void;
}) {
  const h = Math.floor(period.startPeriod / 3600);
  const m = Math.floor((period.startPeriod % 3600) / 60);

  const handleTime = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [hh, mm] = e.target.value.split(':').map(Number);
    onChange(index, 'startPeriod', (hh || 0) * 3600 + (mm || 0) * 60);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 w-6">{index + 1}.</span>
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">Start Time</label>
        <input
          type="time"
          value={`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
          onChange={handleTime}
          className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-0.5">Limit ({rateUnit})</label>
        <input
          type="number"
          min={0}
          value={period.limit}
          onChange={e => onChange(index, 'limit', Number(e.target.value))}
          className="w-24 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button onClick={() => onRemove(index)} className="ml-auto p-1 text-gray-300 hover:text-red-500 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Profile form ─────────────────────────────────────────────────────────────

function ProfileModal({ chargers, onClose, onSent }: {
  chargers: OcppCharger[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [connectors, setConnectors] = useState<OcppConnector[]>([]);
  const [form, setForm] = useState<ProfileForm>({
    chargerId: chargers[0]?.id ?? '',
    connectorId: '0',
    purpose: 'ChargePointMaxProfile',
    kind: 'Recurring',
    recurrencyKind: 'Daily',
    rateUnit: 'W',
    periods: [{ startPeriod: 0, limit: 22000 }],
    validFrom: '',
    validTo: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.chargerId) return;
    getConnectors(form.chargerId).then(setConnectors);
  }, [form.chargerId]);

  const set = (key: keyof ProfileForm, value: any) => setForm(f => ({ ...f, [key]: value }));

  const changePeriod = (idx: number, field: keyof SchedulePeriod, value: number) => {
    setForm(f => {
      const periods = [...f.periods];
      periods[idx] = { ...periods[idx], [field]: value };
      return { ...f, periods };
    });
  };

  const removePeriod = (idx: number) => setForm(f => ({ ...f, periods: f.periods.filter((_, i) => i !== idx) }));
  const addPeriod = () => setForm(f => ({ ...f, periods: [...f.periods, { startPeriod: 0, limit: 22000 }] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const profileId = Math.floor(Math.random() * 1000000);
      const profile: Record<string, unknown> = {
        chargingProfileId: profileId,
        stackLevel: 0,
        chargingProfilePurpose: form.purpose,
        chargingProfileKind: form.kind,
        chargingSchedule: {
          chargingRateUnit: form.rateUnit,
          chargingSchedulePeriod: form.periods.map(p => ({
            startPeriod: p.startPeriod,
            limit: p.limit,
          })),
        },
      };
      if (form.kind === 'Recurring') profile.recurrencyKind = form.recurrencyKind;
      if (form.validFrom) profile.validFrom = new Date(form.validFrom).toISOString();
      if (form.validTo) profile.validTo = new Date(form.validTo).toISOString();

      await sendRemoteCommand(
        form.chargerId,
        'SetChargingProfile',
        { connectorId: Number(form.connectorId), csChargingProfiles: profile },
        Number(form.connectorId)
      );
      onSent();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Set Charging Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Charge Point *</label>
              <select value={form.chargerId} onChange={e => set('chargerId', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                {chargers.map(c => <option key={c.id} value={c.id}>{c.charge_point_id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connector</label>
              <select value={form.connectorId} onChange={e => set('connectorId', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="0">All Connectors (0)</option>
                {connectors.map(c => <option key={c.id} value={c.connector_id}>#{c.connector_id} — {c.connector_type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Purpose</label>
              <select value={form.purpose} onChange={e => set('purpose', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="ChargePointMaxProfile">ChargePoint Max (station-wide cap)</option>
                <option value="TxDefaultProfile">TxDefault (per transaction default)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Unit</label>
              <select value={form.rateUnit} onChange={e => set('rateUnit', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="W">Watts (W)</option>
                <option value="A">Amps (A)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Kind</label>
              <select value={form.kind} onChange={e => set('kind', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="Recurring">Recurring (daily/weekly)</option>
                <option value="Absolute">Absolute (one-time)</option>
              </select>
            </div>
            {form.kind === 'Recurring' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recurrency</label>
                <select value={form.recurrencyKind} onChange={e => set('recurrencyKind', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
              <input type="datetime-local" value={form.validFrom} onChange={e => set('validFrom', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid To</label>
              <input type="datetime-local" value={form.validTo} onChange={e => set('validTo', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Schedule periods */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock size={14} /> Schedule Periods
              </label>
              <button type="button" onClick={addPeriod}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Plus size={12} /> Add Period
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg px-4 py-1">
              {form.periods.map((p, i) => (
                <PeriodRow key={i} period={p} index={i} rateUnit={form.rateUnit}
                  onChange={changePeriod} onRemove={removePeriod} />
              ))}
              {form.periods.length === 0 && (
                <p className="text-xs text-gray-400 italic py-3 text-center">No periods — add at least one</p>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Period 1 should always start at 00:00. Times are offsets from the start of the schedule.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={sending || form.periods.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Send to Charger
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChargingProfiles() {
  const [chargers, setChargers] = useState<OcppCharger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getChargers().then(c => { setChargers(c); setLoading(false); });
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charging Profiles</h1>
          <p className="text-sm text-gray-500 mt-0.5">Smart charging schedules and power limits (OCPP SetChargingProfile)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={loading || chargers.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Plus size={15} /> New Profile
        </button>
      </div>

      {lastSent && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle size={15} /> Profile sent to charger and queued for delivery.
        </div>
      )}

      {/* Informational card about the feature */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: Settings,
            title: 'ChargePoint Max Profile',
            desc: 'Sets a station-wide power cap across all connectors. Useful for grid demand management.',
          },
          {
            icon: Clock,
            title: 'TxDefault Profile',
            desc: 'Default profile applied to every new transaction. Define off-peak and on-peak power limits.',
          },
          {
            icon: Zap,
            title: 'Recurring Schedules',
            desc: 'Daily or weekly repeating schedules. Define different power limits per time window.',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="p-5 rounded-xl border border-gray-200 bg-white space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Icon size={16} className="text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">{title}</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-700">
        <strong>Note:</strong> Profiles are sent as OCPP <code className="font-mono text-xs bg-blue-100 px-1 rounded">SetChargingProfile</code> commands
        to the charger via the command queue. Use the Charge Points page to monitor command delivery status.
      </div>

      {showModal && (
        <ProfileModal
          chargers={chargers}
          onClose={() => setShowModal(false)}
          onSent={() => { setShowModal(false); setLastSent(new Date().toLocaleString()); }}
        />
      )}
    </div>
  );
}
