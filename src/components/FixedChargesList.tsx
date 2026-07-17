import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { getFixedCharges, deleteFixedCharge, updateFixedCharge } from '../lib/fixedChargeService';
import { formatJOD } from '../lib/currency';
import { Database } from '../lib/database.types';

type FixedCharge = Database['public']['Tables']['fixed_charges']['Row'] & {
  stations?: {
    id: string;
    name: string;
    station_code: string | null;
  };
};

interface FixedChargesListProps {
  onCreateNew: () => void;
  onEdit: (charge: FixedCharge) => void;
}

const CHARGE_TYPE_LABELS: Record<string, string> = {
  per_session: 'Per Session',
  daily: 'Daily',
  monthly: 'Monthly'
};

export default function FixedChargesList({ onCreateNew, onEdit }: FixedChargesListProps) {
  const [charges, setCharges] = useState<FixedCharge[]>([]);
  const [filteredCharges, setFilteredCharges] = useState<FixedCharge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCharges();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCharges(charges);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCharges(
        charges.filter(
          (charge) =>
            charge.charge_name.toLowerCase().includes(query) ||
            charge.charge_type.toLowerCase().includes(query) ||
            charge.stations?.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, charges]);

  async function loadCharges() {
    try {
      setLoading(true);
      setError(null);
      const data = await getFixedCharges();
      setCharges(data);
      setFilteredCharges(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fixed charges');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the fixed charge "${name}"?`)) {
      return;
    }

    try {
      await deleteFixedCharge(id);
      await loadCharges();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete fixed charge');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      await updateFixedCharge(id, { is_active: !currentStatus });
      await loadCharges();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update fixed charge status');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading fixed charges...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button onClick={loadCharges} className="mt-2 text-red-700 hover:text-red-800 underline">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fixed Charges</h2>
          <p className="text-gray-600 mt-1">Manage connection fees and service charges</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>Add Fixed Charge</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search fixed charges..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filteredCharges.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg">
            {searchQuery ? 'No fixed charges match your search' : 'No fixed charges found'}
          </p>
          {!searchQuery && (
            <button onClick={onCreateNew} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
              Create your first fixed charge
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Charge Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Station</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Effective Dates</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCharges.map((charge) => (
                <tr key={charge.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{charge.charge_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {CHARGE_TYPE_LABELS[charge.charge_type] || charge.charge_type}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatJOD(Number(charge.amount))}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {charge.stations?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {charge.effective_from && (
                      <div>From: {new Date(charge.effective_from).toLocaleDateString()}</div>
                    )}
                    {charge.effective_to && (
                      <div>To: {new Date(charge.effective_to).toLocaleDateString()}</div>
                    )}
                    {!charge.effective_from && !charge.effective_to && <span>Always</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        charge.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {charge.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleToggleActive(charge.id, charge.is_active)}
                        className="p-1 text-gray-600 hover:text-gray-900"
                        title={charge.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {charge.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        onClick={() => onEdit(charge)}
                        className="p-1 text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(charge.id, charge.charge_name)}
                        className="p-1 text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
