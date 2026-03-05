import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, CheckCircle, AlertCircle, XCircle, Eye, Download, RefreshCw, StopCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getImportBatches, cancelImportBatch } from '../lib/importService';
import { Database } from '../lib/database.types';

type ImportBatch = Database['public']['Tables']['import_batches']['Row'];

interface ImportHistoryProps {
  refreshTrigger?: number;
}

export default function ImportHistory({ refreshTrigger }: ImportHistoryProps) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [batchToCancel, setBatchToCancel] = useState<ImportBatch | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user) {
      loadBatches();
    }
  }, [user, refreshTrigger]);

  async function loadBatches() {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getImportBatches(user.id);
      setBatches(data);
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle size={14} />
            <span>Completed</span>
          </span>
        );
      case 'completed_with_errors':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <AlertCircle size={14} />
            <span>Partial</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle size={14} />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
            <StopCircle size={14} />
            <span>Cancelled</span>
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <RefreshCw size={14} className="animate-spin" />
            <span>Processing</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            {status}
          </span>
        );
    }
  }

  function handleViewErrors(batch: ImportBatch) {
    setSelectedBatch(batch);
    setShowErrorModal(true);
  }

  function downloadErrorReport(batch: ImportBatch) {
    if (!batch.error_log) return;

    const log = batch.error_log as any;
    const errors = log.errors || [];
    const skipped = log.skipped || [];

    const csvLines = ['Type,Row,Transaction ID,Charge ID,Details'];

    skipped.forEach((skip: any) => {
      const row = skip.row || 'N/A';
      const transactionId = skip.session?.transactionId || 'N/A';
      const chargeId = skip.session?.chargeId || 'N/A';
      const reason = skip.reason || 'Already exists';
      csvLines.push(`Skipped,${row},"${transactionId}","${chargeId}","${reason}"`);
    });

    errors.forEach((error: any) => {
      const row = error.row || 'N/A';
      const transactionId = error.session?.transactionId || 'N/A';
      const chargeId = error.session?.chargeId || 'N/A';
      const errorMessages = error.errors?.join('; ') || 'Unknown error';
      csvLines.push(`Error,${row},"${transactionId}","${chargeId}","${errorMessages}"`);
    });

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-errors-${batch.id}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function handleCancelClick(batch: ImportBatch) {
    setBatchToCancel(batch);
    setShowCancelModal(true);
  }

  async function confirmCancelImport() {
    if (!batchToCancel) return;

    setCancelling(true);
    try {
      await cancelImportBatch(batchToCancel.id);
      await loadBatches();
      setShowCancelModal(false);
      setBatchToCancel(null);
    } catch (error) {
      console.error('Failed to cancel import:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel import');
    } finally {
      setCancelling(false);
    }
  }

  function getTimeSinceUpload(uploadDate: string): string {
    const now = new Date();
    const uploaded = new Date(uploadDate);
    const diffMs = now.getTime() - uploaded.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading import history...</div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <FileSpreadsheet className="mx-auto text-gray-400 mb-4" size={48} />
        <p className="text-gray-600 text-lg">No import history yet</p>
        <p className="text-gray-500 text-sm mt-2">Upload a file to see your import history here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Import History</h3>
          <button
            onClick={loadBatches}
            className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">File Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Upload Date</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Success</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Skipped</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Failed</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{batch.filename}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(batch.upload_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{batch.records_total}</td>
                  <td className="px-6 py-4 text-sm text-green-700 font-medium">
                    {batch.records_success}
                  </td>
                  <td className="px-6 py-4 text-sm text-yellow-700 font-medium">
                    {batch.records_skipped || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-700 font-medium">{batch.records_failed}</td>
                  <td className="px-6 py-4">{getStatusBadge(batch.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {batch.status === 'processing' && (
                        <button
                          onClick={() => handleCancelClick(batch)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Stop Processing"
                        >
                          <StopCircle size={16} />
                        </button>
                      )}
                      {(batch.records_failed > 0 || (batch.records_skipped && batch.records_skipped > 0)) && batch.error_log && (
                        <>
                          <button
                            onClick={() => handleViewErrors(batch)}
                            className="p-1 text-blue-600 hover:text-blue-700"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => downloadErrorReport(batch)}
                            className="p-1 text-gray-600 hover:text-gray-700"
                            title="Download Report"
                          >
                            <Download size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showErrorModal && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Import Details</h3>
              <button
                onClick={() => setShowErrorModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>File:</strong> {selectedBatch.filename}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Total Records:</strong> {selectedBatch.records_total}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Successful:</strong> {selectedBatch.records_success} |
                  <strong> Skipped:</strong> {selectedBatch.records_skipped || 0} |
                  <strong> Failed:</strong> {selectedBatch.records_failed}
                </p>
              </div>

              {selectedBatch.error_log && (
                <div className="space-y-4">
                  {(() => {
                    const log = selectedBatch.error_log as any;
                    const skipped = log.skipped || [];
                    const errors = log.errors || [];

                    return (
                      <>
                        {skipped.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                              Skipped Records ({skipped.length})
                            </h4>
                            <div className="space-y-2">
                              {skipped.map((skip: any, index: number) => (
                                <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                  <div className="flex items-start justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900">Row {skip.row}</span>
                                    <span className="text-xs text-gray-600">
                                      Charge ID: {skip.session?.chargeId || 'N/A'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-yellow-800">{skip.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {errors.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-red-800 mb-2">
                              Failed Records ({errors.length})
                            </h4>
                            <div className="space-y-2">
                              {errors.map((error: any, index: number) => (
                                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-900">Row {error.row}</span>
                                    <span className="text-xs text-gray-600">
                                      {error.session?.transactionId || 'N/A'}
                                    </span>
                                  </div>
                                  <ul className="space-y-1">
                                    {error.errors?.map((err: string, errIndex: number) => (
                                      <li key={errIndex} className="text-sm text-red-600 flex items-start space-x-2">
                                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                        <span>{err}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => downloadErrorReport(selectedBatch)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download size={18} />
                <span>Download Report</span>
              </button>
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && batchToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Stop Processing Import</h3>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setBatchToCancel(null);
                }}
                className="text-gray-500 hover:text-gray-700"
                disabled={cancelling}
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">Warning</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      This will mark the import as cancelled. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-700">
                  <strong>File:</strong> {batchToCancel.filename}
                </p>
                <p className="text-gray-700">
                  <strong>Upload Date:</strong> {new Date(batchToCancel.upload_date).toLocaleString()}
                </p>
                <p className="text-gray-700">
                  <strong>Time Elapsed:</strong> {getTimeSinceUpload(batchToCancel.upload_date)}
                </p>
                <p className="text-gray-700">
                  <strong>Progress:</strong> {batchToCancel.records_success} of {batchToCancel.records_total} records processed
                </p>
              </div>

              <p className="text-sm text-gray-600">
                The import will be marked as cancelled and will appear with a cancelled status in your history.
              </p>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setBatchToCancel(null);
                }}
                disabled={cancelling}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCancelImport}
                disabled={cancelling}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Stopping...</span>
                  </>
                ) : (
                  <>
                    <StopCircle size={18} />
                    <span>Stop Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
