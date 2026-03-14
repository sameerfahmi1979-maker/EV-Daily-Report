import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { seedUserData, checkIfUserHasData } from '../lib/seedData';
import { StationList } from './StationList';
import { StationForm } from './StationForm';
import { StationDetails } from './StationDetails';
import { OperatorList } from './OperatorList';
import { OperatorForm } from './OperatorForm';
import { OperatorDetails } from './OperatorDetails';
import RateStructureList from './RateStructureList';
import RateStructureForm from './RateStructureForm';
import FixedChargesList from './FixedChargesList';
import FixedChargesForm from './FixedChargesForm';
import ImportPage from './ImportPage';
import SessionList from './SessionList';
import AnalyticsDashboard from './AnalyticsDashboard';
import ReportsPage from './reports/ReportsPage';
import HomeDashboard from './HomeDashboard';
import ShiftManagement from './ShiftManagement';
import SystemSettings from './SystemSettings';
import UserManagement from './UserManagement';
import AuditLog from './AuditLog';
import MaintenanceLog from './MaintenanceLog';
import OperatorPerformance from './OperatorPerformance';
import AccountantDashboard from './AccountantDashboard';
import NotificationBell from './NotificationBell';
import KPIDashboard from './KPIDashboard';
import CDRExport from './CDRExport';
import OperatorRoster from './OperatorRoster';
import RevenueForecast from './RevenueForecast';
import { Database as DatabaseType } from '../lib/database.types';
import { Sidebar } from './Sidebar';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
type Station = DatabaseType['public']['Tables']['stations']['Row'];
type Operator = DatabaseType['public']['Tables']['operators']['Row'];
type RateStructure = DatabaseType['public']['Tables']['rate_structures']['Row'] & {
  stations?: {
    id: string;
    name: string;
    station_code: string | null;
  };
};
type FixedCharge = DatabaseType['public']['Tables']['fixed_charges']['Row'] & {
  stations?: {
    id: string;
    name: string;
    station_code: string | null;
  };
};
type View =
  | 'home'
  | 'stations'
  | 'operators'
  | 'rates'
  | 'fixed-charges'
  | 'import'
  | 'billing'
  | 'analytics'
  | 'reports'
  | 'shifts'
  | 'settings'
  | 'users'
  | 'audit'
  | 'maintenance'
  | 'operator-performance'
  | 'accountant'
  | 'kpi'
  | 'cdr'
  | 'roster'
  | 'forecast';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [billingInitialFilter, setBillingInitialFilter] = useState<'all' | 'calculated' | 'pending' | undefined>(undefined);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showStationForm, setShowStationForm] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [viewingStation, setViewingStation] = useState<Station | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showRateForm, setShowRateForm] = useState(false);
  const [editingRate, setEditingRate] = useState<RateStructure | null>(null);
  const [rateRefreshKey, setRateRefreshKey] = useState(0);

  const [showFixedChargeForm, setShowFixedChargeForm] = useState(false);
  const [editingFixedCharge, setEditingFixedCharge] = useState<FixedCharge | null>(null);
  const [fixedChargeRefreshKey, setFixedChargeRefreshKey] = useState(0);

  const [showOperatorForm, setShowOperatorForm] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [viewingOperator, setViewingOperator] = useState<Operator | null>(null);
  const [operatorRefreshKey, setOperatorRefreshKey] = useState(0);

  useEffect(() => {
    if (user) {
      checkIfUserHasData().then((result) => {
        setHasData(result);
        setLoading(false);
      });
    }
  }, [user]);

  const handleSeedData = async () => {
    if (!user) return;

    setSeeding(true);
    setSeedMessage(null);

    const result = await seedUserData(user.id);

    if (result.success) {
      setSeedMessage({ type: 'success', text: result.message });
      setHasData(true);
      setRefreshKey(prev => prev + 1);
    } else {
      setSeedMessage({ type: 'error', text: result.message });
    }

    setSeeding(false);
  };

  const handleAddStation = () => {
    setEditingStation(null);
    setShowStationForm(true);
  };

  const handleEditStation = (station: Station) => {
    setEditingStation(station);
    setShowStationForm(true);
    setViewingStation(null);
  };

  const handleViewStation = (station: Station) => {
    setViewingStation(station);
  };

  const handleDeleteStation = async (station: Station) => {
    if (!user) return;

    if (confirm('Are you sure you want to delete this station? This action cannot be undone.')) {
      try {
        const { stationService } = await import('../lib/stationService');
        await stationService.delete(station.id, user.id);
        setRefreshKey(prev => prev + 1);
        setViewingStation(null);
      } catch (err: any) {
        alert('Error deleting station: ' + err.message);
      }
    }
  };

  const handleFormSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleNavigate = (view: View) => {
    if (view !== 'billing') {
      setBillingInitialFilter(undefined);
    }
    setCurrentView(view);
  };

  const handleNavigateWithPending = () => {
    setBillingInitialFilter('pending');
    setCurrentView('billing');
  };

  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-green-50'}`}>
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        userEmail={user?.email}
        onSignOut={signOut}
      />

      <main className="lg:ml-[280px] transition-all duration-300 min-h-screen">
        {/* Top utility bar */}
        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 lg:px-8 pt-4 lg:pt-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark'
              ? <Sun size={20} className="text-yellow-400" />
              : <Moon size={20} className="text-gray-600" />}
          </button>
          <NotificationBell />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pt-2 lg:pt-2">
        {currentView === 'home' && (
          <HomeDashboard
            onNavigate={handleNavigate}
            onNavigateToPendingBilling={handleNavigateWithPending}
            hasData={hasData}
            loading={loading}
            onSeedData={handleSeedData}
            seeding={seeding}
            seedMessage={seedMessage}
          />
        )}

        {currentView === 'stations' && (
          <StationList
            key={refreshKey}
            onAddStation={handleAddStation}
            onEditStation={handleEditStation}
            onViewStation={handleViewStation}
          />
        )}

        {currentView === 'operators' && (
          <OperatorList
            key={operatorRefreshKey}
            onAddOperator={() => {
              setEditingOperator(null);
              setShowOperatorForm(true);
            }}
            onEditOperator={(operator) => {
              setEditingOperator(operator);
              setShowOperatorForm(true);
              setViewingOperator(null);
            }}
            onViewOperator={(operator) => {
              setViewingOperator(operator);
            }}
          />
        )}

        {currentView === 'rates' && (
          <RateStructureList
            key={rateRefreshKey}
            onCreateNew={() => {
              setEditingRate(null);
              setShowRateForm(true);
            }}
            onEdit={(rate) => {
              setEditingRate(rate);
              setShowRateForm(true);
            }}
          />
        )}

        {currentView === 'fixed-charges' && (
          <FixedChargesList
            key={fixedChargeRefreshKey}
            onCreateNew={() => {
              setEditingFixedCharge(null);
              setShowFixedChargeForm(true);
            }}
            onEdit={(charge) => {
              setEditingFixedCharge(charge);
              setShowFixedChargeForm(true);
            }}
          />
        )}

        {currentView === 'import' && <ImportPage onNavigateToBilling={() => setCurrentView('billing')} />}

        {currentView === 'billing' && <SessionList initialBillingStatus={billingInitialFilter} />}

        {currentView === 'analytics' && <AnalyticsDashboard />}

        {currentView === 'reports' && <ReportsPage />}

        {currentView === 'shifts' && <ShiftManagement />}

        {currentView === 'settings' && <SystemSettings />}

        {currentView === 'users' && <UserManagement />}

        {currentView === 'audit' && <AuditLog />}

        {currentView === 'maintenance' && <MaintenanceLog />}

        {currentView === 'operator-performance' && <OperatorPerformance />}

        {currentView === 'accountant' && <AccountantDashboard />}

        {currentView === 'kpi' && <KPIDashboard />}

        {currentView === 'cdr' && <CDRExport />}

        {currentView === 'roster' && <OperatorRoster />}

        {currentView === 'forecast' && <RevenueForecast />}
        </div>
      </main>

      {showStationForm && (
        <StationForm
          station={editingStation}
          onClose={() => {
            setShowStationForm(false);
            setEditingStation(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {viewingStation && (
        <StationDetails
          station={viewingStation}
          onClose={() => setViewingStation(null)}
          onEdit={handleEditStation}
          onDelete={handleDeleteStation}
        />
      )}

      {showRateForm && (
        <RateStructureForm
          rateStructure={editingRate}
          onClose={() => {
            setShowRateForm(false);
            setEditingRate(null);
          }}
          onSave={() => {
            setRateRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {showFixedChargeForm && (
        <FixedChargesForm
          fixedCharge={editingFixedCharge}
          onClose={() => {
            setShowFixedChargeForm(false);
            setEditingFixedCharge(null);
          }}
          onSave={() => {
            setFixedChargeRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {showOperatorForm && (
        <OperatorForm
          operator={editingOperator}
          onClose={() => {
            setShowOperatorForm(false);
            setEditingOperator(null);
          }}
          onSuccess={() => {
            setOperatorRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {viewingOperator && (
        <OperatorDetails
          operator={viewingOperator}
          onClose={() => setViewingOperator(null)}
          onEdit={(operator) => {
            setEditingOperator(operator);
            setShowOperatorForm(true);
            setViewingOperator(null);
          }}
          onDelete={async (operator) => {
            if (!user) return;
            if (confirm('Are you sure you want to delete this operator? This action cannot be undone.')) {
              try {
                const { operatorService } = await import('../lib/operatorService');
                await operatorService.delete(operator.id, user.id);
                setOperatorRefreshKey(prev => prev + 1);
                setViewingOperator(null);
              } catch (err: any) {
                alert('Error deleting operator: ' + err.message);
              }
            }
          }}
        />
      )}
    </div>
  );
}
