import { AlertTriangle, Check, X } from 'lucide-react';
import { DuplicateCheckResult } from '../lib/duplicateCheckService';

interface Props {
  result: DuplicateCheckResult;
  onContinue: () => void;
  onCancel: () => void;
}

export default function DuplicatePreviewModal({ result, onContinue, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Duplicates Found</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.duplicateCount} of {result.totalRows} rows already exist
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{result.newCount}</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">New Rows</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{result.duplicateCount}</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Duplicates (skipped)</p>
          </div>
        </div>

        {/* Duplicate IDs */}
        {result.duplicateIds.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duplicate Transaction IDs:</p>
            <div className="max-h-[120px] overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-xs text-gray-600 dark:text-gray-400 font-mono space-y-0.5">
              {result.duplicateIds.slice(0, 20).map(id => (
                <div key={id} className="truncate">{id}</div>
              ))}
              {result.duplicateIds.length > 20 && (
                <div className="text-gray-400 italic">...and {result.duplicateIds.length - 20} more</div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm flex items-center justify-center gap-1"
          >
            <X size={14} /> Cancel
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-1"
          >
            <Check size={14} /> Continue with {result.newCount} rows
          </button>
        </div>
      </div>
    </div>
  );
}
