import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, XCircle, ArrowRight, ArrowLeft, Clock, Table2, Rocket, Trash2, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { parseExcelFile, processBatch, createImportBatch, downloadSampleTemplate, CancelToken, validateSession, getImportBatches, deleteImportBatchCascade } from '../lib/importService';
import { createShift, linkSessionsToShift } from '../lib/shiftService';
import SpreadsheetPreview from './SpreadsheetPreview';
import ShiftSelector, { ShiftSelection } from './ShiftSelector';
import type { ParsedSession } from '../lib/importService';

interface FileUploadProps {
  onImportComplete: () => void;
  onNavigateToBilling: () => void;
}

type WizardStep = 'setup' | 'preview' | 'upload';

export default function FileUpload({ onImportComplete, onNavigateToBilling }: FileUploadProps) {
  const { user } = useAuth();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('setup');
  
  // Step 1: Setup
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [shiftSelection, setShiftSelection] = useState<ShiftSelection | null>(null);

  // Step 2: Preview
  const [parsedSessions, setParsedSessions] = useState<ParsedSession[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 3: Upload
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: { total: number; success: number; skipped: number; failed: number };
  } | null>(null);
  const cancelTokenRef = useRef<CancelToken>({ cancelled: false });

  // Import batch history
  const [batches, setBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);

  // Load batch history
  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const data = await getImportBatches();
      setBatches(data || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Validation metrics
  const validationMetrics = useMemo(() => {
    let errors = 0;
    parsedSessions.forEach((session, idx) => {
      if (validateSession(session, idx + 1).length > 0) errors++;
    });
    return { total: parsedSessions.length, valid: parsedSessions.length - errors, errors };
  }, [parsedSessions]);

  // ===========================
  // Step 1: Setup handlers
  // ===========================
  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0]);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) handleFileSelection(e.target.files[0]);
  }

  function handleFileSelection(selectedFile: File) {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));

    if (!validExtensions.includes(ext)) {
      setParseError('Invalid file type. Please upload .xlsx, .xls, or .csv');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setParseError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    setResult(null);
  }

  // ===========================
  // Parse & go to Preview
  // ===========================
  async function handleParseAndPreview() {
    if (!file) return;
    setParseError(null);

    try {
      const sessions = await parseExcelFile(file);
      if (sessions.length === 0) {
        setParseError('No valid data found in file');
        return;
      }
      setParsedSessions(sessions);
      setStep('preview');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    }
  }

  // ===========================
  // Step 3: Upload to database
  // ===========================
  async function handleUpload() {
    if (!user || !shiftSelection || parsedSessions.length === 0) return;

    cancelTokenRef.current = { cancelled: false };
    setStep('upload');
    setProcessing(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      // 1. Create import batch
      const batchId = await createImportBatch(file!.name, parsedSessions.length, user.id);

      // 2. Create shift record using the actual times the operator entered
      const shiftStartStr = `${shiftSelection.shiftDate}T${shiftSelection.startTime}:00`;

      // Determine if end time is on the next day
      // If end time <= start time (e.g., start 16:00, end 00:00 or start 20:00, end 08:00), it crosses midnight
      const startMinutes = parseInt(shiftSelection.startTime.split(':')[0]) * 60 + parseInt(shiftSelection.startTime.split(':')[1]);
      const endMinutes = parseInt(shiftSelection.endTime.split(':')[0]) * 60 + parseInt(shiftSelection.endTime.split(':')[1]);
      const crossesMidnight = endMinutes <= startMinutes;

      const shiftEndStr = crossesMidnight
        ? (() => {
            const nextDay = new Date(shiftSelection.shiftDate);
            nextDay.setDate(nextDay.getDate() + 1);
            return `${nextDay.toISOString().split('T')[0]}T${shiftSelection.endTime}:00`;
          })()
        : `${shiftSelection.shiftDate}T${shiftSelection.endTime}:00`;

      const shift = await createShift({
        station_id: shiftSelection.stationId,
        operator_id: shiftSelection.operatorId,
        shift_duration: shiftSelection.shiftDuration,
        shift_type: shiftSelection.shiftType,
        shift_date: shiftSelection.shiftDate,
        start_time: shiftStartStr,
        end_time: shiftEndStr,
        import_batch_id: batchId,
      });

      // 3. Bulk insert sessions
      setProgress({ current: 0, total: parsedSessions.length });

      const importResult = await processBatch(
        parsedSessions,
        batchId,
        shiftSelection.stationId,
        (current, total) => setProgress({ current, total }),
        cancelTokenRef.current
      );

      // 4. Link sessions to shift
      if (importResult.successCount > 0) {
        await linkSessionsToShift(batchId, shift.id, shiftSelection.operatorId);
      }

      // 5. Show results
      if (cancelTokenRef.current.cancelled) {
        setResult({
          success: false,
          message: `Import cancelled. ${importResult.successCount} records imported before cancellation.`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount,
          },
        });
      } else {
        const parts = [];
        if (importResult.successCount > 0) parts.push(`${importResult.successCount} imported`);
        if (importResult.skippedCount > 0) parts.push(`${importResult.skippedCount} skipped`);
        if (importResult.failureCount > 0) parts.push(`${importResult.failureCount} failed`);

        setResult({
          success: importResult.successCount > 0,
          message: importResult.failureCount === 0 && importResult.skippedCount === 0
            ? `✅ Successfully imported ${importResult.successCount} sessions and created shift record`
            : `Import completed: ${parts.join(', ')}`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount,
          },
        });
      }

      setFile(null);
      onImportComplete();
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import file',
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleReset() {
    setStep('setup');
    setFile(null);
    setParsedSessions([]);
    setParseError(null);
    setResult(null);
    setProgress({ current: 0, total: 0 });
  }

  function handleCancelImport() {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancelled = true;
    }
  }

  async function handleDeleteBatch(batchId: string) {
    setDeletingBatch(true);
    try {
      const result = await deleteImportBatchCascade(batchId);
      alert(`✅ Deleted "${result.filename}":\n• ${result.sessions_deleted} sessions\n• ${result.billing_deleted} billing records\n• ${result.shifts_deleted} shifts`);
      setDeletingBatchId(null);
      await loadBatches();
      onImportComplete(); // Refresh parent data
    } catch (err) {
      console.error('Failed to delete batch:', err);
      alert('Failed to delete import batch');
    } finally {
      setDeletingBatch(false);
    }
  }

  const canProceedToPreview = !!file && !!shiftSelection;
  const canProceedToUpload = validationMetrics.valid > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Import Charging Sessions</h2>
          <p className="text-gray-600 mt-1">Upload Excel or CSV files with charging session data</p>
        </div>
        <button
          onClick={downloadSampleTemplate}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download size={18} />
          <span>Download Template</span>
        </button>
      </div>

      {/* Wizard Steps Indicator */}
      <div className="flex items-center gap-4">
        {[
          { key: 'setup', label: 'Setup & File', icon: Clock, num: 1 },
          { key: 'preview', label: 'Preview & Edit', icon: Table2, num: 2 },
          { key: 'upload', label: 'Upload', icon: Rocket, num: 3 },
        ].map(({ key, label, icon: Icon, num }, idx) => {
          const stepOrder = { setup: 0, preview: 1, upload: 2 };
          const currentOrder = stepOrder[step];
          const thisOrder = stepOrder[key as WizardStep];
          const isActive = step === key;
          const isPast = thisOrder < currentOrder;

          return (
            <React.Fragment key={key}>
              {idx > 0 && (
                <div className={`flex-1 h-0.5 ${isPast ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                    isPast ? 'bg-blue-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isPast ? <CheckCircle size={16} /> : num}
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : isPast ? 'text-blue-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ==================== STEP 1: SETUP ==================== */}
      {step === 'setup' && (
        <>
          {/* Shift Selector */}
          <ShiftSelector value={shiftSelection} onChange={setShiftSelection} />

          {/* File Format Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">File Format Requirements</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Accepted formats: .xlsx, .xls, .csv</li>
              <li>• Maximum file size: 10MB</li>
              <li>• DateTime format: YYYY-MM-DD HH:MM:SS (e.g., 2025-01-15 14:30:00)</li>
              <li>• Required columns: Transaction ID, Charge ID, Card Number, Start DateTime, End DateTime, Energy (kWh), Cost (JOD)</li>
              <li className="font-semibold">• Transaction ID must be unique — duplicates will be skipped</li>
            </ul>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
              dragActive ? 'border-blue-500 bg-blue-50 scale-[1.01]' :
              file ? 'border-emerald-500 bg-emerald-50' :
              'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            {file ? (
              <div className="space-y-3">
                <FileSpreadsheet className="mx-auto text-emerald-600" size={48} />
                <p className="text-lg font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                <button
                  onClick={() => { setFile(null); setParseError(null); }}
                  className="text-red-600 hover:text-red-700 text-sm underline"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto text-gray-400" size={48} />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-gray-600 mb-4">or</p>
                  <label className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-medium">
                    <span>Browse Files</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <span className="text-red-800 text-sm">{parseError}</span>
            </div>
          )}

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={handleParseAndPreview}
              disabled={!canProceedToPreview}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              <span>Parse & Preview</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* ==================== STEP 2: PREVIEW ==================== */}
      {step === 'preview' && (
        <>
          {/* Shift summary reminder */}
          {shiftSelection && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 flex items-center gap-4 text-sm">
              <Clock size={18} className="text-blue-600 flex-shrink-0" />
              <span>
                <strong>{shiftSelection.stationName}</strong> → <strong>{shiftSelection.operatorName}</strong> → {' '}
                <strong>{shiftSelection.startTime} — {shiftSelection.endTime}</strong> on <strong>{shiftSelection.shiftDate}</strong>
              </span>
            </div>
          )}

          {/* Spreadsheet Preview */}
          <SpreadsheetPreview
            sessions={parsedSessions}
            onSessionsChange={setParsedSessions}
          />

          {/* Nav Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('setup')}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
            >
              <ArrowLeft size={18} />
              <span>Back to Setup</span>
            </button>

            <div className="flex items-center gap-4">
              {validationMetrics.errors > 0 && (
                <span className="text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  ⚠️ {validationMetrics.errors} rows have errors — they will be skipped
                </span>
              )}
              <button
                onClick={handleUpload}
                disabled={!canProceedToUpload}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md shadow-emerald-100"
              >
                <Upload size={18} />
                <span>Upload {validationMetrics.valid} Sessions to Database</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================== STEP 3: UPLOAD ==================== */}
      {step === 'upload' && (
        <>
          {/* Progress Bar */}
          {processing && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                  <span className="text-lg font-medium text-gray-900">Uploading sessions...</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {progress.current} / {progress.total}
                  </span>
                  <button
                    onClick={handleCancelImport}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <XCircle size={16} />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Creating shift record and inserting charging sessions...
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={`border rounded-xl p-6 ${
                result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                {result.success ? (
                  <CheckCircle className="text-emerald-600 flex-shrink-0" size={28} />
                ) : (
                  <AlertCircle className="text-red-600 flex-shrink-0" size={28} />
                )}
                <div className="flex-1">
                  <p className={`font-semibold text-lg ${result.success ? 'text-emerald-900' : 'text-red-900'}`}>
                    {result.message}
                  </p>
                  {result.details && (
                    <div className="mt-3 grid grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-white/60">
                        <p className="text-2xl font-bold text-gray-900">{result.details.total}</p>
                        <p className="text-xs text-gray-600">Total</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-white/60">
                        <p className="text-2xl font-bold text-emerald-700">{result.details.success}</p>
                        <p className="text-xs text-emerald-600">Imported</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-white/60">
                        <p className="text-2xl font-bold text-amber-700">{result.details.skipped}</p>
                        <p className="text-xs text-amber-600">Skipped</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-white/60">
                        <p className="text-2xl font-bold text-red-700">{result.details.failed}</p>
                        <p className="text-xs text-red-600">Failed</p>
                      </div>
                    </div>
                  )}
                  {result.success && result.details && result.details.success > 0 && (
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={onNavigateToBilling}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <CheckCircle size={18} />
                        <span>View & Calculate Transactions</span>
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
                      >
                        <Upload size={18} />
                        <span>Upload Another File</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reset if error */}
          {result && !result.success && (
            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
              >
                <ArrowLeft size={18} />
                <span>Start Over</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ==================== IMPORT HISTORY ==================== */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Import History</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{batches.length}</span>
          </div>
          <button
            onClick={loadBatches}
            disabled={loadingBatches}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {loadingBatches ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loadingBatches && batches.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Loading import history...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No imports yet. Upload a file above to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Success</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Skipped</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Failed</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch: any) => (
                  <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-emerald-600 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate max-w-[200px]" title={batch.filename}>
                          {batch.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {batch.upload_date ? new Date(batch.upload_date).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{batch.records_total || 0}</td>
                    <td className="px-4 py-3 text-center font-mono text-emerald-700">{batch.records_success || 0}</td>
                    <td className="px-4 py-3 text-center font-mono text-amber-700">{batch.records_skipped || 0}</td>
                    <td className="px-4 py-3 text-center font-mono text-red-700">{batch.records_failed || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        batch.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        batch.status === 'completed_with_errors' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        batch.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                        batch.status === 'processing' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}>
                        {batch.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDeletingBatchId(batch.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete this batch and all related records"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== DELETE BATCH CONFIRMATION ==================== */}
      {deletingBatchId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => !deletingBatch && setDeletingBatchId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Upload?</h3>
                <p className="text-sm text-gray-500">
                  This will permanently delete:
                </p>
              </div>
            </div>
            <ul className="text-sm text-gray-700 bg-red-50 rounded-lg p-3 mb-4 space-y-1">
              <li>• All charging sessions from this file</li>
              <li>• All billing calculations for those sessions</li>
              <li>• The shift record linked to this upload</li>
              <li>• The import batch record itself</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingBatchId(null)}
                disabled={deletingBatch}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBatch(deletingBatchId)}
                disabled={deletingBatch}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingBatch ? (
                  <><Loader2 size={16} className="animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 size={16} /> Delete Everything</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
