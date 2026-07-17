import React from 'react';
import { FileText, FileSpreadsheet, FileDown, Printer, Loader2 } from 'lucide-react';

interface ReportExportToolbarProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onPrint?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function ReportExportToolbar({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  onPrint,
  loading,
  disabled,
}: ReportExportToolbarProps) {
  const btnBase =
    'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Export:</span>

      <button
        onClick={onExportPDF}
        disabled={disabled || loading}
        className={`${btnBase} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        PDF
      </button>

      <button
        onClick={onExportExcel}
        disabled={disabled || loading}
        className={`${btnBase} bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
        Excel
      </button>

      <button
        onClick={onExportCSV}
        disabled={disabled || loading}
        className={`${btnBase} bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        CSV
      </button>

      {onPrint && (
        <button
          onClick={onPrint}
          disabled={disabled || loading}
          className={`${btnBase} bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600`}
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
      )}
    </div>
  );
}
