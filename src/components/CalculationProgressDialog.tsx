import React, { useMemo } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle, Download, SkipForward } from 'lucide-react';
import { CalculationProgress } from '../lib/billingService';

interface CalculationProgressDialogProps {
  progress: CalculationProgress;
  isComplete: boolean;
  onClose: () => void;
  onDownloadErrors?: () => void;
}

interface GroupedErrors {
  missingRateStructure: Array<{ sessionId: string; error: string }>;
  missingStation: Array<{ sessionId: string; error: string }>;
  other: Array<{ sessionId: string; error: string }>;
}

export default function CalculationProgressDialog({
  progress,
  isComplete,
  onClose,
  onDownloadErrors
}: CalculationProgressDialogProps) {
  const percentComplete = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  const groupedErrors = useMemo((): GroupedErrors => {
    const groups: GroupedErrors = {
      missingRateStructure: [],
      missingStation: [],
      other: []
    };

    progress.errors.forEach(err => {
      if (err.error.includes('No active rate structure found')) {
        groups.missingRateStructure.push(err);
      } else if (err.error.includes('no associated station')) {
        groups.missingStation.push(err);
      } else {
        groups.other.push(err);
      }
    });

    return groups;
  }, [progress.errors]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isComplete ? 'Calculation Complete' : 'Calculating Billing...'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {isComplete
              ? 'All pending transactions have been processed'
              : 'Processing pending transactions, please wait...'}
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
            <span>Progress</span>
            <span className="font-semibold">
              {progress.processed} / {progress.total} ({Math.round(percentComplete)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete
                  ? progress.failed > 0
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="text-green-600" size={20} />
              <span className="text-sm font-medium text-green-900">Successful</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{progress.successful}</p>
          </div>

          {progress.skipped > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <SkipForward className="text-yellow-600" size={20} />
                <span className="text-sm font-medium text-yellow-900">Skipped</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{progress.skipped}</p>
            </div>
          )}

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <XCircle className="text-red-600" size={20} />
              <span className="text-sm font-medium text-red-900">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{progress.failed}</p>
          </div>
        </div>

        {!isComplete && progress.currentSessionId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center space-x-3">
            <Loader2 className="animate-spin text-blue-600" size={20} />
            <div className="text-sm text-blue-900">
              <span className="font-medium">Processing:</span>
              <span className="ml-2 font-mono text-xs">{progress.currentSessionId}</span>
            </div>
          </div>
        )}

        {progress.errors.length > 0 && (
          <div className="space-y-3 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-600 flex-shrink-0" size={18} />
                <span className="text-sm font-medium text-red-900">
                  Error Summary ({progress.errors.length} total)
                </span>
              </div>
              {onDownloadErrors && progress.errors.length > 0 && (
                <button
                  onClick={onDownloadErrors}
                  className="text-xs text-red-700 hover:text-red-800 flex items-center space-x-1"
                >
                  <Download size={14} />
                  <span>Download All</span>
                </button>
              )}
            </div>

            {groupedErrors.missingRateStructure.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="text-orange-600" size={16} />
                  <span className="text-sm font-medium text-orange-900">
                    Missing Rate Structures ({groupedErrors.missingRateStructure.length})
                  </span>
                </div>
                <p className="text-xs text-orange-700 mb-2">
                  These sessions cannot be calculated without active rate structures configured for their stations
                </p>
                <div className="max-h-24 overflow-y-auto">
                  <ul className="space-y-1">
                    {groupedErrors.missingRateStructure.slice(0, 5).map((err, idx) => (
                      <li key={idx} className="text-xs text-orange-800 font-mono">
                        {err.sessionId.slice(0, 8)}...
                      </li>
                    ))}
                    {groupedErrors.missingRateStructure.length > 5 && (
                      <li className="text-xs text-orange-700 italic">
                        And {groupedErrors.missingRateStructure.length - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {groupedErrors.missingStation.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="text-red-600" size={16} />
                  <span className="text-sm font-medium text-red-900">
                    Missing Station Assignment ({groupedErrors.missingStation.length})
                  </span>
                </div>
                <p className="text-xs text-red-700 mb-2">
                  These sessions need to be assigned to a station before calculation
                </p>
                <div className="max-h-24 overflow-y-auto">
                  <ul className="space-y-1">
                    {groupedErrors.missingStation.slice(0, 5).map((err, idx) => (
                      <li key={idx} className="text-xs text-red-800 font-mono">
                        {err.sessionId.slice(0, 8)}...
                      </li>
                    ))}
                    {groupedErrors.missingStation.length > 5 && (
                      <li className="text-xs text-red-700 italic">
                        And {groupedErrors.missingStation.length - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {groupedErrors.other.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="text-red-600" size={16} />
                  <span className="text-sm font-medium text-red-900">
                    Other Errors ({groupedErrors.other.length})
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto">
                  <ul className="space-y-1">
                    {groupedErrors.other.slice(0, 5).map((err, idx) => (
                      <li key={idx} className="text-xs text-red-800">
                        <span className="font-mono">{err.sessionId.slice(0, 8)}...</span>: {err.error}
                      </li>
                    ))}
                    {groupedErrors.other.length > 5 && (
                      <li className="text-xs text-red-700 italic">
                        And {groupedErrors.other.length - 5} more...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {isComplete && (
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        )}

        {!isComplete && (
          <div className="text-center text-sm text-gray-500">
            Please do not close this window during calculation
          </div>
        )}
      </div>
    </div>
  );
}
