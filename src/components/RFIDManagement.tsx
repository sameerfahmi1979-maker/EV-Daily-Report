import { useState, useEffect, useCallback } from 'react';
import { getRfidTags, upsertRfidTag, deleteRfidTag, type RfidTag } from '../lib/ocppService';
import { supabase } from '../lib/supabase';
import {
  CreditCard, Plus, Search, Filter, Trash2, Edit2, X,
  AlertTriangle, Loader2, CheckCircle, RefreshCw,
} from 'lucide-react';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<RfidTag['status'], string> = {
  Active:   'bg-green-100 text-green-700 border-green-200',
  Blocked:  'bg-red-100 text-red-700 border-red-200',
  Expired:  'bg-gray-100 text-gray-500 border-gray-200',
  Unbound:  'bg-yellow-100 text-yellow-700 border-yellow-200',
};

// ─── Card Form ────────────────────────────────────────────────────────────────

interface FormData {
  card_number: string;
  operator_id: string;
  account_name: string;
  card_reader: string;
  card_type: string;
  status: RfidTag['status'];
  expiration_date: string;
  max_count: number;
  balance: number;
  notes: string;
}

const EMPTY_FORM: FormData = {
  card_number: '',
  operator_id: '',
  account_name: '',
  card_reader: '',
  card_type: 'Standard',
  status: 'Unbound',
  expiration_date: '2099-01-01T00:00:00',
  max_count: 1,
  balance: 0,
  notes: '',
};

function RFIDForm({
  initial,
  onSave,
  onCancel,
  operators,
}: {
  initial?: RfidTag | null;
  onSave: (tag: RfidTag) => void;
  onCancel: () => void;
  operators: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<FormData>(() =>
    initial
      ? {
          card_number: initial.card_number,
          operator_id: initial.operator_id ?? '',
          account_name: initial.account_name ?? '',
          card_reader: initial.card_reader ?? '',
          card_type: initial.card_type,
          status: initial.status,
          expiration_date: initial.expiration_date.slice(0, 16),
          max_count: initial.max_count,
          balance: initial.balance,
          notes: initial.notes ?? '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tag = await upsertRfidTag({
        ...form,
        id: initial?.id,
        operator_id: form.operator_id || null,
        account_name: form.account_name || null,
        card_reader: form.card_reader || null,
        notes: form.notes || null,
        max_count: Number(form.max_count),
        balance: Number(form.balance),
      });
      onSave(tag);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {initial ? 'Edit RFID Card' : 'Add RFID Card'}
          </h2>
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Number *</label>
              <input
                required
                type="text"
                value={form.card_number}
                onChange={set('card_number')}
                placeholder="e.g. 202301000013310"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
              <select
                value={form.operator_id}
                onChange={set('operator_id')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— None —</option>
                {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
              <input
                type="text"
                value={form.account_name}
                onChange={set('account_name')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Type</label>
              <select
                value={form.card_type}
                onChange={set('card_type')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['Standard', 'Fleet', 'Employee', 'Guest', 'Admin'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={set('status')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Unbound">Unbound</option>
                <option value="Active">Active</option>
                <option value="Blocked">Blocked</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input
                type="datetime-local"
                value={form.expiration_date}
                onChange={set('expiration_date')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Sessions</label>
              <input
                type="number"
                min={1}
                value={form.max_count}
                onChange={set('max_count')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Balance (JOD)</label>
              <input
                type="number"
                min={0}
                step={0.001}
                value={form.balance}
                onChange={set('balance')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Reader</label>
              <input
                type="text"
                value={form.card_reader}
                onChange={set('card_reader')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={set('notes')}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {initial ? 'Save Changes' : 'Add Card'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RFIDManagement() {
  const [tags, setTags] = useState<RfidTag[]>([]);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RfidTag['status'] | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<RfidTag | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagData, opData] = await Promise.all([
        getRfidTags(),
        supabase.from('operators').select('id, name').order('name').then(r => r.data ?? []),
      ]);
      setTags(tagData);
      setOperators(opData as { id: string; name: string }[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = (tag: RfidTag) => {
    setTags(prev => {
      const idx = prev.findIndex(t => t.id === tag.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = tag; return next; }
      return [tag, ...prev];
    });
    setShowForm(false);
    setEditingTag(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this RFID card?')) return;
    setDeleting(id);
    try {
      await deleteRfidTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = tags.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.card_number.toLowerCase().includes(q) ||
      (t.account_name ?? '').toLowerCase().includes(q) ||
      (t.operator?.name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RFID Cards</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tags.length} cards · {tags.filter(t => t.status === 'Active').length} active</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setEditingTag(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} /> Add Card
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search card number, account, operator..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as RfidTag['status'] | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Card Number</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Operator</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Account</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Balance</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Expiry</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                <Loader2 size={24} className="animate-spin inline mb-2" /><br />Loading RFID cards...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                <CreditCard size={32} className="mx-auto mb-2 opacity-30" /><br />
                {tags.length === 0 ? 'No RFID cards added yet' : 'No cards match the filter'}
              </td></tr>
            ) : (
              filtered.map((tag, i) => (
                <tr key={tag.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">{tag.card_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{tag.operator?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{tag.account_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{tag.card_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLE[tag.status]}`}>
                      {tag.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${tag.balance === 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {tag.balance.toFixed(3)} JOD
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(tag.expiration_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingTag(tag); setShowForm(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
                        disabled={deleting === tag.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === tag.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showForm || editingTag) && (
        <RFIDForm
          initial={editingTag}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingTag(null); }}
          operators={operators}
        />
      )}
    </div>
  );
}
