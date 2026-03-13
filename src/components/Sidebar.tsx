import React, { useState, useEffect } from 'react';
import {
  Zap,
  Home,
  Database,
  Users,
  Upload,
  Calculator,
  DollarSign,
  Receipt,
  BarChart3,
  FileDown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Clock,
  Settings,
  UserCircle,
  ScrollText,
  Wrench,
  BarChart2,
  Wallet,
  Gauge,
  FileSpreadsheet,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { SidebarSection } from './SidebarSection';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  userEmail,
  onSignOut,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobile = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setIsMobileOpen(false);
  };

  return (
    <>
      <button
        onClick={toggleMobile}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        {isMobileOpen ? (
          <X className="w-6 h-6 text-gray-700" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleMobile}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-lg
          transition-all duration-300 z-40
          ${isCollapsed ? 'w-[60px]' : 'w-[280px]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          <div
            className={`flex items-center justify-between p-4 border-b border-gray-200 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            {!isCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">
                    EV Charging
                  </h1>
                  <p className="text-xs text-gray-500">Analytics</p>
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <SidebarSection title="Main" isCollapsed={isCollapsed}>
              <SidebarItem
                icon={Home}
                label="Dashboard"
                isActive={currentView === 'home'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('home')}
              />
              <SidebarItem
                icon={BarChart3}
                label="Analytics"
                isActive={currentView === 'analytics'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('analytics')}
                sub
              />
              <SidebarItem
                icon={FileDown}
                label="Reports"
                isActive={currentView === 'reports'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('reports')}
                sub
              />
            </SidebarSection>

            <div className="my-2 border-t border-gray-200" />

            <SidebarSection title="Operations" isCollapsed={isCollapsed}>
              <SidebarItem
                icon={Database}
                label="Stations"
                isActive={currentView === 'stations'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('stations')}
              />
              <SidebarItem
                icon={Users}
                label="Operators"
                isActive={currentView === 'operators'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('operators')}
              />
              <SidebarItem
                icon={Upload}
                label="Upload Data"
                isActive={currentView === 'import'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('import')}
              />
              <SidebarItem
                icon={Calculator}
                label="Billing"
                isActive={currentView === 'billing'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('billing')}
              />
              <SidebarItem
                icon={Clock}
                label="Shifts"
                isActive={currentView === 'shifts'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('shifts')}
              />
              <SidebarItem
                icon={DollarSign}
                label="Rates"
                isActive={currentView === 'rates'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('rates')}
              />
              <SidebarItem
                icon={Receipt}
                label="Fixed Charges"
                isActive={currentView === 'fixed-charges'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('fixed-charges')}
              />
              <SidebarItem
                icon={BarChart2}
                label="Operator Stats"
                isActive={currentView === 'operator-performance'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('operator-performance')}
              />
              <SidebarItem
                icon={Wallet}
                label="Accounting"
                isActive={currentView === 'accountant'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('accountant')}
              />
              <SidebarItem
                icon={Gauge}
                label="KPI Dashboard"
                isActive={currentView === 'kpi'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('kpi')}
              />
              <SidebarItem
                icon={FileSpreadsheet}
                label="CDR Export"
                isActive={currentView === 'cdr'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('cdr')}
              />
              <SidebarItem
                icon={CalendarDays}
                label="Roster"
                isActive={currentView === 'roster'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('roster')}
              />
              <SidebarItem
                icon={TrendingUp}
                label="Forecast"
                isActive={currentView === 'forecast'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('forecast')}
              />
            </SidebarSection>

            <div className="my-2 border-t border-gray-200" />

            <SidebarSection title="Admin" isCollapsed={isCollapsed}>
              <SidebarItem
                icon={Settings}
                label="Settings"
                isActive={currentView === 'settings'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('settings')}
              />
              <SidebarItem
                icon={UserCircle}
                label="Users"
                isActive={currentView === 'users'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('users')}
              />
              <SidebarItem
                icon={ScrollText}
                label="Audit Log"
                isActive={currentView === 'audit'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('audit')}
              />
              <SidebarItem
                icon={Wrench}
                label="Maintenance"
                isActive={currentView === 'maintenance'}
                isCollapsed={isCollapsed}
                onClick={() => handleNavigate('maintenance')}
              />
            </SidebarSection>

          </div>

          <div className="border-t border-gray-200">
            {!isCollapsed && userEmail && (
              <div className="p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {userEmail}
                  </p>
                  <p className="text-xs text-gray-500">Authenticated</p>
                </div>
              </div>
            )}

            <button
              onClick={onSignOut}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all
                ${isCollapsed ? 'justify-center' : ''}
              `}
              title={isCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium">Sign Out</span>
              )}
            </button>

            <button
              onClick={toggleCollapse}
              className="hidden lg:flex w-full items-center justify-center p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-200"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  <span className="text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
