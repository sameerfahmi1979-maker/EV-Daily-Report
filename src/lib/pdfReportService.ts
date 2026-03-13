// =============================================
// pdfReportService.ts
// Branded PDF reports with dynamic company header
// Uses system_settings for branding
// =============================================
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from './supabase';
import { getAllSettings, SettingsMap } from './settingsService';
import { formatJOD } from './billingService';

// ---- Shared branded header ----
let _cachedSettings: SettingsMap | null = null;

async function getSettings(): Promise<SettingsMap> {
  if (!_cachedSettings) _cachedSettings = await getAllSettings();
  return _cachedSettings;
}

/** Force a refresh next call (call after user updates settings). */
export function clearSettingsCache() {
  _cachedSettings = null;
}

async function addBrandedHeader(doc: jsPDF, title: string, subtitle?: string): Promise<number> {
  const s = await getSettings();
  let y = 15;

  // Logo (if URL and it's a data URL or base64 — skip HTTP logos in jsPDF)
  // Company Name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(s.company_name || 'EV Charging Station', 14, y);
  y += 6;

  if (s.company_address) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(s.company_address, 14, y);
    y += 4;
  }
  const contactParts: string[] = [];
  if (s.company_phone) contactParts.push(`Tel: ${s.company_phone}`);
  if (s.company_email) contactParts.push(`Email: ${s.company_email}`);
  if (contactParts.length) {
    doc.setFontSize(7);
    doc.text(contactParts.join('  |  '), 14, y);
    y += 6;
  }

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, doc.internal.pageSize.width - 14, y);
  y += 6;

  // Report title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138); // blue-900
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

function addFooter(doc: jsPDF, footerText?: string) {
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
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, w / 2, h - 8, { align: 'center' });
  }
}

// ========================================================
// SHIFT REPORT
// ========================================================
export async function exportShiftReportPDF(
  startDate: Date,
  endDate: Date,
  stationId?: string,
  operatorId?: string,
): Promise<void> {
  const s = await getSettings();
  const doc = new jsPDF({ orientation: 'landscape' });

  // Fetch shifts
  let query = supabase
    .from('shifts')
    .select('*, stations(name, station_code), operators(name, card_number)')
    .gte('shift_date', format(startDate, 'yyyy-MM-dd'))
    .lte('shift_date', format(endDate, 'yyyy-MM-dd'))
    .order('shift_date', { ascending: false });

  if (stationId) query = query.eq('station_id', stationId);
  if (operatorId) query = query.eq('operator_id', operatorId);

  const { data: shifts, error } = await query;
  if (error) throw error;

  const subtitle = `${format(startDate, 'dd/MM/yyyy')} – ${format(endDate, 'dd/MM/yyyy')}`;
  const startY = await addBrandedHeader(doc, 'Shift Report', subtitle);

  // Summary
  const totalShifts = (shifts || []).length;
  const totalKwh = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_kwh || 0), 0);
  const totalRevenue = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_amount_jod || 0), 0);
  const totalSessions = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_sessions || 0), 0);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Shifts: ${totalShifts}  |  Sessions: ${totalSessions}  |  Energy: ${totalKwh.toFixed(2)} kWh  |  Revenue: ${formatJOD(totalRevenue)}`, 14, startY);

  // Table
  autoTable(doc, {
    startY: startY + 6,
    head: [['Date', 'Station', 'Operator', 'Type', 'Duration', 'Sessions', 'kWh', 'Revenue (JOD)', 'Status']],
    body: (shifts || []).map((sh: any) => [
      sh.shift_date,
      (sh as any).stations?.name || '—',
      (sh as any).operators?.name || '—',
      sh.shift_type || '—',
      sh.shift_duration || '—',
      sh.total_sessions || 0,
      Number(sh.total_kwh || 0).toFixed(2),
      formatJOD(Number(sh.total_amount_jod || 0)),
      sh.handover_status || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, s.report_footer_text);
  doc.save(`shift-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.pdf`);
}

// ========================================================
// OPERATOR REPORT
// ========================================================
export async function exportOperatorReportPDF(
  startDate: Date,
  endDate: Date,
  operatorId?: string,
): Promise<void> {
  const s = await getSettings();
  const doc = new jsPDF();

  // Fetch operators
  let opsQuery = supabase.from('operators').select('*').order('name');
  if (operatorId) opsQuery = opsQuery.eq('id', operatorId);
  const { data: operators, error: opsErr } = await opsQuery;
  if (opsErr) throw opsErr;

  const subtitle = `${format(startDate, 'dd/MM/yyyy')} – ${format(endDate, 'dd/MM/yyyy')}`;
  let startY = await addBrandedHeader(doc, 'Operator Performance Report', subtitle);

  for (const op of (operators || [])) {
    // Get shifts for this operator in period
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('operator_id', op.id)
      .gte('shift_date', format(startDate, 'yyyy-MM-dd'))
      .lte('shift_date', format(endDate, 'yyyy-MM-dd'))
      .order('shift_date');

    const shiftCount = (shifts || []).length;
    const totalKwh = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_kwh || 0), 0);
    const totalRevenue = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_amount_jod || 0), 0);
    const totalSessions = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_sessions || 0), 0);

    // Check if need new page
    if (startY > doc.internal.pageSize.height - 60) {
      doc.addPage();
      startY = await addBrandedHeader(doc, 'Operator Performance Report', subtitle);
    }

    // Operator header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`${op.name} (${op.card_number || '—'})`, 14, startY);
    startY += 5;
    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Shifts: ${shiftCount}  |  Sessions: ${totalSessions}  |  Energy: ${totalKwh.toFixed(2)} kWh  |  Revenue: ${formatJOD(totalRevenue)}`, 14, startY);
    startY += 4;

    if (shiftCount > 0) {
      autoTable(doc, {
        startY,
        head: [['Date', 'Type', 'Duration', 'Sessions', 'kWh', 'Revenue', 'Status']],
        body: (shifts || []).map((sh: any) => [
          sh.shift_date,
          sh.shift_type || '—',
          sh.shift_duration || '—',
          sh.total_sessions || 0,
          Number(sh.total_kwh || 0).toFixed(2),
          formatJOD(Number(sh.total_amount_jod || 0)),
          sh.handover_status || '—',
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.text('No shifts in this period.', 14, startY);
      startY += 8;
    }
  }

  addFooter(doc, s.report_footer_text);
  doc.save(`operator-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.pdf`);
}

// ========================================================
// MONEY HANDOVER HISTORY REPORT
// ========================================================
export async function exportHandoverReportPDF(
  startDate: Date,
  endDate: Date,
  stationId?: string,
  status?: string,
): Promise<void> {
  const s = await getSettings();
  const doc = new jsPDF({ orientation: 'landscape' });

  let query = supabase
    .from('shifts')
    .select('*, stations(name), operators(name)')
    .gte('shift_date', format(startDate, 'yyyy-MM-dd'))
    .lte('shift_date', format(endDate, 'yyyy-MM-dd'))
    .order('shift_date', { ascending: false });

  if (stationId) query = query.eq('station_id', stationId);
  if (status) query = query.eq('handover_status', status);

  const { data: shifts, error } = await query;
  if (error) throw error;

  const subtitle = `${format(startDate, 'dd/MM/yyyy')} – ${format(endDate, 'dd/MM/yyyy')}`;
  const startY = await addBrandedHeader(doc, 'Money Handover History', subtitle);

  // Summary by status
  const byStatus: Record<string, { count: number; total: number }> = {};
  for (const sh of (shifts || [])) {
    const st = (sh as any).handover_status || 'unknown';
    if (!byStatus[st]) byStatus[st] = { count: 0, total: 0 };
    byStatus[st].count++;
    byStatus[st].total += Number((sh as any).total_amount_jod || 0);
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const summaryParts = Object.entries(byStatus).map(([st, v]) => `${st}: ${v.count} (${formatJOD(v.total)})`);
  doc.text(`Total: ${(shifts || []).length} shifts  |  ${summaryParts.join('  |  ')}`, 14, startY);

  autoTable(doc, {
    startY: startY + 6,
    head: [['Date', 'Station', 'Operator', 'Shift Type', 'Revenue (JOD)', 'Handover Status', 'Bank Reference', 'Deposit Date']],
    body: (shifts || []).map((sh: any) => [
      sh.shift_date,
      sh.stations?.name || '—',
      sh.operators?.name || '—',
      sh.shift_type || '—',
      formatJOD(Number(sh.total_amount_jod || 0)),
      sh.handover_status || '—',
      sh.bank_reference || '—',
      sh.deposit_date || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
    // Color-code status cells
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = data.cell.raw;
        if (val === 'handed_over') data.cell.styles.textColor = [16, 185, 129];
        else if (val === 'deposited') data.cell.styles.textColor = [59, 130, 246];
        else if (val === 'pending') data.cell.styles.textColor = [245, 158, 11];
      }
    },
  });

  addFooter(doc, s.report_footer_text);
  doc.save(`handover-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.pdf`);
}

// ========================================================
// DAILY SUMMARY REPORT
// ========================================================
export async function exportDailySummaryPDF(date: Date, stationId?: string): Promise<void> {
  const s = await getSettings();
  const doc = new jsPDF();
  const dateStr = format(date, 'yyyy-MM-dd');

  const startY = await addBrandedHeader(doc, 'Daily Summary Report', format(date, 'EEEE, dd MMMM yyyy'));

  // Fetch shifts for this day
  let query = supabase
    .from('shifts')
    .select('*, stations(name), operators(name)')
    .eq('shift_date', dateStr)
    .order('shift_type');

  if (stationId) query = query.eq('station_id', stationId);
  const { data: shifts, error } = await query;
  if (error) throw error;

  const totalKwh = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_kwh || 0), 0);
  const totalRevenue = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_amount_jod || 0), 0);
  const totalSessions = (shifts || []).reduce((sum: number, sh: any) => sum + Number(sh.total_sessions || 0), 0);

  doc.setFontSize(9);
  doc.text(`Shifts: ${(shifts || []).length}  |  Sessions: ${totalSessions}  |  Energy: ${totalKwh.toFixed(2)} kWh  |  Revenue: ${formatJOD(totalRevenue)}`, 14, startY);

  autoTable(doc, {
    startY: startY + 6,
    head: [['Station', 'Operator', 'Shift', 'Duration', 'Sessions', 'kWh', 'Revenue', 'Status']],
    body: (shifts || []).map((sh: any) => [
      sh.stations?.name || '—',
      sh.operators?.name || '—',
      sh.shift_type || '—',
      sh.shift_duration || '—',
      sh.total_sessions || 0,
      Number(sh.total_kwh || 0).toFixed(2),
      formatJOD(Number(sh.total_amount_jod || 0)),
      sh.handover_status || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, s.report_footer_text);
  doc.save(`daily-summary-${dateStr}.pdf`);
}
