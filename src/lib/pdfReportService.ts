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

async function getSettings(): Promise<SettingsMap> {
  // Always fetch fresh settings to get latest branding
  return await getAllSettings();
}

/** Fetch logo URL and return base64 data URL */
async function fetchLogoBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return base64;
  } catch (e) {
    console.warn('Could not fetch logo:', e);
    return null;
  }
}

async function addBrandedHeader(doc: jsPDF, title: string, subtitle?: string): Promise<number> {
  const s = await getSettings();
  let y = 15;
  let logoWidth = 0;

  // Logo — fetch and embed
  const logoUrl = s.company_logo_url;
  if (logoUrl) {
    try {
      const base64 = await fetchLogoBase64(logoUrl);
      if (base64) {
        const logoH = 15;
        const img = new Image();
        img.src = base64;
        await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
        const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);

        logoWidth = logoH * aspect;
        doc.addImage(base64, 'PNG', 14, y - 5, logoWidth, logoH);
      }
    } catch (e) {
      console.warn('Failed to add logo to PDF:', e);
    }
  }

  // Company Name (offset by logo width)
  const textX = logoWidth > 0 ? 14 + logoWidth + 4 : 14;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(s.company_name || 'EV Charging Station', textX, y);
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

  // Ensure y accounts for logo height
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

// ========================================================
// SHIFT SESSION REPORT (per-shift, for printing after upload)
// ========================================================
export async function generateShiftSessionReportPDF(
  shift: {
    id: string;
    shift_date: string;
    shift_type: string;
    shift_duration: string;
    start_time: string;
    end_time: string;
    total_kwh: number;
    total_amount_jod: number;
    stations?: { name: string } | null;
    operators?: { name: string; card_number?: string } | null;
  },
  sessions: Array<{
    transaction_id: string;
    start_ts: string;
    end_ts: string;
    energy_consumed_kwh: number;
    billing_calculations?: Array<{ total_amount: number }>;
  }>
): Promise<void> {
  const s = await getSettings();
  const doc = new jsPDF();

  const stationName = (shift.stations as any)?.name || 'Unknown Station';
  const operatorName = (shift.operators as any)?.name || 'Unknown Operator';

  const startY = await addBrandedHeader(doc, 'EV CHARGING STATION — SHIFT SESSION REPORT');

  // Shift info block
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let y = startY;

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Station:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(stationName, 42, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 120, y);
  doc.setFont('helvetica', 'normal');
  doc.text(shift.shift_date, 138, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Operator:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(operatorName, 42, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Shift:', 120, y);
  doc.setFont('helvetica', 'normal');
  const shiftLabel = shift.shift_type?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || shift.shift_type;
  doc.text(`${shiftLabel} (${shift.shift_duration})`, 138, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Sessions:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sessions.length}`, 42, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Period:', 120, y);
  doc.setFont('helvetica', 'normal');
  const startTime = shift.start_time ? format(new Date(shift.start_time), 'HH:mm') : '—';
  const endTime = shift.end_time ? format(new Date(shift.end_time), 'HH:mm') : '—';
  doc.text(`${startTime} — ${endTime}`, 138, y);
  y += 8;

  // Sessions table
  autoTable(doc, {
    startY: y,
    head: [['#', 'Transaction ID', 'Start Time', 'End Time', 'kWh', 'Amount (JOD)']],
    body: sessions.map((sess, idx) => {
      const startFormatted = sess.start_ts ? format(new Date(sess.start_ts), 'HH:mm:ss') : '—';
      const endFormatted = sess.end_ts ? format(new Date(sess.end_ts), 'HH:mm:ss') : '—';
      const kwh = Number(sess.energy_consumed_kwh || 0);
      const amount = sess.billing_calculations?.[0]?.total_amount || 0;
      return [
        idx + 1,
        sess.transaction_id || '—',
        startFormatted,
        endFormatted,
        kwh.toFixed(3),
        formatJOD(Number(amount)),
      ];
    }),
    foot: [[
      '', '', '', 'TOTAL',
      Number(shift.total_kwh || 0).toFixed(3),
      formatJOD(Number(shift.total_amount_jod || 0)),
    ]],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, s.report_footer_text);
  doc.save(`shift-session-report-${shift.shift_date}-${shift.shift_type}.pdf`);
}


// ========================================================
// MONEY HANDOVER LETTER (receipt for operator → manager handover)
// ========================================================
export async function generateMoneyHandoverLetterPDF(
  shift: {
    id: string;
    shift_date: string;
    shift_type: string;
    shift_duration: string;
    start_time: string;
    end_time: string;
    total_kwh: number;
    total_amount_jod: number;
    stations?: { name: string } | null;
    operators?: { name: string; card_number?: string } | null;
  },
  sessionCount: number
): Promise<void> {
  const s = await getSettings();
  const doc = new jsPDF();

  const stationName = (shift.stations as any)?.name || 'Unknown Station';
  const operatorName = (shift.operators as any)?.name || 'Unknown Operator';
  const operatorCard = (shift.operators as any)?.card_number || '—';

  const startY = await addBrandedHeader(doc, 'MONEY HANDOVER ACKNOWLEDGEMENT');

  let y = startY + 2;
  const pageW = doc.internal.pageSize.width;
  const contentW = pageW - 28; // 14mm margins each side

  // Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${shift.shift_date}`, 14, y);
  y += 8;

  // Info box
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, contentW, 38, 2, 2, 'FD');

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Station:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(stationName, 55, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Operator:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(operatorName, 55, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Card Number:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(operatorCard, 55, y);
  y += 6;

  const shiftLabel = shift.shift_type?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || shift.shift_type;
  const startTime = shift.start_time ? format(new Date(shift.start_time), 'HH:mm') : '—';
  const endTime = shift.end_time ? format(new Date(shift.end_time), 'HH:mm') : '—';
  doc.setFont('helvetica', 'bold');
  doc.text('Shift:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${shiftLabel} (${startTime} — ${endTime}) — ${shift.shift_duration}`, 55, y);
  y += 12;

  // Summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Sessions:`, 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sessionCount}`, 65, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text(`Total Energy Delivered:`, 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${Number(shift.total_kwh || 0).toFixed(3)} kWh`, 65, y);
  y += 10;

  // Amount box — prominent
  doc.setDrawColor(30, 58, 138);
  doc.setFillColor(239, 246, 255);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, y, contentW, 16, 2, 2, 'FD');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('TOTAL AMOUNT TO HANDOVER:', 20, y + 10);
  const amountText = `${formatJOD(Number(shift.total_amount_jod || 0))} JOD`;
  doc.text(amountText, pageW - 20, y + 10, { align: 'right' });
  doc.setTextColor(0);
  y += 26;

  // Signature lines
  doc.setLineWidth(0.3);
  doc.setDrawColor(150);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text('Operator Signature:', 20, y);
  doc.line(65, y, 145, y);
  y += 12;

  doc.text('Station Manager Signature:', 20, y);
  doc.line(75, y, 145, y);
  y += 12;

  doc.text('Date & Time:', 20, y);
  doc.line(55, y, 145, y);
  y += 15;

  // Disclaimer
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('This document serves as an acknowledgement of money handover from the operator to the station manager.', 14, y);
  y += 4;
  doc.text('Both parties confirm the accuracy of the above information by signing this document.', 14, y);
  doc.setTextColor(0);

  addFooter(doc, s.report_footer_text);
  doc.save(`money-handover-${shift.shift_date}-${operatorName.replace(/\s+/g, '-')}.pdf`);
}
