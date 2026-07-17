import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Calculator, CheckCircle } from 'lucide-react';

interface ValidationResult {
  canCalculate: number;
  missingRateStructure: number;
  missingStation: number;
  stationsWithoutRates: Array<{ stationId: string; stationName: string; sessionCount: number }>;
}

interface CalculateAllPendingDialogProps {
  pendingCount: number;
  hasFilters: boolean;
  filterSummary?: string;
  validation?: ValidationResult;
  onConfirm: (skipMissingRates: boolean) => void;
  onCancel: () => void;
}

export default function CalculateAllPendingDialog({
  pendingCount,
  hasFilters,
  filterSummary,
  validation,
  onConfirm,
  onCancel
}: CalculateAllPendingDialogProps) {
  const [skipMissingRates, setSkipMissingRates] = useState(false);

  const hasIssues = validation && (validation.missingRateStructure > 0 || validation.missingStation > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calculator className="text-blue-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Calculate All Pending Transactions
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              This will calculate billing for all pending transactions
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Total Pending:</span>
              <span className="font-semibold text-blue-900">{pendingCount} transactions</span>
            </div>
            <div className="pt-2 border-t border-blue-200">
              <p className="text-xs text-green-700 font-medium">
                Note: This will process ALL pending sessions regardless of date filters
              </p>
              {hasFilters && filterSummary && (
                <p className="text-xs text-gray-600 mt-1">
                  Station/search filters will still apply: {filterSummary}
                </p>
              )}
            </div>
          </div>
        </div>

        {validation && (
          <div className="space-y-3 mb-4">
            {validation.canCalculate > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start space-x-2">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    {validation.canCalculate} transactions ready to calculate
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    These sessions have valid rate structures configured
                  </p>
                </div>
              </div>
            )}

            {validation.missingRateStructure > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-start space-x-2 mb-2">
                  <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900">
                      {validation.missingRateStructure} transactions missing rate structures
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      These sessions cannot be calculated without active rate structures
                    </p>
                  </div>
                </div>

                {validation.stationsWithoutRates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <p className="text-xs font-medium text-orange-900 mb-2">Affected Stations:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {validation.stationsWithoutRates.map((station) => (
                        <div key={station.stationId} className="text-xs text-orange-800 flex justify-between">
                          <span>{station.stationName}</span>
                          <span className="font-medium">{station.sessionCount} sessions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-orange-200">
                  <label className="flex items-start space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipMissingRates}
                      onChange={(e) => setSkipMissingRates(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-orange-800">
                      Skip sessions without rate structures (only calculate valid sessions)
                    </span>
                  </label>
                </div>
              </div>
            )}

            {validation.missingStation > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-red-900">
                    {validation.missingStation} transactions without station assignment
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    These sessions need to be assigned to a station before calculation
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {pendingCount > 500 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start space-x-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-yellow-800">
              This is a large number of transactions. The calculation may take several minutes.
              Please do not close this window during the process.
            </p>
          </div>
        )}

        <div className="space-y-2 mb-6 text-sm text-gray-600">
          <p>This action will:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Process ALL pending transactions from all dates {hasFilters && '(station/search filters apply)'}</li>
            <li>Calculate billing based on rate structures and time-of-use periods</li>
            <li>Apply fixed charges and taxes</li>
            <li>Save all calculations to the database</li>
            {hasIssues && !skipMissingRates && (
              <li className="text-orange-600">Report errors for sessions that cannot be calculated</li>
            )}
          </ul>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(skipMissingRates)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            disabled={validation && validation.canCalculate === 0 && !skipMissingRates}
          >
            <Calculator size={18} />
            <span>Calculate {validation && validation.canCalculate > 0 ? `${skipMissingRates ? validation.canCalculate : 'All'}` : 'All'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
