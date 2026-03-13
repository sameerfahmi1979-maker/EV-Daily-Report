import { useState, useEffect } from 'react';
import {
  Search, Shield, Clock, FileText, User,
  Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getAuditLog, AuditEntry } from '../lib/auditService';

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  upload:       { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: FileText },
  delete:       { bg: 'bg-red-50',     text: 'text-red-700',     icon: Shield },
  print:        { bg: 'bg-green-50',   text: 'text-green-700',   icon: FileText },
  rate_change:  { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: Shield },
  role_change:  { bg: 'bg-purple-50',  text: 'text-purple-700',  icon: User },
  login:        { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: User },
  logout:       { bg: 'bg-gray-50',    text: 'text-gray-700',    icon: User },
  handover:     { bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: Clock },
};

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  useEffect(() => {
    loadEntries();
  }, [page, filterAction, filterEntity]);

  async function loadEntries() {
    setLoading(true);
    try {
      const { data, count } = await getAuditLog({
        action: filterAction || undefined,
        entityType: filterEntity || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setEntries(data);
      setTotalCount(count);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEntries = entries.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      e.entity_type.toLowerCase().includes(q) ||
      (e.user_profiles?.full_name || '').toLowerCase().includes(q) ||
      (e.user_profiles?.email || '').toLowerCase().includes(q) ||
      JSON.stringify(e.details).toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function getActionStyle(action: string) {
    return ACTION_COLORS[action] || { bg: 'bg-gray-50', text: 'text-gray-700', icon: Shield };
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
        <p className="text-gray-600 mt-1">Track all system activity and user actions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search actions, users, details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            <option value="upload">Upload</option>
            <option value="delete">Delete</option>
            <option value="print">Print</option>
            <option value="rate_change">Rate Change</option>
            <option value="role_change">Role Change</option>
            <option value="login">Login</option>
            <option value="handover">Handover</option>
          </select>
          <select
            value={filterEntity}
            onChange={(e) => { setFilterEntity(e.target.value); setPage(0); }}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Entities</option>
            <option value="import_batch">Import Batch</option>
            <option value="shift">Shift</option>
            <option value="operator">Operator</option>
            <option value="user">User</option>
            <option value="rate_structure">Rate Structure</option>
            <option value="session">Session</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-blue-500" size={28} />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No audit entries found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEntries.map(entry => {
              const style = getActionStyle(entry.action);
              const IconComp = style.icon;
              return (
                <div key={entry.id} className="px-5 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${style.bg}`}>
                    <IconComp size={16} className={style.text} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-400">on</span>
                      <span className="text-xs font-medium text-gray-600">{entry.entity_type.replace(/_/g, ' ')}</span>
                    </div>

                    {/* Details */}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {Object.entries(entry.details).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ')}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        {entry.user_profiles?.full_name || entry.user_profiles?.email || 'System'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
