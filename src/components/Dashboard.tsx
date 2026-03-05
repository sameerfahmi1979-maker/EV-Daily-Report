import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Zap, Database, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
import ExportPage from './ExportPage';
import { Database as DatabaseType } from '../lib/database.types';
import { Sidebar } from './Sidebar';
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
  | 'reports';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        userEmail={user?.email}
        onSignOut={signOut}
      />

      <main className="lg:ml-[280px] transition-all duration-300 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 lg:pt-8">
        {currentView === 'home' && (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
              <p className="text-gray-600">Manage your charging stations and billing operations</p>
            </div>

            {!loading && !hasData && (
              <div className="mb-8 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Sample Data Available
                </h4>
                <p className="text-sm text-green-800 mb-4">
                  Load sample stations, Jordan TOU rates, and fixed charges to test the system
                </p>
                {seedMessage && (
                  <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                    seedMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {seedMessage.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="text-sm">{seedMessage.text}</span>
                  </div>
                )}
                <button
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading Sample Data...
                    </>
                  ) : (
                    <>
                      <Database className="w-5 h-5" />
                      Load Sample Data
                    </>
                  )}
                </button>
                <p className="text-xs text-green-700 mt-3">
                  This will create: 3 stations, Jordan EDCO TOU rate structure with 5 periods, and 2 fixed charges
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Phase 3: Station Management</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Station CRUD Operations</h4>
                      <p className="text-sm text-gray-600">Full create, read, update, delete with RLS</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Search & Filter</h4>
                      <p className="text-sm text-gray-600">Grid view with search capabilities</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentView('stations')}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  View Stations
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Phase 4: Rate Configuration</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Rate Structure Management</h4>
                      <p className="text-sm text-gray-600">Time-of-use rates with periods</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Visual 24-Hour Timeline</h4>
                      <p className="text-sm text-gray-600">Color-coded period editor</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Jordan Templates</h4>
                      <p className="text-sm text-gray-600">EDCO TOU & Flat Rate presets</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Fixed Charges</h4>
                      <p className="text-sm text-gray-600">Connection & service fees</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCurrentView('rates')}
                    className="bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Rates
                  </button>
                  <button
                    onClick={() => setCurrentView('fixed-charges')}
                    className="bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Charges
                  </button>
                </div>
              </div>
            </div>
          </>
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

        {currentView === 'billing' && <SessionList />}

        {currentView === 'analytics' && <AnalyticsDashboard />}

        {currentView === 'reports' && <ExportPage />}
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
