import React, { useState, useEffect } from 'react';
import { Calculator, Eye, RefreshCw, AlertCircle, CheckCircle, Loader2, Filter, FileText, CheckSquare, Square, CreditCard as Edit, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getSessionsWithBillingFiltered,
  calculateAndSaveSessionBilling,
  recalculateSession,
  getBillingCalculation,
  formatJOD,
  BillingBreakdown,
  recalculateMultipleSessions,
  BulkRecalculationResult,
  SessionFilters,
  countPendingSessions,
  calculateAllPendingSessions,
  CalculationProgress,
  validatePendingSessions,
  ValidationResult
} from '../lib/billingService';
import { getStations } from '../lib/stationService';
import BillingBreakdownViewer from './BillingBreakdownViewer';
import TransactionEditModal from './TransactionEditModal';
import BulkRecalculateConfirmDialog from './BulkRecalculateConfirmDialog';
import CalculateAllPendingDialog from './CalculateAllPendingDialog';
import CalculationProgressDialog from './CalculationProgressDialog';
import DateRangeSelector from './DateRangeSelector';
import { differenceInMinutes, parseISO, format as formatDate, startOfMonth, endOfDay } from 'date-fns';
import { getInvoiceData, generateInvoicePDF } from '../lib/reportService';
import { Database } from '../lib/database.types';

type Station = Database['public']['Tables']['stations']['Row'];

interface Session {
  id: string;
  transaction_id: string;
  charge_id: string;
  card_number: string;
  start_ts: string;
  end_ts: string;
  duration_minutes: number;
  energy_consumed_kwh: string;
  max_demand_kw: string | null;
  station_id: string | null;
  stations?: {
    id: string;
    name: string;
    station_code: string | null;
  };
  billing_calculations?: Array<{
    id: string;
    total_amount: string;
    currency: string;
    calculation_date: string;
  }>;
}

interface SessionListProps {
  initialBillingStatus?: 'all' | 'calculated' | 'pending';
}

export default function SessionList({ initialBillingStatus }: SessionListProps = {}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [filters, setFilters] = useState<SessionFilters>({
    stationId: '',
    billingStatus: initialBillingStatus || 'all',
    startDate: initialBillingStatus === 'pending' ? '' : formatDate(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: initialBillingStatus === 'pending' ? '' : formatDate(endOfDay(new Date()), 'yyyy-MM-dd'),
    searchTerm: '',
    page: 1,
    pageSize: 50
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [viewingBreakdown, setViewingBreakdown] = useState<{
    breakdown: BillingBreakdown;
    session: Session;
  } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkRecalculating, setBulkRecalculating] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkRecalculationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCalculateAllDialog, setShowCalculateAllDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState<CalculationProgress>({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  });
  const [isCalculationComplete, setIsCalculationComplete] = useState(false);

  useEffect(() => {
    loadStations();
  }, []);

  useEffect(() => {
    loadSessions();
    loadPendingCount();
  }, [filters]);

  async function loadStations() {
    try {
      const data = await getStations();
      setStations(data);
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  async function loadSessions() {
    try {
      setLoading(true);
      setError(null);
      const result = await getSessionsWithBillingFiltered(filters);
      setSessions(result.sessions as Session[]);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingCount() {
    try {
      const count = await countPendingSessions(filters);
      setPendingCount(count);
    } catch (err) {
      console.error('Failed to load pending count:', err);
    }
  }

  function handleFilterChange(key: keyof SessionFilters, value: any) {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1
    }));
  }

  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      handleFilterChange('page', newPage);
    }
  }

  function handleClearFilters() {
    setFilters({
      stationId: '',
      billingStatus: 'all',
      startDate: formatDate(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: formatDate(endOfDay(new Date()), 'yyyy-MM-dd'),
      searchTerm: '',
      page: 1,
      pageSize: 50
    });
  }

  async function handleCalculate(sessionId: string) {
    try {
      setCalculating(sessionId);
      setError(null);
      await calculateAndSaveSessionBilling(sessionId);
      await loadSessions();
    } catch (err) {
      console.error('Failed to calculate billing:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate billing');
    } finally {
      setCalculating(null);
    }
  }

  async function handleRecalculate(sessionId: string) {
    try {
      setCalculating(sessionId);
      setError(null);
      await recalculateSession(sessionId);
      await loadSessions();
    } catch (err) {
      console.error('Failed to recalculate billing:', err);
      setError(err instanceof Error ? err.message : 'Failed to recalculate billing');
    } finally {
      setCalculating(null);
    }
  }

  async function handleViewBreakdown(session: Session) {
    try {
      const billingCalc = await getBillingCalculation(session.id);
      if (billingCalc && billingCalc.breakdown) {
        setViewingBreakdown({
          breakdown: billingCalc.breakdown as any,
          session
        });
      }
    } catch (err) {
      console.error('Failed to load breakdown:', err);
      setError(err instanceof Error ? err.message : 'Failed to load breakdown');
    }
  }

  async function handleGenerateInvoice(sessionId: string) {
    try {
      const invoiceData = await getInvoiceData(sessionId);
      if (invoiceData) {
        generateInvoicePDF(invoiceData);
      } else {
        setError('No billing data found for this session. Please calculate billing first.');
      }
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
    }
  }

  function handleSelectSession(sessionId: string) {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  }

  function handleSelectAll() {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    }
  }

  function handleSelectCalculated() {
    const calculatedSessionIds = sessions
      .filter(s => s.billing_calculations && s.billing_calculations.length > 0)
      .map(s => s.id);
    setSelectedSessions(new Set(calculatedSessionIds));
  }

  function handleSelectPending() {
    const pendingSessionIds = sessions
      .filter(s => !s.billing_calculations || s.billing_calculations.length === 0)
      .map(s => s.id);
    setSelectedSessions(new Set(pendingSessionIds));
  }

  function handleBulkRecalculate() {
    if (selectedSessions.size === 0) {
      setError('Please select at least one session to recalculate');
      return;
    }

    setShowConfirmDialog(true);
  }

  async function confirmBulkRecalculate() {
    setShowConfirmDialog(false);

    try {
      setBulkRecalculating(true);
      setError(null);
      setBulkResult(null);

      const result = await recalculateMultipleSessions(Array.from(selectedSessions));
      setBulkResult(result);

      await loadSessions();
      setSelectedSessions(new Set());
    } catch (err) {
      console.error('Failed to bulk recalculate:', err);
      setError(err instanceof Error ? err.message : 'Failed to bulk recalculate');
    } finally {
      setBulkRecalculating(false);
    }
  }

  function getSelectedSessionCounts() {
    const selectedSessionsList = sessions.filter(s => selectedSessions.has(s.id));
    const pendingCount = selectedSessionsList.filter(
      s => !s.billing_calculations || s.billing_calculations.length === 0
    ).length;
    const calculatedCount = selectedSessionsList.filter(
      s => s.billing_calculations && s.billing_calculations.length > 0
    ).length;
    return { pendingCount, calculatedCount };
  }

  async function handleCalculateAllPending() {
    if (pendingCount === 0) {
      setError('No pending transactions to calculate');
      return;
    }

    setValidating(true);
    setShowCalculateAllDialog(true);

    try {
      // Remove date filters when calculating ALL pending sessions
      // Only keep station and search filters if explicitly set
      const allPendingFilters: SessionFilters = {
        stationId: filters.stationId,
        searchTerm: filters.searchTerm,
        billingStatus: 'pending',
        startDate: '',
        endDate: '',
        page: 1,
        pageSize: 50
      };
      const validation = await validatePendingSessions(allPendingFilters);
      setValidationResult(validation);
    } catch (err) {
      setError('Failed to validate sessions');
      console.error('Validation error:', err);
      setShowCalculateAllDialog(false);
    } finally {
      setValidating(false);
    }
  }

  async function confirmCalculateAll(skipMissingRates: boolean) {
    setShowCalculateAllDialog(false);
    setShowProgressDialog(true);
    setIsCalculationComplete(false);
    setError(null);

    try {
      // Remove date filters when calculating ALL pending sessions
      const allPendingFilters: SessionFilters = {
        stationId: filters.stationId,
        searchTerm: filters.searchTerm,
        billingStatus: 'pending',
        startDate: '',
        endDate: '',
        page: 1,
        pageSize: 50
      };

      await calculateAllPendingSessions(
        allPendingFilters,
        (progress) => {
          setCalculationProgress(progress);
        },
        10,
        skipMissingRates
      );

      setIsCalculationComplete(true);
      await loadSessions();
      await loadPendingCount();
    } catch (err) {
      console.error('Failed to calculate all pending:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate all pending');
      setIsCalculationComplete(true);
    }
  }

  function handleCloseProgressDialog() {
    setShowProgressDialog(false);
    setIsCalculationComplete(false);
    setCalculationProgress({
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    });
  }

  function handleDownloadErrors() {
    if (calculationProgress.errors.length === 0) return;

    const csvContent = [
      ['Session ID', 'Error'],
      ...calculationProgress.errors.map(err => [err.sessionId, err.error])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculation-errors-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getFilterSummary(): string {
    const parts: string[] = [];

    if (filters.stationId) {
      const station = stations.find(s => s.id === filters.stationId);
      if (station) parts.push(`Station: ${station.name}`);
    }

    if (filters.startDate && filters.endDate) {
      parts.push(`Date: ${filters.startDate} to ${filters.endDate}`);
    } else if (filters.startDate) {
      parts.push(`From: ${filters.startDate}`);
    } else if (filters.endDate) {
      parts.push(`Until: ${filters.endDate}`);
    }

    if (filters.searchTerm) {
      parts.push(`Search: "${filters.searchTerm}"`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No filters applied';
  }

  function hasActiveFilters(): boolean {
    return !!(filters.stationId || filters.searchTerm);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Charging Sessions</h2>
          <p className="text-gray-600 mt-1">Calculate and manage billing for charging sessions</p>
        </div>
        <div className="flex items-center space-x-3">
          {pendingCount > 0 && (
            <button
              onClick={handleCalculateAllPending}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Calculator size={18} />
              <span>Calculate All Pending</span>
              <span className="ml-1 px-2 py-0.5 bg-green-500 rounded-full text-xs font-semibold">
                {pendingCount}
              </span>
            </button>
          )}
          <button
            onClick={loadSessions}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {bulkResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Bulk Recalculation Complete</p>
              <div className="text-sm text-blue-700 mt-2 space-y-1">
                <p>Total selected: {bulkResult.total} sessions</p>
                <p className="text-green-700">Processed successfully: {bulkResult.successful}</p>
                {bulkResult.skipped > 0 && (
                  <p className="text-gray-700">Skipped (already calculated): {bulkResult.skipped}</p>
                )}
                {bulkResult.failed > 0 && (
                  <p className="text-red-700">Failed: {bulkResult.failed}</p>
                )}
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-700">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside mt-1">
                    {bulkResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={() => setBulkResult(null)}
              className="text-blue-600 hover:text-blue-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              onClick={handleClearFilters}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Transaction ID, Card, Charge ID"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
            <select
              value={filters.stationId}
              onChange={(e) => handleFilterChange('stationId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Stations</option>
              {stations.map(station => (
                <option key={station.id} value={station.id}>
                  {station.name} {station.station_code ? `(${station.station_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Status</label>
            <select
              value={filters.billingStatus}
              onChange={(e) => handleFilterChange('billingStatus', e.target.value as 'all' | 'calculated' | 'pending')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="calculated">Calculated</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page Size</label>
            <select
              value={filters.pageSize}
              onChange={(e) => handleFilterChange('pageSize', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
              <option value="200">200 per page</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {sessions.length === 0 ? 0 : ((filters.page! - 1) * filters.pageSize! + 1)} - {Math.min(filters.page! * filters.pageSize!, totalCount)} of {totalCount} sessions
          </div>
          {selectedSessions.size > 0 && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                {selectedSessions.size} selected
              </span>
              <button
                onClick={handleBulkRecalculate}
                disabled={bulkRecalculating}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {bulkRecalculating ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Recalculating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    <span>Bulk Recalculate</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {selectedSessions.size === sessions.length ? (
              <CheckSquare size={16} className="text-blue-600" />
            ) : (
              <Square size={16} />
            )}
            <span>{selectedSessions.size === sessions.length ? 'Deselect All' : 'Select All'}</span>
          </button>
          <button
            onClick={handleSelectPending}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Select Pending Only
          </button>
          <button
            onClick={handleSelectCalculated}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Select Calculated Only
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg">No charging sessions found</p>
          <p className="text-gray-500 text-sm mt-2">Import sessions from the Import tab to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {selectedSessions.size === sessions.length ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} className="text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Transaction ID</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Station</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Start Time</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Duration</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Energy</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Billing Status</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Total</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map((session) => {
                const hasBilling = session.billing_calculations && session.billing_calculations.length > 0;
                const isCalculating = calculating === session.id;
                const isSelected = selectedSessions.has(session.id);

                return (
                  <tr key={session.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleSelectSession(session.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{session.transaction_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {session.stations?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(session.start_ts).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">
                      {session.duration_minutes} min
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">
                      {parseFloat(session.energy_consumed_kwh).toFixed(3)} kWh
                    </td>
                    <td className="px-6 py-4">
                      {hasBilling ? (
                        <span className="flex items-center space-x-1 text-green-700 text-sm">
                          <CheckCircle size={16} />
                          <span>Calculated</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-yellow-700 text-sm">
                          <AlertCircle size={16} />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      {hasBilling ? formatJOD(session.billing_calculations![0].total_amount) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingTransaction(session)}
                          className="p-1 text-gray-600 hover:text-gray-700"
                          title="Edit Transaction"
                        >
                          <Edit size={18} />
                        </button>
                        {isCalculating ? (
                          <Loader2 className="animate-spin text-blue-600" size={18} />
                        ) : hasBilling ? (
                          <>
                            <button
                              onClick={() => handleViewBreakdown(session)}
                              className="p-1 text-blue-600 hover:text-blue-700"
                              title="View Breakdown"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => handleGenerateInvoice(session.id)}
                              className="p-1 text-green-600 hover:text-green-700"
                              title="Download Invoice"
                            >
                              <FileText size={18} />
                            </button>
                            <button
                              onClick={() => handleRecalculate(session.id)}
                              className="p-1 text-orange-600 hover:text-orange-700"
                              title="Recalculate"
                            >
                              <RefreshCw size={18} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCalculate(session.id)}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Calculate Billing"
                          >
                            <Calculator size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sessions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">
            Page {filters.page} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={filters.page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => handlePageChange(filters.page! - 1)}
              disabled={filters.page === 1}
              className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (filters.page! <= 3) {
                  pageNum = i + 1;
                } else if (filters.page! >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = filters.page! - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1.5 text-sm border rounded-lg ${
                      filters.page === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(filters.page! + 1)}
              disabled={filters.page === totalPages}
              className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={filters.page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {viewingBreakdown && (
        <BillingBreakdownViewer
          breakdown={viewingBreakdown.breakdown}
          sessionInfo={{
            transactionId: viewingBreakdown.session.transaction_id,
            startDateTime: viewingBreakdown.session.start_ts,
            endDateTime: viewingBreakdown.session.end_ts,
            totalEnergy: parseFloat(viewingBreakdown.session.energy_consumed_kwh),
            totalDuration: viewingBreakdown.session.duration_minutes
          }}
          onClose={() => setViewingBreakdown(null)}
        />
      )}

      {editingTransaction && (
        <TransactionEditModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={() => {
            setEditingTransaction(null);
            loadSessions();
          }}
        />
      )}

      {showConfirmDialog && (
        <BulkRecalculateConfirmDialog
          totalSelected={selectedSessions.size}
          pendingCount={getSelectedSessionCounts().pendingCount}
          calculatedCount={getSelectedSessionCounts().calculatedCount}
          onConfirm={confirmBulkRecalculate}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {showCalculateAllDialog && (
        <CalculateAllPendingDialog
          pendingCount={pendingCount}
          hasFilters={hasActiveFilters()}
          filterSummary={getFilterSummary()}
          validation={validationResult || undefined}
          onConfirm={confirmCalculateAll}
          onCancel={() => setShowCalculateAllDialog(false)}
        />
      )}

      {showProgressDialog && (
        <CalculationProgressDialog
          progress={calculationProgress}
          isComplete={isCalculationComplete}
          onClose={handleCloseProgressDialog}
          onDownloadErrors={handleDownloadErrors}
        />
      )}
    </div>
  );
}
