import React, { useState } from 'react';
import {
  FileText, Clock, Users, Banknote, BarChart3, TrendingUp,
  Award, Activity, UserCheck, DollarSign, Receipt, AlertTriangle,
  Calendar as CalendarIcon, PieChart, Zap, Wrench, ChevronDown,
  ChevronUp
} from 'lucide-react';

// Group A — Core Operations
import AllTransactionsTab from './AllTransactionsTab';
import ShiftTransactionsTab from './ShiftTransactionsTab';
import OperatorTransactionsTab from './OperatorTransactionsTab';
import HandoverHistoryTab from './HandoverHistoryTab';

// Group B — Performance & Analytics
import StationPerformanceTab from './StationPerformanceTab';
import OperatorPerformanceTab from './OperatorPerformanceTab';
import FullPerformanceTab from './FullPerformanceTab';
import PeakHoursTab from './PeakHoursTab';
import OperatorAttendanceTab from './OperatorAttendanceTab';

// Group C — Revenue & Billing
import RevenueBreakdownTab from './RevenueBreakdownTab';
import InvoiceHistoryTab from './InvoiceHistoryTab';
import PendingBillingTab from './PendingBillingTab';
import MonthlyFinancialTab from './MonthlyFinancialTab';
import StationProfitabilityTab from './StationProfitabilityTab';
import RateImpactTab from './RateImpactTab';

// Group D — Operational Reports
import DailyOpsSummaryTab from './DailyOpsSummaryTab';
import EnergyConsumptionTab from './EnergyConsumptionTab';
import ChargerUptimeTab from './ChargerUptimeTab';
import MaintenanceReportTab from './MaintenanceReportTab';

interface TabDef {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType;
}

interface TabGroup {
  name: string;
  color: string;
  bgColor: string;
  tabs: TabDef[];
}

const tabGroups: TabGroup[] = [
  {
    name: 'Core Operations',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    tabs: [
      { id: 'all-transactions', label: 'All Transactions', icon: FileText, component: AllTransactionsTab },
      { id: 'shift-transactions', label: 'Shift Transactions', icon: Clock, component: ShiftTransactionsTab },
      { id: 'operator-transactions', label: 'Operator Transactions', icon: Users, component: OperatorTransactionsTab },
      { id: 'handover-history', label: 'Handover History', icon: Banknote, component: HandoverHistoryTab },
    ],
  },
  {
    name: 'Performance & Analytics',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    tabs: [
      { id: 'station-performance', label: 'Station Performance', icon: BarChart3, component: StationPerformanceTab },
      { id: 'operator-performance', label: 'Operator Performance', icon: Award, component: OperatorPerformanceTab },
      { id: 'full-performance', label: 'Full Performance', icon: TrendingUp, component: FullPerformanceTab },
      { id: 'peak-hours', label: 'Peak Hours', icon: Activity, component: PeakHoursTab },
      { id: 'operator-attendance', label: 'Attendance', icon: UserCheck, component: OperatorAttendanceTab },
    ],
  },
  {
    name: 'Revenue & Billing',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    tabs: [
      { id: 'revenue-breakdown', label: 'Revenue Breakdown', icon: PieChart, component: RevenueBreakdownTab },
      { id: 'invoice-history', label: 'Invoice History', icon: Receipt, component: InvoiceHistoryTab },
      { id: 'pending-billing', label: 'Pending Billing', icon: AlertTriangle, component: PendingBillingTab },
      { id: 'monthly-financial', label: 'Monthly Summary', icon: CalendarIcon, component: MonthlyFinancialTab },
      { id: 'station-profitability', label: 'Profitability', icon: DollarSign, component: StationProfitabilityTab },
      { id: 'rate-impact', label: 'Rate Impact', icon: TrendingUp, component: RateImpactTab },
    ],
  },
  {
    name: 'Operational Reports',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    tabs: [
      { id: 'daily-ops', label: 'Daily Operations', icon: CalendarIcon, component: DailyOpsSummaryTab },
      { id: 'energy-consumption', label: 'Energy Consumption', icon: Zap, component: EnergyConsumptionTab },
      { id: 'charger-uptime', label: 'Charger Uptime', icon: Activity, component: ChargerUptimeTab },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench, component: MaintenanceReportTab },
    ],
  },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('all-transactions');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Find active tab component
  const activeTabDef = tabGroups
    .flatMap((g) => g.tabs)
    .find((t) => t.id === activeTab);
  const ActiveComponent = activeTabDef?.component || AllTransactionsTab;

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate, filter, and export comprehensive reports across all operations
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar — Tab Groups */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-4">
            {tabGroups.map((group) => (
              <div key={group.name}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 ${group.bgColor} border-b border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity`}
                >
                  <span className={`text-xs font-bold uppercase tracking-wider ${group.color}`}>
                    {group.name}
                  </span>
                  {collapsedGroups[group.name] ? (
                    <ChevronDown className={`w-3.5 h-3.5 ${group.color}`} />
                  ) : (
                    <ChevronUp className={`w-3.5 h-3.5 ${group.color}`} />
                  )}
                </button>

                {/* Tab buttons */}
                {!collapsedGroups[group.name] && (
                  <div className="py-1">
                    {group.tabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium border-l-3 border-blue-600'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Active tab title */}
          <div className="flex items-center gap-3 mb-4">
            {activeTabDef && (
              <>
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <activeTabDef.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {activeTabDef.label}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tabGroups.find((g) => g.tabs.some((t) => t.id === activeTab))?.name}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Tab content */}
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
