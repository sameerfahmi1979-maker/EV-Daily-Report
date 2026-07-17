import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';
import { ParsedSession, validateSession } from '../lib/importService';

interface SpreadsheetPreviewProps {
  sessions: ParsedSession[];
  onSessionsChange: (sessions: ParsedSession[]) => void;
  readOnly?: boolean;
}

interface ColumnDef {
  key: string;
  label: string;
  width: string;
  editable: boolean;
  numeric?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'transactionId', label: 'Transaction ID', width: '140px', editable: true },
  { key: 'chargeId', label: 'Charge ID', width: '120px', editable: true },
  { key: 'cardNumber', label: 'Card Number', width: '130px', editable: true },
  { key: 'startDateTime', label: 'Start DateTime', width: '180px', editable: true },
  { key: 'endDateTime', label: 'End DateTime', width: '180px', editable: true },
  { key: 'energyKwh', label: 'Energy (kWh)', width: '110px', editable: true, numeric: true },
  { key: 'cost', label: 'Cost (JOD)', width: '100px', editable: true, numeric: true },
  { key: 'connectorNumber', label: 'Connector #', width: '100px', editable: false },
  { key: 'connectorType', label: 'Connector Type', width: '110px', editable: false },
  { key: 'durationText', label: 'Duration', width: '100px', editable: false },
  { key: 'maxDemandKw', label: 'Max kW', width: '80px', editable: true, numeric: true },
];

type ColumnKey = string;

const PAGE_SIZE = 25;

export default function SpreadsheetPreview({
  sessions,
  onSessionsChange,
  readOnly = false,
}: SpreadsheetPreviewProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: ColumnKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'errors'>('all');

  // Validate all sessions
  const validationMap = useMemo(() => {
    const map: Record<number, Record<string, string>> = {};
    sessions.forEach((session, idx) => {
      const errors = validateSession(session, idx + 1);
      if (errors.length > 0) {
        const fieldErrors: Record<string, string> = {};
        errors.forEach(err => {
          const errLower = err.toLowerCase();
          if (errLower.includes('transaction')) fieldErrors.transactionId = err;
          else if (errLower.includes('charge id')) fieldErrors.chargeId = err;
          else if (errLower.includes('card')) fieldErrors.cardNumber = err;
          else if (errLower.includes('start') && errLower.includes('date')) fieldErrors.startDateTime = err;
          else if (errLower.includes('end') && errLower.includes('date')) fieldErrors.endDateTime = err;
          else if (errLower.includes('energy')) fieldErrors.energyKwh = err;
          else if (errLower.includes('cost')) fieldErrors.cost = err;
          else if (errLower.includes('demand')) fieldErrors.maxDemandKw = err;
          else if (errLower.includes('duration')) {
            fieldErrors.startDateTime = err;
            fieldErrors.endDateTime = err;
          }
          else if (errLower.includes('soc')) {
            if (errLower.includes('start')) fieldErrors.startDateTime = err;
            else fieldErrors.endDateTime = err;
          }
          else fieldErrors._general = (fieldErrors._general ? fieldErrors._general + '; ' : '') + err;
        });
        map[idx] = fieldErrors;
      }
    });
    return map;
  }, [sessions]);

  const errorCount = Object.keys(validationMap).length;
  const validCount = sessions.length - errorCount;

  // Filter rows
  const filteredIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < sessions.length; i++) {
      if (filterMode === 'errors' && !validationMap[i]) continue;
      indices.push(i);
    }
    return indices;
  }, [sessions, validationMap, filterMode]);

  // Paginate
  const totalPages = Math.ceil(filteredIndices.length / PAGE_SIZE);
  const pageIndices = filteredIndices.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const startEdit = useCallback((rowIdx: number, colKey: ColumnKey) => {
    if (readOnly) return;
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;

    setEditingCell({ row: rowIdx, col: colKey });
    const value = sessions[rowIdx][colKey as keyof ParsedSession];
    setEditValue(value !== undefined && value !== null ? String(value) : '');
  }, [readOnly, sessions]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const colDef = COLUMNS.find(c => c.key === col);
    
    const updated = [...sessions];
    const session = { ...updated[row] };

    if (colDef?.numeric) {
      const num = parseFloat(editValue);
      (session as any)[col] = isNaN(num) ? 0 : num;
    } else {
      (session as any)[col] = editValue;
    }

    updated[row] = session;
    onSessionsChange(updated);
    setEditingCell(null);
  }, [editingCell, editValue, sessions, onSessionsChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Move to next editable cell
      if (editingCell) {
        const editableCols = COLUMNS.filter(c => c.editable);
        const currentIdx = editableCols.findIndex(c => c.key === editingCell.col);
        const nextCol = editableCols[(currentIdx + 1) % editableCols.length];
        const nextRow = currentIdx + 1 >= editableCols.length ? editingCell.row + 1 : editingCell.row;
        if (nextRow < sessions.length) {
          startEdit(nextRow, nextCol.key as ColumnKey);
        }
      }
    }
  }, [commitEdit, editingCell, sessions.length, startEdit]);

  const getCellValue = (session: ParsedSession, key: string): string => {
    const value = (session as any)[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') return value.toFixed(3);
    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Total Rows:</span>
            <span className="text-lg font-bold text-gray-900">{sessions.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">{validCount} Valid</span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <span className="text-sm font-medium text-red-700">{errorCount} Errors</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setFilterMode('all'); setCurrentPage(0); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Rows
          </button>
          {errorCount > 0 && (
            <button
              onClick={() => { setFilterMode('errors'); setCurrentPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterMode === 'errors'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-red-600 border border-red-300 hover:bg-red-50'
              }`}
            >
              Errors Only ({errorCount})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-3 text-left text-xs font-semibold w-12">#</th>
                <th className="px-2 py-3 text-center text-xs font-semibold w-10">Status</th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-left text-xs font-semibold whitespace-nowrap"
                    style={{ minWidth: col.width }}
                  >
                    {col.label}
                    {col.editable && !readOnly && (
                      <Edit3 size={10} className="inline ml-1 opacity-50" />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageIndices.map((rowIdx) => {
                const session = sessions[rowIdx];
                const rowErrors = validationMap[rowIdx];
                const hasErrors = !!rowErrors;

                return (
                  <tr
                    key={rowIdx}
                    className={`border-b transition-colors ${
                      hasErrors
                        ? 'bg-red-50 hover:bg-red-100'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                      {rowIdx + 1}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {hasErrors ? (
                        <div className="relative group">
                          <AlertTriangle size={16} className="text-red-500 mx-auto" />
                          <div className="absolute left-6 top-0 z-20 hidden group-hover:block">
                            <div className="bg-gray-900 text-white text-xs rounded-lg p-2 shadow-xl whitespace-nowrap max-w-xs">
                              {Object.values(rowErrors).map((err, i) => (
                                <div key={i}>• {err}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                      )}
                    </td>
                    {COLUMNS.map(col => {
                      const cellError = rowErrors?.[col.key];
                      const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key;
                      const value = getCellValue(session, col.key);

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2 font-mono text-xs ${
                            cellError
                              ? 'bg-red-100 border-l-2 border-red-400'
                              : ''
                          } ${col.editable && !readOnly ? 'cursor-text' : ''}`}
                          onDoubleClick={() => col.editable && startEdit(rowIdx, col.key as ColumnKey)}
                          title={cellError || ''}
                        >
                          {isEditing ? (
                            <input
                              type={col.numeric ? 'number' : 'text'}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              step={col.numeric ? '0.001' : undefined}
                              className="w-full px-1 py-0.5 border-2 border-blue-500 rounded text-xs font-mono bg-white outline-none"
                            />
                          ) : (
                            <span className={`${cellError ? 'text-red-800 font-medium' : 'text-gray-700'} truncate block`}>
                              {value || <span className="text-gray-300 italic">empty</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-gray-500">
            Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredIndices.length)} of {filteredIndices.length} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-gray-600">
              Page {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Edit hint */}
      {!readOnly && (
        <p className="text-xs text-gray-400 text-center">
          💡 Double-click any cell to edit. Press <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-gray-600">Enter</kbd> to save, <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-gray-600">Tab</kbd> to move next, <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-gray-600">Esc</kbd> to cancel.
        </p>
      )}
    </div>
  );
}
