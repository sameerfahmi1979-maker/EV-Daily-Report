import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Copy, Trash2, Power, PowerOff } from 'lucide-react';
import { getRateStructures, deleteRateStructure, duplicateRateStructure, updateRateStructure } from '../lib/rateService';
import { Database } from '../lib/database.types';

type RateStructure = Database['public']['Tables']['rate_structures']['Row'] & {
  stations?: {
    id: string;
    name: string;
    station_code: string | null;
  };
};

interface RateStructureListProps {
  onCreateNew: () => void;
  onEdit: (rateStructure: RateStructure) => void;
}

export default function RateStructureList({ onCreateNew, onEdit }: RateStructureListProps) {
  const [rateStructures, setRateStructures] = useState<RateStructure[]>([]);
  const [filteredStructures, setFilteredStructures] = useState<RateStructure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRateStructures();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStructures(rateStructures);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredStructures(
        rateStructures.filter(
          (rs) =>
            rs.name.toLowerCase().includes(query) ||
            rs.description?.toLowerCase().includes(query) ||
            rs.stations?.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, rateStructures]);

  async function loadRateStructures() {
    try {
      setLoading(true);
      setError(null);
      const data = await getRateStructures();
      setRateStructures(data);
      setFilteredStructures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rate structures');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the rate structure "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteRateStructure(id);
      await loadRateStructures();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rate structure');
    }
  }

  async function handleDuplicate(id: string, originalName: string) {
    const newName = prompt(`Enter a name for the duplicated rate structure:`, `${originalName} (Copy)`);
    if (!newName || newName.trim() === '') return;

    try {
      await duplicateRateStructure(id, newName.trim());
      await loadRateStructures();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate rate structure');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      await updateRateStructure(id, { is_active: !currentStatus });
      await loadRateStructures();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update rate structure status');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading rate structures...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadRateStructures}
          className="mt-2 text-red-700 hover:text-red-800 underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rate Structures</h2>
          <p className="text-gray-600 mt-1">Manage time-of-use rates and pricing structures</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>Create Rate Structure</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search rate structures..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filteredStructures.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg">
            {searchQuery ? 'No rate structures match your search' : 'No rate structures found'}
          </p>
          {!searchQuery && (
            <button
              onClick={onCreateNew}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first rate structure
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredStructures.map((structure) => (
            <div
              key={structure.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">{structure.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        structure.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {structure.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {structure.description && (
                    <p className="text-gray-600 mt-2">{structure.description}</p>
                  )}

                  <div className="flex items-center space-x-6 mt-4 text-sm text-gray-600">
                    {structure.stations && (
                      <div>
                        <span className="font-medium">Station:</span> {structure.stations.name}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Effective From:</span>{' '}
                      {new Date(structure.effective_from).toLocaleDateString()}
                    </div>
                    {structure.effective_to && (
                      <div>
                        <span className="font-medium">Effective To:</span>{' '}
                        {new Date(structure.effective_to).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(structure.id, structure.is_active)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title={structure.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {structure.is_active ? <PowerOff size={18} /> : <Power size={18} />}
                  </button>
                  <button
                    onClick={() => handleDuplicate(structure.id, structure.name)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => onEdit(structure)}
                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(structure.id, structure.name)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
