import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { operatorService } from '../lib/operatorService';
import { Database } from '../lib/database.types';
import { Plus, Search, User, Phone, Mail, Edit, Trash2, Eye, Loader2, AlertCircle, CreditCard } from 'lucide-react';

type Operator = Database['public']['Tables']['operators']['Row'];

interface OperatorListProps {
  onAddOperator: () => void;
  onEditOperator: (operator: Operator) => void;
  onViewOperator: (operator: Operator) => void;
}

export function OperatorList({ onAddOperator, onEditOperator, onViewOperator }: OperatorListProps) {
  const { user } = useAuth();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadOperators();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOperators(operators);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = operators.filter(
        (operator) =>
          operator.name.toLowerCase().includes(query) ||
          operator.phone_number?.toLowerCase().includes(query) ||
          operator.card_number?.toLowerCase().includes(query) ||
          operator.email?.toLowerCase().includes(query)
      );
      setFilteredOperators(filtered);
    }
  }, [searchQuery, operators]);

  const loadOperators = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await operatorService.getAll();
      setOperators(data);
      setFilteredOperators(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this operator? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingId(id);
      await operatorService.delete(id, user.id);
      await loadOperators();
    } catch (err: any) {
      alert('Error deleting operator: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusValue = status || 'active';
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[statusValue as keyof typeof styles] || styles.active}`}>
        {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 text-red-800">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Error Loading Operators</h3>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Operators</h2>
          <p className="text-gray-600 mt-1">Manage charging station operators</p>
        </div>
        <button
          onClick={onAddOperator}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add Operator
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, card number, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
          />
        </div>
      </div>

      {filteredOperators.length === 0 ? (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? 'No operators found' : 'No operators yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Get started by adding your first operator'}
          </p>
          {!searchQuery && (
            <button
              onClick={onAddOperator}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add First Operator
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOperators.map((operator) => (
            <div
              key={operator.id}
              className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {operator.photo_url ? (
                      <img
                        src={operator.photo_url}
                        alt={operator.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{operator.name}</h3>
                    {getStatusBadge(operator.status)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {operator.phone_number && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{operator.phone_number}</span>
                  </div>
                )}
                {operator.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{operator.email}</span>
                  </div>
                )}
                {operator.card_number && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CreditCard className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate font-mono">{operator.card_number}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => onViewOperator(operator)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => onEditOperator(operator)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(operator.id)}
                  disabled={deletingId === operator.id}
                  className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === operator.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
