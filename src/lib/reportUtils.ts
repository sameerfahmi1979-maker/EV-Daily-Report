// =============================================
// reportUtils.ts
// Shared utilities for all report tabs:
//  - Paginated Supabase fetch
//  - Branded PDF header / footer
//  - Arabic font registration
//  - Excel / CSV / download helpers
// =============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from './supabase';
import { getAllSettings, type SettingsMap } from './settingsService';
import { formatJOD } from './billingService';
import { amiriRegularBase64 } from '../fonts/amiri-regular';

// Re-export for convenience
export { formatJOD };

// ─── Paginated Supabase fetch (bypasses 1000-row limit) ─────────────
const PAGE_SIZE = 1000;

export async function fetchAllRows(
  tableName: string,
  selectStr: string,
  buildFilters: (q: any) => any,
  orderCol = 'start_ts',
  ascending = false
): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let q = supabase
      .from(tableName as any)
      .select(selectStr)
      .order(orderCol, { ascending })
      .range(from, from + PAGE_SIZE - 1);
    q = buildFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    allData = allData.concat(data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) hasMore = false;
  }
  return allData;
}

// ─── Arabic text detection ──────────────────────────────────────────
export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// ─── Register Amiri Arabic font ─────────────────────────────────────
export function registerAmiriFont(doc: jsPDF) {
  doc.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
}

// ─── Fetch logo as base64 ───────────────────────────────────────────
export async function fetchLogoBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Could not fetch logo:', e);
    return null;
  }
}

// ─── Branded PDF header (logo + company info + title) ───────────────
export async function addBrandedPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle?: string
): Promise<number> {
  const s = await getAllSettings();
  let y = 15;
  let logoWidth = 0;

  // Register Arabic font
  registerAmiriFont(doc);

  // Logo
  const logoUrl = s.company_logo_url;
  if (logoUrl) {
    try {
      const base64 = await fetchLogoBase64(logoUrl);
      if (base64) {
        const logoH = 15;
        const img = new Image();
        img.src = base64;
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        });
        const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        logoWidth = logoH * aspect;
        doc.addImage(base64, 'PNG', 14, y - 5, logoWidth, logoH);
      }
    } catch (e) {
      console.warn('Failed to add logo to PDF:', e);
    }
  }

  // Company name
  const textX = logoWidth > 0 ? 14 + logoWidth + 4 : 14;
  const companyName = s.company_name || 'EV Charging Station';

  if (containsArabic(companyName)) {
    doc.setFontSize(16);
    doc.setFont('Amiri', 'normal');
    doc.text(companyName, textX, y);
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, textX, y);
  }
  y += 6;

  if (s.company_address && s.show_company_address !== 'false') {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(s.company_address, textX, y);
    y += 4;
  }
  const contactParts: string[] = [];
  if (s.company_phone) contactParts.push(`Tel: ${s.company_phone}`);
  if (s.company_email) contactParts.push(`Email: ${s.company_email}`);
  if (contactParts.length) {
    doc.setFontSize(7);
    doc.text(contactParts.join('  |  '), textX, y);
    y += 6;
  }

  if (logoWidth > 0) y = Math.max(y, 28);

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, doc.internal.pageSize.width - 14, y);
  y += 6;

  // Report title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(title, 14, y);
  y += 5;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, 14, y);
    y += 5;
  }

  doc.setTextColor(0);
  y += 2;
  return y;
}

// ─── Branded PDF footer (page numbers + timestamp) ──────────────────
export function addPdfFooter(doc: jsPDF, footerText?: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.height;
    const w = doc.internal.pageSize.width;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, w - 14, h - 8, { align: 'right' });
    if (footerText) {
      doc.text(footerText, 14, h - 8);
    }
    doc.text(
      `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      w / 2,
      h - 8,
      { align: 'center' }
    );
  }
}

// ─── Get settings (convenience) ─────────────────────────────────────
export async function getSettings(): Promise<SettingsMap> {
  return await getAllSettings();
}

// ─── Download helpers ───────────────────────────────────────────────

/** Trigger browser download from a Blob */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Save a jsPDF as a downloaded file */
export function downloadPdf(doc: jsPDF, filename: string) {
  const blob = doc.output('blob');
  downloadBlob(blob, filename);
}

// ─── Excel helpers ──────────────────────────────────────────────────

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
  format?: (value: any) => string;
}

/** Build an XLSX workbook from rows + column definitions and trigger download */
export function exportToExcel(
  rows: Record<string, any>[],
  columns: ColumnDef[],
  filename: string,
  sheetName = 'Report'
) {
  const exportData = rows.map((row) => {
    const obj: Record<string, any> = {};
    for (const col of columns) {
      const val = row[col.key];
      obj[col.header] = col.format ? col.format(val) : val ?? '';
    }
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** Build a multi-sheet XLSX workbook and trigger download */
export function exportToExcelMultiSheet(
  sheets: Array<{
    name: string;
    rows: Record<string, any>[];
    columns: ColumnDef[];
  }>,
  filename: string
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const exportData = sheet.rows.map((row) => {
      const obj: Record<string, any> = {};
      for (const col of sheet.columns) {
        const val = row[col.key];
        obj[col.header] = col.format ? col.format(val) : val ?? '';
      }
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = sheet.columns.map((c) => ({ wch: c.width || 15 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, filename);
}

// ─── CSV helper ─────────────────────────────────────────────────────

/** Build a CSV from rows + column definitions and trigger download */
export function exportToCSV(
  rows: Record<string, any>[],
  columns: ColumnDef[],
  filename: string
) {
  const exportData = rows.map((row) => {
    const obj: Record<string, any> = {};
    for (const col of columns) {
      const val = row[col.key];
      obj[col.header] = col.format ? col.format(val) : val ?? '';
    }
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

// ─── Filter summary for PDF headers ────────────────────────────────

export interface FilterSummary {
  period?: string;
  station?: string;
  operator?: string;
  shiftType?: string;
  status?: string;
  extra?: string;
}

/** Render a single-line filter summary onto a PDF doc */
export function addFilterSummary(
  doc: jsPDF,
  filters: FilterSummary,
  y: number
): number {
  const parts: string[] = [];
  if (filters.period) parts.push(`Period: ${filters.period}`);
  if (filters.station) parts.push(`Station: ${filters.station}`);
  if (filters.operator) parts.push(`Operator: ${filters.operator}`);
  if (filters.shiftType) parts.push(`Shift: ${filters.shiftType}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.extra) parts.push(filters.extra);

  if (parts.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(parts.join('  •  '), 14, y);
    y += 5;
  }
  return y;
}

// ─── Summary box for PDF (highlight strip) ──────────────────────────

/** Render a highlighted summary strip on a PDF */
export function addSummaryStrip(
  doc: jsPDF,
  text: string,
  y: number
): number {
  doc.setFillColor(240, 248, 255);
  doc.rect(14, y - 3, doc.internal.pageSize.width - 28, 14, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 18, y + 5);
  return y + 16;
}

// ─── Simple Canvas chart renderer (for PDF embedding) ───────────────

export function renderBarChart(
  data: number[],
  labels: string[],
  width = 500,
  height = 200,
  color = '#1e3a8a'
): string {
  const dpr = 2; // High-resolution for PDF
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(dpr, dpr);

  const padding = 45;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  const maxValue = Math.max(...data, 1);
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, gy);
    ctx.lineTo(width - padding, gy);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Helvetica';
    ctx.textAlign = 'right';
    const val = maxValue - (maxValue / 4) * i;
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1), padding - 5, gy + 3);
  }

  const spacing = chartWidth / data.length;
  const barWidth = spacing * 0.6;

  // Bars with gradient
  data.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = padding + spacing * index + (spacing - barWidth) / 2;
    const y = height - padding - barHeight;

    const grad = ctx.createLinearGradient(x, y, x, y + barHeight);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '99');
    ctx.fillStyle = grad;

    // Rounded top corners
    const r = Math.min(barWidth / 2, 3);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barWidth - r, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
    ctx.lineTo(x + barWidth, y + barHeight);
    ctx.lineTo(x, y + barHeight);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
  });

  // X-axis labels
  ctx.fillStyle = '#374151';
  ctx.font = '10px Helvetica';
  ctx.textAlign = 'center';
  labels.forEach((label, index) => {
    const x = padding + spacing * index + spacing / 2;
    ctx.fillText(label.substring(0, 10), x, height - 8);
  });

  return canvas.toDataURL('image/png', 1.0);
}

export function renderLineChart(
  data: number[],
  labels: string[],
  width = 500,
  height = 200,
  color = '#14b8a6'
): string {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(dpr, dpr);

  const padding = 45;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const maxValue = Math.max(...data, 1);

  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, gy);
    ctx.lineTo(width - padding, gy);
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Helvetica';
    ctx.textAlign = 'right';
    const val = maxValue - (maxValue / 4) * i;
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1), padding - 5, gy + 3);
  }

  const spacing = chartWidth / Math.max(data.length - 1, 1);

  // Area fill
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  data.forEach((value, index) => {
    const x = padding + spacing * index;
    const y = height - padding - (value / maxValue) * chartHeight;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(padding + spacing * (data.length - 1), height - padding);
  ctx.closePath();
  ctx.fillStyle = color + '1a';
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  data.forEach((value, index) => {
    const x = padding + spacing * index;
    const y = height - padding - (value / maxValue) * chartHeight;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  data.forEach((value, index) => {
    const x = padding + spacing * index;
    const y = height - padding - (value / maxValue) * chartHeight;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // X labels
  ctx.fillStyle = '#374151';
  ctx.font = '10px Helvetica';
  ctx.textAlign = 'center';
  labels.forEach((label, index) => {
    const x = padding + spacing * index;
    ctx.fillText(label.substring(0, 10), x, height - 8);
  });

  return canvas.toDataURL('image/png', 1.0);
}

export function renderPieChart(
  data: number[],
  labels: string[],
  width = 300,
  height = 300,
  colors = ['#1e3a8a', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
): string {
  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const total = data.reduce((sum, v) => sum + v, 0);
  if (total === 0) return '';

  const cx = width / 2;
  const cy = height / 2 - 15;
  const radius = Math.min(cx, cy) - 20;
  let startAngle = -Math.PI / 2;

  data.forEach((value, i) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Legend
  const legendY = height - 25;
  ctx.font = '10px Helvetica';
  let legendX = 10;
  labels.forEach((label, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(legendX, legendY, 10, 10);
    ctx.fillStyle = '#374151';
    const pct = ((data[i] / total) * 100).toFixed(1);
    const text = `${label} (${pct}%)`;
    ctx.fillText(text, legendX + 14, legendY + 9);
    legendX += ctx.measureText(text).width + 24;
  });

  return canvas.toDataURL('image/png', 1.0);
}

// ─── autoTable re-export for convenience ────────────────────────────
export { autoTable };
