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
import ExportPage from './ExportPage';
import HomeDashboard from './HomeDashboard';
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
          <HomeDashboard
            onNavigate={setCurrentView}
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
