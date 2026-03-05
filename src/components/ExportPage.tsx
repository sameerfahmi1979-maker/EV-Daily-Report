import React, { useState, useEffect } from 'react';
import { FileText, TrendingUp, BarChart3, Search, Filter as FilterIcon, ChevronDown, Printer, FileDown } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  exportSessionsToExcel,
  exportSessionsToCSV,
  exportSessionsToPDF,
  exportBillingToExcel,
  exportBillingToCSV,
  exportBillingToPDF,
  exportSummaryToExcel,
  exportSummaryToCSV,
  exportSummaryToPDF,
  generateMonthlySummary
} from '../lib/reportService';
import { supabase } from '../lib/supabase';
import { formatJODShort } from '../lib/currency';

interface Station {
  id: string;
  name: string;
  station_code: string | null;
}

interface Operator {
  id: string;
  name: string;
  card_number: string;
}

interface Transaction {
  id: string;
  transaction_id: string;
  station_name: string;
  station_code: string | null;
  start_ts: string;
  end_ts: string | null;
  energy_consumed_kwh: string;
  duration_minutes: number;
  total_amount: string | null;
  start_date: string;
  hasBilling: boolean;
}

interface FilterState {
  searchTerm: string;
  stationId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  cardNumber: string;
}

type ReportTab = 'sessions' | 'billing' | 'summary';

const reportTabs = [
  { id: 'sessions' as ReportTab, label: 'Daily Operations', icon: FileText },
  { id: 'billing' as ReportTab, label: 'Revenue Analysis', icon: TrendingUp },
  { id: 'summary' as ReportTab, label: 'Station Performance', icon: BarChart3 }
];

export default function ExportPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sessions');
  const [stations, setStations] = useState<Station[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [excludeTestSessions, setExcludeTestSessions] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    stationId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    cardNumber: ''
  });

  useEffect(() => {
    loadStations();
    loadOperators();
    loadTransactions();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [filters, currentPage, activeTab, itemsPerPage, excludeTestSessions]);

  async function loadStations() {
    const { data, error } = await supabase
      .from('stations')
      .select('id, name, station_code')
      .order('name');

    if (error) {
      console.error('Failed to load stations:', error);
    } else {
      setStations(data || []);
    }
  }

  async function loadOperators() {
    const { data, error } = await supabase
      .from('operators')
      .select('id, name, card_number')
      .order('name');

    if (error) {
      console.error('Failed to load operators:', error);
    } else {
      setOperators(data || []);
    }
  }

  async function loadTransactions() {
    try {
      setLoadingTransactions(true);

      let query = supabase
        .from('charging_sessions')
        .select(`
          id,
          transaction_id,
          start_ts,
          end_ts,
          energy_consumed_kwh,
          duration_minutes,
          start_date,
          stations (
            name,
            station_code
          ),
          billing_calculations (
            total_amount
          )
        `, { count: 'exact' })
        .order('start_ts', { ascending: false });

      if (filters.startDate && filters.startTime) {
        const startTimestamp = `${filters.startDate}T${filters.startTime}:00`;
        query = query.gte('start_ts', startTimestamp);
      } else if (filters.startDate) {
        query = query.gte('start_date', filters.startDate);
      }

      if (filters.endDate && filters.endTime) {
        const endTimestamp = `${filters.endDate}T${filters.endTime}:59`;
        query = query.lte('start_ts', endTimestamp);
      } else if (filters.endDate) {
        query = query.lte('start_date', filters.endDate);
      }

      if (filters.stationId) {
        query = query.eq('station_id', filters.stationId);
      }
      if (filters.searchTerm) {
        query = query.ilike('transaction_id', `%${filters.searchTerm}%`);
      }
      if (filters.cardNumber) {
        query = query.eq('card_number', filters.cardNumber);
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const formattedData: Transaction[] = (data || []).map((session: any) => ({
        id: session.id,
        transaction_id: session.transaction_id,
        station_name: session.stations?.name || 'Unknown',
        station_code: session.stations?.station_code,
        start_ts: session.start_ts,
        end_ts: session.end_ts,
        energy_consumed_kwh: session.energy_consumed_kwh,
        duration_minutes: session.duration_minutes,
        total_amount: session.billing_calculations?.[0]?.total_amount || null,
        start_date: session.start_date,
        hasBilling: !!session.billing_calculations?.[0]
      }));

      setTransactions(formattedData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }

  function applyQuickDateRange(range: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (range) {
      case 'today':
        start = now;
        break;
      case 'yesterday':
        start = subDays(now, 1);
        end = subDays(now, 1);
        break;
      case 'thisWeek':
        start = startOfWeek(now, { weekStartsOn: 0 });
        end = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'last7Days':
        start = subDays(now, 7);
        break;
      case 'thisMonth':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      default:
        return;
    }

    handleFilterChange('startDate', format(start, 'yyyy-MM-dd'));
    handleFilterChange('endDate', format(end, 'yyyy-MM-dd'));
  }

  async function handleExport(exportFormat: 'excel' | 'csv' | 'pdf' | 'print') {
    try {
      setLoading(true);

      if (exportFormat === 'print') {
        window.print();
        return;
      }

      if (!filters.startDate || !filters.endDate) {
        alert('Please select a date range for export');
        setLoading(false);
        return;
      }

      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      const stationId = filters.stationId || undefined;
      const startTime = filters.startTime || undefined;
      const endTime = filters.endTime || undefined;
      const cardNumber = filters.cardNumber || undefined;

      switch (activeTab) {
        case 'sessions':
          if (exportFormat === 'excel') {
            await exportSessionsToExcel(start, end, stationId, true, startTime, endTime);
          } else if (exportFormat === 'csv') {
            await exportSessionsToCSV(start, end, stationId, startTime, endTime);
          } else {
            await exportSessionsToPDF(start, end, stationId, true, startTime, endTime, cardNumber);
          }
          break;

        case 'billing':
          if (exportFormat === 'excel') {
            await exportBillingToExcel(start, end, stationId, true, startTime, endTime);
          } else if (exportFormat === 'csv') {
            await exportBillingToCSV(start, end, stationId, startTime, endTime);
          } else {
            await exportBillingToPDF(start, end, stationId, true, startTime, endTime, cardNumber);
          }
          break;

        case 'summary':
          const summary = await generateMonthlySummary(start);
          if (exportFormat === 'excel') {
            await exportSummaryToExcel(summary, true);
          } else if (exportFormat === 'csv') {
            await exportSummaryToCSV(summary);
          } else {
            await exportSummaryToPDF(summary, true);
          }
          break;
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const totalEnergy = transactions.reduce((sum, t) => sum + parseFloat(t.energy_consumed_kwh), 0);
  const totalRevenue = transactions.reduce((sum, t) => sum + (t.total_amount ? parseFloat(t.total_amount) : 0), 0);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-600 mt-1">Generate comprehensive business reports with advanced filtering</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder="Search by ticket, vehicle, driver, customer, or material..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => applyQuickDateRange('today')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => applyQuickDateRange('yesterday')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Yesterday
            </button>
            <button
              onClick={() => applyQuickDateRange('thisWeek')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              This Week
            </button>
            <button
              onClick={() => applyQuickDateRange('last7Days')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyQuickDateRange('thisMonth')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              <FilterIcon size={16} />
              <span>Advanced</span>
              <ChevronDown size={16} className={`transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showAdvancedFilters && (
            <div className="pt-2 border-t border-gray-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={filters.startTime}
                      onChange={(e) => handleFilterChange('startTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="HH:mm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">End Time</label>
                    <input
                      type="time"
                      value={filters.endTime}
                      onChange={(e) => handleFilterChange('endTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="HH:mm"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Station</label>
                    <select
                      value={filters.stationId}
                      onChange={(e) => handleFilterChange('stationId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">All Stations</option>
                      {stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name} {station.station_code && `(${station.station_code})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Operator (Card Number)</label>
                    <select
                      value={filters.cardNumber}
                      onChange={(e) => handleFilterChange('cardNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">All Operators</option>
                      {operators.map((operator) => (
                        <option key={operator.id} value={operator.card_number}>
                          {operator.name} ({operator.card_number})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Operator Shift Presets</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      handleFilterChange('startTime', '08:00');
                      handleFilterChange('endTime', '16:00');
                    }}
                    className="px-3 py-1.5 text-xs border border-blue-300 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                  >
                    Morning Shift (08:00-16:00)
                  </button>
                  <button
                    onClick={() => {
                      handleFilterChange('startTime', '16:00');
                      handleFilterChange('endTime', '00:00');
                    }}
                    className="px-3 py-1.5 text-xs border border-orange-300 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-medium transition-colors"
                  >
                    Afternoon Shift (16:00-00:00)
                  </button>
                  <button
                    onClick={() => {
                      handleFilterChange('startTime', '00:00');
                      handleFilterChange('endTime', '08:00');
                    }}
                    className="px-3 py-1.5 text-xs border border-green-300 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium transition-colors"
                  >
                    Night Shift (00:00-08:00)
                  </button>
                  <button
                    onClick={() => {
                      handleFilterChange('startTime', '');
                      handleFilterChange('endTime', '');
                    }}
                    className="px-3 py-1.5 text-xs border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Clear Times
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-yellow-50 border-y border-yellow-100 flex items-center justify-between">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeTestSessions}
              onChange={(e) => setExcludeTestSessions(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">Exclude Test Sessions (Demo Only)</span>
          </label>
          <span className="text-xs text-gray-600">Test sessions do not affect revenue or energy reports</span>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIndex}-{endIndex}</span> of <span className="font-semibold">{totalCount}</span> results
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            {(filters.startTime || filters.endTime || filters.cardNumber) && (
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs">
                {(filters.startTime || filters.endTime) && (
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 font-medium">
                      Time filter: {filters.startTime || '00:00'} - {filters.endTime || '23:59'}
                    </span>
                    <button
                      onClick={() => {
                        handleFilterChange('startTime', '');
                        handleFilterChange('endTime', '');
                      }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {filters.cardNumber && (
                  <div className="flex items-center space-x-2">
                    <span className="text-green-600 font-medium">
                      Operator: {filters.cardNumber}
                    </span>
                    <button
                      onClick={() => handleFilterChange('cardNumber', '')}
                      className="text-green-600 hover:text-green-800 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('print')}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Printer size={18} />
              <span>Print</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <FileDown size={18} />
              <span>PDF</span>
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <FileDown size={18} />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <FileDown size={18} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loadingTransactions ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No transactions found matching your filters
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Station
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    End Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Energy (kWh)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => {
                  const durationHours = (transaction.duration_minutes / 60).toFixed(1);
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.transaction_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.station_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(transaction.start_ts), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {format(new Date(transaction.start_ts), 'HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.end_ts ? format(new Date(transaction.end_ts), 'HH:mm:ss') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-medium">{transaction.duration_minutes} min</span>
                        <span className="text-gray-500 text-xs ml-1">({durationHours} hrs)</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {parseFloat(transaction.energy_consumed_kwh).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {transaction.end_ts ? (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                            completed
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                            in progress
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {transaction.total_amount ? formatJODShort(parseFloat(transaction.total_amount)) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {Math.ceil(totalCount / itemsPerPage) > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {Math.ceil(totalCount / itemsPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(totalCount / itemsPerPage)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
