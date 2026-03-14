import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, Filter, Search, Eye, ChevronDown,
  Building2, User, DollarSign, Zap, RefreshCw, Download,
  ArrowUpCircle, Printer, Banknote, CheckCircle2,
  Upload as UploadIcon, X, FileText, AlertTriangle, Trash2,
} from 'lucide-react';
import {
  getShifts, updateHandoverStatus, uploadDepositSlip, deleteShift,
  recalculateShiftTotals, recalculateAllShiftTotals,
  getShiftSessionsWithBilling,
  Shift, SHIFT_TYPES
} from '../lib/shiftService';
import { generateShiftSessionReportPDF, generateMoneyHandoverLetterPDF } from '../lib/pdfReportService';
import { getStations } from '../lib/stationService';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Station = Database['public']['Tables']['stations']['Row'];
type Operator = Database['public']['Tables']['operators']['Row'];

// Handover status config
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: Clock },
  printed:     { label: 'Printed',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       icon: Printer },
  deposited:   { label: 'Deposited',   color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200',   icon: Banknote },
  handed_over: { label: 'Handed Over', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
};

export default function ShiftManagement() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStation, setFilterStation] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftSessions, setShiftSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Handover modal
  const [showHandover, setShowHandover] = useState(false);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [depositRef, setDepositRef] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [handoverProcessing, setHandoverProcessing] = useState(false);

  // Delete confirmation
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);

  // Recalculation
  const [recalculating, setRecalculating] = useState(false);
  const [recalcSingleId, setRecalcSingleId] = useState<string | null>(null);

  // PDF generation
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsData, stationsData, operatorsResult] = await Promise.all([
        getShifts({
          station_id: filterStation || undefined,
          operator_id: filterOperator || undefined,
          handover_status: filterStatus || undefined,
          date_from: filterDateFrom || undefined,
          date_to: filterDateTo || undefined,
        }),
        getStations(),
        supabase.from('operators').select('*').order('name'),
      ]);

      setShifts(shiftsData);
      setStations(stationsData);
      setOperators(operatorsResult.data || []);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStation, filterOperator, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load sessions when shift selected
  async function loadShiftSessions(shiftId: string) {
    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('charging_sessions')
        .select(`
          *, 
          billing_calculations (
            id, total_amount, subtotal, fees
          )
        `)
        .eq('shift_id', shiftId)
        .order('start_ts', { ascending: true });
      if (error) throw error;
      setShiftSessions(data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setShiftSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }

  function handleViewShift(shift: Shift) {
    setSelectedShift(shift);
    loadShiftSessions(shift.id);
  }

  async function handleStatusUpdate(shiftId: string, newStatus: 'pending' | 'printed' | 'deposited' | 'handed_over') {
    try {
      await updateHandoverStatus(shiftId, newStatus);
      await loadData();
      if (selectedShift?.id === shiftId) {
        const updated = shifts.find(s => s.id === shiftId);
        if (updated) setSelectedShift({ ...updated, handover_status: newStatus });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    }
  }

  async function handleDepositUpload() {
    if (!selectedShift || !depositFile) return;
    setHandoverProcessing(true);
    try {
      const slipUrl = await uploadDepositSlip(selectedShift.id, depositFile);
      await updateHandoverStatus(selectedShift.id, 'deposited', {
        bank_deposit_slip: slipUrl,
        bank_deposit_date: depositDate || new Date().toISOString().split('T')[0],
        bank_deposit_reference: depositRef,
      });
      setShowHandover(false);
      setDepositFile(null);
      setDepositRef('');
      setDepositDate('');
      await loadData();
      setSelectedShift(prev => prev ? { ...prev, handover_status: 'deposited' } : null);
    } catch (err) {
      console.error('Failed to upload deposit:', err);
      alert('Failed to upload deposit slip');
    } finally {
      setHandoverProcessing(false);
    }
  }

  async function handleDeleteShift(shiftId: string) {
    try {
      await deleteShift(shiftId);
      setDeletingShiftId(null);
      if (selectedShift?.id === shiftId) setSelectedShift(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete shift:', err);
      alert('Failed to delete shift');
    }
  }

  async function handleRecalculateAll() {
    setRecalculating(true);
    try {
      const result = await recalculateAllShiftTotals();
      alert(`✅ Recalculated ${result.shifts_updated} shifts — Total: ${result.total_kwh.toFixed(2)} kWh, ${result.total_amount_jod.toFixed(3)} JOD`);
      await loadData();
    } catch (err) {
      console.error('Failed to recalculate:', err);
      alert('Failed to recalculate shift totals');
    } finally {
      setRecalculating(false);
    }
  }

  async function handleRecalculateSingle(shiftId: string) {
    setRecalcSingleId(shiftId);
    try {
      const result = await recalculateShiftTotals(shiftId);
      alert(`✅ Recalculated: ${result.session_count} sessions — ${result.total_kwh} kWh, ${result.total_amount_jod} JOD`);
      await loadData();
      if (selectedShift?.id === shiftId) {
        const updated = shifts.find(s => s.id === shiftId);
        if (updated) setSelectedShift({ ...updated, total_kwh: result.total_kwh, total_amount_jod: result.total_amount_jod });
      }
    } catch (err) {
      console.error('Failed to recalculate:', err);
      alert('Failed to recalculate shift totals');
    } finally {
      setRecalcSingleId(null);
    }
  }

  async function handlePrintSessionReport(shift: Shift) {
    setGeneratingPdf('session');
    try {
      const sessions = await getShiftSessionsWithBilling(shift.id);
      await generateShiftSessionReportPDF(shift as any, sessions);
    } catch (err) {
      console.error('Failed to generate session report:', err);
      alert('Failed to generate PDF report');
    } finally {
      setGeneratingPdf(null);
    }
  }

  async function handlePrintHandoverLetter(shift: Shift) {
    setGeneratingPdf('handover');
    try {
      const sessions = await getShiftSessionsWithBilling(shift.id);
      await generateMoneyHandoverLetterPDF(shift as any, sessions.length);
    } catch (err) {
      console.error('Failed to generate handover letter:', err);
      alert('Failed to generate PDF');
    } finally {
      setGeneratingPdf(null);
    }
  }

  const filteredShifts = shifts.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const stationName = (s.stations as any)?.name?.toLowerCase() || '';
    const operatorName = (s.operators as any)?.name?.toLowerCase() || '';
    return stationName.includes(q) || operatorName.includes(q) || s.shift_date.includes(q);
  });

  // Stats
  const totalRevenue = shifts.reduce((sum, s) => sum + Number(s.total_amount_jod || 0), 0);
  const totalKwh = shifts.reduce((sum, s) => sum + Number(s.total_kwh || 0), 0);
  const pendingCount = shifts.filter(s => s.handover_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shift Management</h2>
          <p className="text-gray-600 mt-1">Track shifts, money handover, and bank deposits</p>
        </div>
        <button
          onClick={handleRecalculateAll}
          disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={16} className={recalculating ? 'animate-spin' : ''} />
          {recalculating ? 'Recalculating...' : '⚡ Recalculate All Totals'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
              <p className="text-xs text-gray-500">Total Shifts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalRevenue.toFixed(3)}</p>
              <p className="text-xs text-gray-500">Total Revenue (JOD)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs text-gray-500">Pending Handover</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalKwh.toFixed(1)}</p>
              <p className="text-xs text-gray-500">Total kWh</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by station, operator, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
              showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter size={16} />
            Filters
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-3">
            <select value={filterStation} onChange={(e) => setFilterStation(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <option value="">All Stations</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <option value="">All Operators</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="printed">Printed</option>
              <option value="deposited">Deposited</option>
              <option value="handed_over">Handed Over</option>
            </select>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="From" />
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" placeholder="To" />
          </div>
        )}
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Station</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Operator</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Shift</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">kWh</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Amount (JOD)</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading shifts...</td></tr>
              ) : filteredShifts.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No shifts found. Import charging sessions to create shifts.</td></tr>
              ) : (
                filteredShifts.map((shift) => {
                  const status = STATUS_CONFIG[shift.handover_status] || STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <tr key={shift.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{shift.shift_date}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400" />
                          <span className="text-gray-700">{(shift.stations as any)?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="text-gray-700">{(shift.operators as any)?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                          {SHIFT_TYPES[shift.shift_type]?.label || shift.shift_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {Number(shift.total_kwh || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                        {Number(shift.total_amount_jod || 0).toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${status.bg} ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewShift(shift)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRecalculateSingle(shift.id)}
                            disabled={recalcSingleId === shift.id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Recalculate Totals"
                          >
                            <RefreshCw size={16} className={recalcSingleId === shift.id ? 'animate-spin' : ''} />
                          </button>
                          <button
                            onClick={() => setDeletingShiftId(shift.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Shift"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== SHIFT DETAIL MODAL ==================== */}
      {selectedShift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 overflow-y-auto" onClick={() => setSelectedShift(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-10" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Shift Details</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedShift.shift_date} — {SHIFT_TYPES[selectedShift.shift_type]?.label}</p>
              </div>
              <button onClick={() => setSelectedShift(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Shift Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Station</p>
                  <p className="text-sm font-medium text-gray-900">{(selectedShift.stations as any)?.name || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Operator</p>
                  <p className="text-sm font-medium text-gray-900">{(selectedShift.operators as any)?.name || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total kWh</p>
                  <p className="text-sm font-medium text-blue-700">{Number(selectedShift.total_kwh || 0).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                  <p className="text-sm font-bold text-emerald-700">{Number(selectedShift.total_amount_jod || 0).toFixed(3)} JOD</p>
                </div>
              </div>

              {/* Handover Status Flow */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Handover Progress</h4>
                <div className="flex items-center gap-2">
                  {['pending', 'printed', 'deposited', 'handed_over'].map((status, idx) => {
                    const config = STATUS_CONFIG[status];
                    const StatusIcon = config.icon;
                    const isCurrent = selectedShift.handover_status === status;
                    const isPast = ['pending', 'printed', 'deposited', 'handed_over'].indexOf(selectedShift.handover_status) > idx;

                    return (
                      <React.Fragment key={status}>
                        {idx > 0 && <div className={`flex-1 h-0.5 ${isPast ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                        <button
                          onClick={() => {
                            if (status === 'deposited') {
                              setShowHandover(true);
                            } else {
                              handleStatusUpdate(selectedShift.id, status as any);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                            isCurrent
                              ? `${config.bg} ${config.color} ring-2 ring-offset-1 ring-blue-300`
                              : isPast
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                          }`}
                          title={`Set status to: ${config.label}`}
                        >
                          <StatusIcon size={14} />
                          {config.label}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Bank Deposit Info */}
              {(selectedShift.bank_deposit_slip || selectedShift.bank_deposit_reference) && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    <Banknote size={16} />
                    Bank Deposit Information
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-purple-600">Reference</p>
                      <p className="font-medium text-purple-900">{selectedShift.bank_deposit_reference || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600">Date</p>
                      <p className="font-medium text-purple-900">{selectedShift.bank_deposit_date || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600">Slip</p>
                      {selectedShift.bank_deposit_slip ? (
                        <a href={selectedShift.bank_deposit_slip} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">
                          View Deposit Slip
                        </a>
                      ) : <p className="text-purple-900">—</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Sessions Table */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText size={16} />
                  Sessions in this Shift ({shiftSessions.length})
                </h4>
                {loadingSessions ? (
                  <p className="text-gray-500 text-sm py-4 text-center">Loading sessions...</p>
                ) : shiftSessions.length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">No sessions linked to this shift yet.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600">#</th>
                          <th className="px-3 py-2 text-left text-gray-600">Transaction</th>
                          <th className="px-3 py-2 text-left text-gray-600">Card</th>
                          <th className="px-3 py-2 text-left text-gray-600">Start</th>
                          <th className="px-3 py-2 text-left text-gray-600">End</th>
                          <th className="px-3 py-2 text-right text-gray-600">kWh</th>
                          <th className="px-3 py-2 text-right text-gray-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftSessions.map((session: any, idx: number) => {
                          const billingAmount = session.billing_calculations?.[0]?.total_amount || 0;
                          return (
                          <tr key={session.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono">{session.transaction_id}</td>
                            <td className="px-3 py-2">{session.card_number}</td>
                            <td className="px-3 py-2">{session.start_ts?.replace('T', ' ').substring(0, 19)}</td>
                            <td className="px-3 py-2">{session.end_ts?.replace('T', ' ').substring(0, 19)}</td>
                            <td className="px-3 py-2 text-right font-mono">{Number(session.energy_consumed_kwh || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono font-medium">{Number(billingAmount || 0).toFixed(3)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Print / Download Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handlePrintSessionReport(selectedShift)}
                  disabled={generatingPdf !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <FileText size={16} />
                  {generatingPdf === 'session' ? 'Generating...' : 'Print Session Report'}
                </button>
                <button
                  onClick={() => handlePrintHandoverLetter(selectedShift)}
                  disabled={generatingPdf !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Download size={16} />
                  {generatingPdf === 'handover' ? 'Generating...' : 'Print Handover Letter'}
                </button>
              </div>

              {/* Notes */}
              {selectedShift.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-yellow-800 mb-1">Notes</p>
                  <p className="text-sm text-yellow-900">{selectedShift.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== DEPOSIT UPLOAD MODAL ==================== */}
      {showHandover && selectedShift && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowHandover(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Banknote size={20} className="text-purple-600" />
                Upload Bank Deposit
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Amount: <span className="font-bold text-emerald-700">{Number(selectedShift.total_amount_jod || 0).toFixed(3)} JOD</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Date</label>
                <input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Reference Number</label>
                <input
                  type="text"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  placeholder="e.g. DEP-2025-001234"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Slip (Photo/PDF)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {depositFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText size={18} className="text-purple-600" />
                      <span className="text-sm text-gray-700">{depositFile.name}</span>
                      <button onClick={() => setDepositFile(null)} className="text-red-500 hover:text-red-700">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <UploadIcon size={24} className="mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">Choose file</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => e.target.files?.[0] && setDepositFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowHandover(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDepositUpload}
                  disabled={!depositFile || handoverProcessing}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {handoverProcessing ? (
                    <span>Uploading...</span>
                  ) : (
                    <>
                      <ArrowUpCircle size={16} />
                      <span>Save Deposit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION ==================== */}
      {deletingShiftId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setDeletingShiftId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Shift?</h3>
                <p className="text-sm text-gray-500">Sessions will be unlinked but not deleted.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingShiftId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteShift(deletingShiftId)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
