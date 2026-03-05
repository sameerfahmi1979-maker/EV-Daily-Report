import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { parseExcelFile, processBatch, createImportBatch, downloadSampleTemplate, CancelToken } from '../lib/importService';
import { getStations } from '../lib/stationService';
import { Database } from '../lib/database.types';

type Station = Database['public']['Tables']['stations']['Row'];

interface FileUploadProps {
  onImportComplete: () => void;
  onNavigateToBilling: () => void;
}

export default function FileUpload({ onImportComplete, onNavigateToBilling }: FileUploadProps) {
  const { user } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: { total: number; success: number; skipped: number; failed: number };
  } | null>(null);
  const cancelTokenRef = useRef<CancelToken>({ cancelled: false });

  useEffect(() => {
    loadStations();
  }, []);

  async function loadStations() {
    try {
      const data = await getStations();
      setStations(data);
      if (data.length > 0) {
        setSelectedStation(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  }

  function handleFileSelection(selectedFile: File) {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
      setResult({
        success: false,
        message: 'Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)'
      });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setResult({
        success: false,
        message: 'File size exceeds 10MB limit'
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
  }

  async function handleUpload() {
    if (!file || !user) return;

    if (!selectedStation) {
      setResult({
        success: false,
        message: 'Please select a station for this import'
      });
      return;
    }

    cancelTokenRef.current = { cancelled: false };
    setProcessing(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      const sessions = await parseExcelFile(file);

      if (sessions.length === 0) {
        setResult({
          success: false,
          message: 'No valid data found in file'
        });
        setProcessing(false);
        return;
      }

      const batchId = await createImportBatch(file.name, sessions.length, user.id);

      setProgress({ current: 0, total: sessions.length });

      const importResult = await processBatch(
        sessions,
        batchId,
        selectedStation,
        (current, total) => {
          setProgress({ current, total });
        },
        cancelTokenRef.current
      );

      if (cancelTokenRef.current.cancelled) {
        setResult({
          success: false,
          message: `Import cancelled. ${importResult.successCount} records were imported before cancellation.`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount
          }
        });
      } else if (importResult.failureCount === 0 && importResult.skippedCount === 0) {
        setResult({
          success: true,
          message: `Successfully imported ${importResult.successCount} charging sessions`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount
          }
        });
      } else if (importResult.failureCount === 0 && importResult.skippedCount > 0) {
        setResult({
          success: true,
          message: `Successfully imported ${importResult.successCount} new sessions. ${importResult.skippedCount} records skipped (duplicate Transaction IDs)`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount
          }
        });
      } else if (importResult.successCount > 0) {
        const parts = [];
        if (importResult.successCount > 0) parts.push(`${importResult.successCount} imported`);
        if (importResult.skippedCount > 0) parts.push(`${importResult.skippedCount} skipped`);
        if (importResult.failureCount > 0) parts.push(`${importResult.failureCount} failed`);

        setResult({
          success: true,
          message: `Import completed: ${parts.join(', ')}`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount
          }
        });
      } else {
        setResult({
          success: false,
          message: `Import failed. ${importResult.failureCount} records had errors${importResult.skippedCount > 0 ? `, ${importResult.skippedCount} skipped` : ''}`,
          details: {
            total: importResult.totalRecords,
            success: importResult.successCount,
            skipped: importResult.skippedCount,
            failed: importResult.failureCount
          }
        });
      }

      setFile(null);
      onImportComplete();
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import file'
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleClearFile() {
    setFile(null);
    setResult(null);
    setProgress({ current: 0, total: 0 });
  }

  function handleCancelImport() {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancelled = true;
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">File Format Requirements</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Accepted formats: .xlsx, .xls, .csv</li>
          <li>• Maximum file size: 10MB</li>
          <li>• DateTime format: YYYY-MM-DD HH:MM:SS (e.g., 2025-01-15 14:30:00)</li>
          <li>• All times will be interpreted as Asia/Amman timezone</li>
          <li>
            • Required columns: Transaction ID, Charge ID, Card Number, Start DateTime, End DateTime, Energy (kWh), Cost (JOD)
          </li>
          <li>• Optional columns: Station Code, Max Demand (kW), User ID</li>
          <li className="font-semibold">• Transaction ID must be unique - duplicate Transaction IDs will be skipped</li>
          <li>• All other columns can contain duplicate values</li>
        </ul>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Target Station <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedStation}
          onChange={(e) => setSelectedStation(e.target.value)}
          disabled={processing}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        >
          <option value="">Select a station...</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.name} {station.station_code ? `(${station.station_code})` : ''}
            </option>
          ))}
        </select>
        <p className="text-sm text-gray-600 mt-1">All imported sessions will be associated with this station</p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : file
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        {file ? (
          <div className="space-y-4">
            <FileSpreadsheet className="mx-auto text-green-600" size={48} />
            <div>
              <p className="text-lg font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
            {!processing && (
              <button
                onClick={handleClearFile}
                className="text-red-600 hover:text-red-700 text-sm underline"
              >
                Remove file
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="mx-auto text-gray-400" size={48} />
            <div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drag and drop your file here
              </p>
              <p className="text-sm text-gray-600 mb-4">or</p>
              <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
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

      {processing && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <span className="text-lg font-medium text-gray-900">Processing...</span>
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
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Please wait while we import your charging sessions...
          </p>
        </div>
      )}

      {result && (
        <div
          className={`border rounded-lg p-6 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start space-x-3">
            {result.success ? (
              <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
            ) : (
              <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            )}
            <div className="flex-1">
              <p className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                {result.message}
              </p>
              {result.details && (
                <>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                      Total Records: {result.details.total}
                    </p>
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                      Successful: {result.details.success}
                    </p>
                    {result.details.skipped > 0 && (
                      <p className="text-yellow-800">
                        Skipped (Duplicate Transaction IDs): {result.details.skipped}
                      </p>
                    )}
                    {result.details.failed > 0 && (
                      <p className={result.success ? 'text-orange-800' : 'text-red-800'}>
                        Failed: {result.details.failed}
                      </p>
                    )}
                  </div>
                  {result.success && result.details.success > 0 && (
                    <button
                      onClick={onNavigateToBilling}
                      className="mt-4 w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <CheckCircle size={20} />
                      <span>View & Calculate Transactions</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {file && !processing && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!selectedStation}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Upload size={20} />
            <span>Import Sessions</span>
          </button>
        </div>
      )}
    </div>
  );
}
