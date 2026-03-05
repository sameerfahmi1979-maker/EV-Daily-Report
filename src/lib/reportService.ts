import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from './supabase';
import { formatJOD } from './billingService';

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  session: {
    transaction_id: string;
    charge_id: string;
    card_number: string;
    start_ts: string;
    end_ts: string;
    duration_minutes: number;
    energy_consumed_kwh: number;
  };
  billing: {
    subtotal: number;
    total_amount: number;
    calculation_date: string;
  };
  breakdown: Array<{
    period_name: string;
    duration_minutes: number;
    energy_kwh: number;
    rate_per_kwh: number;
    energy_charge: number;
    demand_kw: number | null;
    demand_charge: number | null;
    line_total: number;
  }>;
  fixedCharges: Array<{
    charge_name: string;
    amount: number;
  }>;
  station: {
    name: string;
    station_code: string | null;
  };
}

export interface MonthlySummary {
  month: string;
  totalSessions: number;
  totalEnergy: number;
  totalRevenue: number;
  averageSessionDuration: number;
  averageEnergyPerSession: number;
  averageRevenuePerSession: number;
  stationBreakdown: Array<{
    stationName: string;
    sessions: number;
    energy: number;
    revenue: number;
  }>;
}

function createSimpleChart(type: 'bar' | 'line', data: number[], labels: string[], width: number = 400, height: number = 200): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const maxValue = Math.max(...data, 1);
  const barWidth = chartWidth / data.length * 0.7;
  const spacing = chartWidth / data.length;

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  data.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = padding + spacing * index + (spacing - barWidth) / 2;
    const y = height - padding - barHeight;

    if (type === 'bar') {
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(x, y, barWidth, barHeight);
    } else {
      if (index > 0) {
        const prevHeight = (data[index - 1] / maxValue) * chartHeight;
        const prevX = padding + spacing * (index - 1) + spacing / 2;
        const prevY = height - padding - prevHeight;

        ctx.strokeStyle = '#14b8a6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x + barWidth / 2, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = '#374151';
  ctx.font = '10px Helvetica';
  ctx.textAlign = 'center';

  labels.forEach((label, index) => {
    const x = padding + spacing * index + spacing / 2;
    ctx.fillText(label.substring(0, 8), x, height - 10);
  });

  return canvas.toDataURL('image/png', 0.5);
}

export async function getInvoiceData(sessionId: string): Promise<InvoiceData | null> {
  const { data: session, error: sessionError } = await supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        name,
        station_code
      )
    `)
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.error('Failed to fetch session:', sessionError);
    return null;
  }

  const { data: billing, error: billingError } = await supabase
    .from('billing_calculations')
    .select('*')
    .eq('session_id', sessionId)
    .order('calculation_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (billingError) {
    console.error('Failed to fetch billing:', billingError);
    return null;
  }

  if (!billing) {
    return null;
  }

  const { data: breakdown, error: breakdownError } = await supabase
    .from('billing_breakdown_items')
    .select('*')
    .eq('billing_calculation_id', billing.id)
    .order('period_name');

  if (breakdownError) {
    console.error('Failed to fetch breakdown:', breakdownError);
    return null;
  }

  const billingBreakdown = billing.breakdown as any;
  const fixedCharges = billingBreakdown?.fixedChargesList || [];

  const invoiceNumber = `INV-${session.transaction_id}`;

  return {
    invoiceNumber,
    invoiceDate: new Date(billing.calculation_date),
    session: {
      transaction_id: session.transaction_id,
      charge_id: session.charge_id,
      card_number: session.card_number,
      start_ts: session.start_ts,
      end_ts: session.end_ts,
      duration_minutes: parseFloat(session.duration_minutes),
      energy_consumed_kwh: parseFloat(session.energy_consumed_kwh)
    },
    billing: {
      subtotal: parseFloat(billing.subtotal),
      total_amount: parseFloat(billing.total_amount),
      calculation_date: billing.calculation_date
    },
    breakdown: breakdown?.map((item: any) => ({
      period_name: item.period_name,
      duration_minutes: parseFloat(item.duration_minutes),
      energy_kwh: parseFloat(item.energy_kwh),
      rate_per_kwh: parseFloat(item.rate_per_kwh),
      energy_charge: parseFloat(item.energy_charge),
      demand_kw: item.demand_kw ? parseFloat(item.demand_kw) : null,
      demand_charge: item.demand_charge ? parseFloat(item.demand_charge) : null,
      line_total: parseFloat(item.line_total)
    })) || [],
    fixedCharges: fixedCharges?.map((item: any) => ({
      charge_name: item.name || 'Fixed Charge',
      amount: parseFloat(item.amount)
    })) || [],
    station: {
      name: session.stations?.name || 'Unknown Station',
      station_code: session.stations?.station_code || null
    }
  };
}

export function generateInvoicePDF(invoice: InvoiceData) {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('EV CHARGING INVOICE', 148.5, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Electric Vehicle Charging Services', 148.5, 28, { align: 'center' });

  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(0.5);
  doc.line(20, 32, 190, 32);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 42);
  doc.text(`Date: ${format(invoice.invoiceDate, 'yyyy-MM-dd HH:mm')}`, 20, 49);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Station Information:', 20, 60);
  doc.text(`Station: ${invoice.station.name}`, 25, 67);
  if (invoice.station.station_code) {
    doc.text(`Code: ${invoice.station.station_code}`, 25, 74);
  }

  doc.text('Customer Information:', 120, 60);
  doc.text(`Card: ${invoice.session.card_number}`, 125, 67);

  doc.setFillColor(240, 248, 255);
  doc.rect(20, 82, 170, 35, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Session Details', 25, 90);
  doc.setFont('helvetica', 'normal');

  doc.text(`Transaction ID: ${invoice.session.transaction_id}`, 25, 97);
  doc.text(`Charge ID: ${invoice.session.charge_id}`, 25, 104);
  doc.text(`Start: ${format(new Date(invoice.session.start_ts), 'yyyy-MM-dd HH:mm:ss')}`, 25, 111);
  doc.text(`End: ${format(new Date(invoice.session.end_ts), 'yyyy-MM-dd HH:mm:ss')}`, 110, 111);

  const durationHours = (invoice.session.duration_minutes / 60).toFixed(2);
  doc.text(`Duration: ${invoice.session.duration_minutes.toFixed(0)} minutes (${durationHours} hours)`, 25, 118);
  doc.text(`Total Energy: ${invoice.session.energy_consumed_kwh.toFixed(3)} kWh`, 110, 118);

  doc.setFont('helvetica', 'bold');
  doc.text('Billing Breakdown', 20, 130);

  const tableData = invoice.breakdown.map(item => [
    item.period_name,
    item.duration_minutes.toFixed(1),
    item.energy_kwh.toFixed(3),
    item.rate_per_kwh.toFixed(3),
    formatJOD(item.energy_charge),
    item.demand_kw ? item.demand_kw.toFixed(2) : '-',
    item.demand_charge ? formatJOD(item.demand_charge) : '-',
    formatJOD(item.line_total)
  ]);

  autoTable(doc, {
    startY: 135,
    head: [[
      'Period',
      'Duration\n(min)',
      'Energy\n(kWh)',
      'Rate\n(JOD/kWh)',
      'Energy\nCharge',
      'Demand\n(kW)',
      'Demand\nCharge',
      'Total'
    ]],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      fontSize: 8,
      lineWidth: 0.1,
      lineColor: [230, 230, 230]
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' }
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 10;

  if (invoice.fixedCharges.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Fixed Charges', 20, finalY);
    finalY += 5;

    const fixedChargesData = invoice.fixedCharges.map(fc => [
      fc.charge_name,
      formatJOD(fc.amount)
    ]);

    autoTable(doc, {
      startY: finalY,
      head: [['Charge Description', 'Amount']],
      body: fixedChargesData,
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 245],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { halign: 'right', fontStyle: 'bold' }
      }
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
  }

  const subtotal = invoice.billing.subtotal;
  const totalFixedCharges = invoice.fixedCharges.reduce((sum, fc) => sum + fc.amount, 0);
  const total = invoice.billing.total_amount;

  doc.setFillColor(245, 245, 245);
  doc.rect(130, finalY - 5, 60, 30, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 135, finalY);
  doc.text(formatJOD(subtotal), 185, finalY, { align: 'right' });

  finalY += 7;
  doc.text('Fixed Charges:', 135, finalY);
  doc.text(formatJOD(totalFixedCharges), 185, finalY, { align: 'right' });

  finalY += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 135, finalY);
  doc.text(formatJOD(total), 185, finalY, { align: 'right' });

  finalY += 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('* All amounts in Jordanian Dinars (JOD)', 105, finalY, { align: 'center' });
  finalY += 5;
  doc.text('* No taxes applied', 105, finalY, { align: 'center' });

  finalY += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, finalY, 190, finalY);

  finalY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Thank you for using our EV charging services!', 105, finalY, { align: 'center' });
  finalY += 5;
  doc.text('For support, please contact your service provider.', 105, finalY, { align: 'center' });

  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
}

export async function exportSessionsToExcel(startDate: Date, endDate: Date, stationId?: string, includeCharts: boolean = true, startTime?: string, endTime?: string): Promise<number> {
  let query = supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        name,
        station_code
      ),
      billing_calculations (
        total_amount
      )
    `)
    .order('start_ts', { ascending: false });

  const startTimestamp = startTime
    ? `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`
    : `${format(startDate, 'yyyy-MM-dd')}T00:00:00`;
  query = query.gte('start_ts', startTimestamp);

  const endTimestamp = endTime
    ? `${format(endDate, 'yyyy-MM-dd')}T${endTime}:59`
    : `${format(endDate, 'yyyy-MM-dd')}T23:59:59`;
  query = query.lte('start_ts', endTimestamp);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  const { data: sessions, error } = await query;

  if (error) {
    console.error('Failed to fetch sessions:', error);
    throw error;
  }

  const exportData = sessions?.map((session: any) => ({
    'Transaction ID': session.transaction_id,
    'Charge ID': session.charge_id,
    'Card Number': session.card_number,
    'Station': session.stations?.name || 'Unknown',
    'Station Code': session.stations?.station_code || '',
    'Start Date': session.start_date,
    'Start Time': format(new Date(session.start_ts), 'HH:mm:ss'),
    'End Date': session.end_date,
    'End Time': format(new Date(session.end_ts), 'HH:mm:ss'),
    'Duration (minutes)': parseFloat(session.duration_minutes).toFixed(2),
    'Energy (kWh)': parseFloat(session.energy_consumed_kwh).toFixed(3),
    'Max Demand (kW)': session.max_demand_kw ? parseFloat(session.max_demand_kw).toFixed(2) : '',
    'Cost (JOD)': session.billing_calculations?.[0]?.total_amount
      ? parseFloat(session.billing_calculations[0].total_amount).toFixed(3)
      : 'Not Calculated',
    'User ID': session.user_identifier || ''
  })) || [];

  const ws = XLSX.utils.json_to_sheet(exportData);

  ws['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Charging Sessions');

  const fileName = `charging-sessions-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]).size;
}

export async function exportSessionsToCSV(startDate: Date, endDate: Date, stationId?: string, startTime?: string, endTime?: string): Promise<number> {
  let query = supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        name,
        station_code
      ),
      billing_calculations (
        total_amount
      )
    `)
    .order('start_ts', { ascending: false });

  const startTimestamp = startTime
    ? `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`
    : `${format(startDate, 'yyyy-MM-dd')}T00:00:00`;
  query = query.gte('start_ts', startTimestamp);

  const endTimestamp = endTime
    ? `${format(endDate, 'yyyy-MM-dd')}T${endTime}:59`
    : `${format(endDate, 'yyyy-MM-dd')}T23:59:59`;
  query = query.lte('start_ts', endTimestamp);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const exportData = sessions?.map((session: any) => ({
    'Transaction ID': session.transaction_id,
    'Station': session.stations?.name || 'Unknown',
    'Start Date': session.start_date,
    'Start Time': format(new Date(session.start_ts), 'HH:mm:ss'),
    'Duration (min)': parseFloat(session.duration_minutes).toFixed(2),
    'Energy (kWh)': parseFloat(session.energy_consumed_kwh).toFixed(3),
    'Cost (JOD)': session.billing_calculations?.[0]?.total_amount
      ? parseFloat(session.billing_calculations[0].total_amount).toFixed(3)
      : ''
  })) || [];

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sessions-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return blob.size;
}

export async function exportSessionsToPDF(startDate: Date, endDate: Date, stationId?: string, includeCharts: boolean = true, startTime?: string, endTime?: string, cardNumber?: string): Promise<number> {
  let stationName: string | null = null;
  let operatorName: string | null = null;

  if (stationId) {
    const { data: stationData } = await supabase
      .from('stations')
      .select('name')
      .eq('id', stationId)
      .maybeSingle();
    stationName = stationData?.name || null;
  }

  if (cardNumber) {
    const { data: operatorData } = await supabase
      .from('operators')
      .select('name')
      .eq('card_number', cardNumber)
      .maybeSingle();
    operatorName = operatorData?.name || null;
  }

  let query = supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        name,
        station_code
      ),
      billing_calculations (
        total_amount
      )
    `)
    .order('start_ts', { ascending: false })
    .limit(500);

  const startTimestamp = startTime
    ? `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`
    : `${format(startDate, 'yyyy-MM-dd')}T00:00:00`;
  query = query.gte('start_ts', startTimestamp);

  const endTimestamp = endTime
    ? `${format(endDate, 'yyyy-MM-dd')}T${endTime}:59`
    : `${format(endDate, 'yyyy-MM-dd')}T23:59:59`;
  query = query.lte('start_ts', endTimestamp);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  if (cardNumber) {
    query = query.eq('card_number', cardNumber);
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const totalEnergy = sessions?.reduce((sum, s: any) => sum + parseFloat(s.energy_consumed_kwh), 0) || 0;
  const totalDuration = sessions?.reduce((sum, s: any) => sum + parseFloat(s.duration_minutes), 0) || 0;
  const totalIncome = sessions?.reduce((sum, s: any) => {
    const billing = s.billing_calculations?.[0];
    return sum + (billing ? parseFloat(billing.total_amount) : 0);
  }, 0) || 0;

  const doc = new jsPDF({ orientation: 'landscape', compress: true });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Charging Sessions Report', 148.5, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const periodText = startTime || endTime
    ? `Period: ${format(startDate, 'MMM dd, yyyy')} ${startTime || '00:00'} - ${format(endDate, 'MMM dd, yyyy')} ${endTime || '23:59'}`
    : `Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
  doc.text(periodText, 148.5, 22, { align: 'center' });

  let startY = 28;

  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(20, startY, 257, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Report Filters Applied', 25, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let filterText = `Date Range: ${format(startDate, 'MMM dd, yyyy')}`;
  if (startTime) filterText += ` ${startTime}`;
  filterText += ` to ${format(endDate, 'MMM dd, yyyy')}`;
  if (endTime) filterText += ` ${endTime}`;

  if (stationName) {
    filterText += ` • Station: ${stationName}`;
  }

  if (operatorName && cardNumber) {
    filterText += ` • Operator: ${operatorName} (${cardNumber})`;
  }

  doc.text(filterText, 25, startY + 12);

  startY = 53;

  doc.setFillColor(240, 248, 255);
  doc.rect(20, startY - 5, 257, 25, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Summary Metrics', 25, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  startY += 7;
  doc.text(`Total Energy: ${totalEnergy.toFixed(2)} kWh`, 25, startY);
  doc.text(`Total Duration: ${totalDuration.toFixed(0)} minutes`, 85, startY);
  doc.text(`Total Income: ${totalIncome.toFixed(2)} JOD`, 145, startY);

  startY += 6;
  doc.text(`Total Sessions: ${sessions?.length || 0}`, 25, startY);

  startY += 12;

  const tableData = sessions?.slice(0, 100).map((session: any) => [
    session.transaction_id,
    (session.stations?.name || 'Unknown').substring(0, 20),
    format(new Date(session.start_ts), 'MM/dd/yy'),
    format(new Date(session.start_ts), 'HH:mm'),
    format(new Date(session.end_ts), 'HH:mm'),
    parseFloat(session.duration_minutes).toFixed(0),
    parseFloat(session.energy_consumed_kwh).toFixed(2),
    session.billing_calculations?.[0]?.total_amount
      ? parseFloat(session.billing_calculations[0].total_amount).toFixed(2)
      : '-'
  ]) || [];

  const footerData = [[
    '',
    '',
    '',
    '',
    'TOTALS',
    totalDuration.toFixed(0),
    totalEnergy.toFixed(2),
    totalIncome.toFixed(2)
  ]];

  autoTable(doc, {
    startY: startY,
    head: [['Transaction ID', 'Station', 'Date', 'Start', 'End', 'Duration\n(min)', 'Energy\n(kWh)', 'Cost\n(JOD)']],
    body: tableData,
    foot: footerData,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      fontSize: 7,
      lineWidth: 0.1,
      lineColor: [240, 240, 240]
    },
    footStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineWidth: 0.2,
      lineColor: [200, 200, 200]
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 25 },
      7: { halign: 'right', cellWidth: 25 }
    },
    margin: { left: 20, right: 20 }
  });

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sessions-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  return pdfBlob.size;
}

export async function exportBillingToExcel(startDate: Date, endDate: Date, stationId?: string, includeCharts: boolean = true, startTime?: string, endTime?: string): Promise<number> {
  let query = supabase
    .from('charging_sessions')
    .select(`
      station_id,
      transaction_id,
      card_number,
      start_ts,
      stations (
        name,
        station_code
      ),
      billing_calculations (
        calculation_date,
        subtotal,
        total_amount,
        currency
      )
    `)
    .not('billing_calculations', 'is', null)
    .order('start_ts', { ascending: false });

  const startTimestamp = startTime
    ? `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`
    : `${format(startDate, 'yyyy-MM-dd')}T00:00:00`;
  query = query.gte('start_ts', startTimestamp);

  const endTimestamp = endTime
    ? `${format(endDate, 'yyyy-MM-dd')}T${endTime}:59`
    : `${format(endDate, 'yyyy-MM-dd')}T23:59:59`;
  query = query.lte('start_ts', endTimestamp);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const filteredBillings = sessions?.filter((s: any) => s.billing_calculations && s.billing_calculations.length > 0) || [];

  const exportData = filteredBillings?.map((session: any) => {
    const billing = session.billing_calculations[0];
    return {
      'Transaction ID': session.transaction_id || '',
      'Card Number': session.card_number || '',
      'Station': session.stations?.name || 'Unknown',
      'Station Code': session.stations?.station_code || '',
      'Session Start': format(new Date(session.start_ts), 'yyyy-MM-dd HH:mm:ss'),
      'Calculation Date': format(new Date(billing.calculation_date), 'yyyy-MM-dd HH:mm:ss'),
      'Subtotal (JOD)': parseFloat(billing.subtotal).toFixed(3),
      'Total Amount (JOD)': parseFloat(billing.total_amount).toFixed(3),
      'Currency': billing.currency
    };
  }) || [];

  const ws = XLSX.utils.json_to_sheet(exportData);

  ws['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
    { wch: 18 },
    { wch: 10 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Billing Report');

  const fileName = `billing-report-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]).size;
}

export async function exportBillingToCSV(startDate: Date, endDate: Date, stationId?: string, startTime?: string, endTime?: string): Promise<number> {
  let query = supabase
    .from('charging_sessions')
    .select(`
      transaction_id,
      station_id,
      start_ts,
      stations (
        name
      ),
      billing_calculations (
        calculation_date,
        subtotal,
        total_amount
      )
    `)
    .not('billing_calculations', 'is', null)
    .order('start_ts', { ascending: false });

  const startTimestamp = startTime
    ? `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`
    : `${format(startDate, 'yyyy-MM-dd')}T00:00:00`;
  query = query.gte('start_ts', startTimestamp);

  const endTimestamp = endTime
    ? `${format(endDate, 'yyyy-MM-dd')}T${endTime}:59`
    : `${format(endDate, 'yyyy-MM-dd')}T23:59:59`;
  query = query.lte('start_ts', endTimestamp);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const filteredBillings = sessions?.filter((s: any) => s.billing_calculations && s.billing_calculations.length > 0) || [];

  const exportData = filteredBillings?.map((session: any) => {
    const billing = session.billing_calculations[0];
    return {
      'Transaction ID': session.transaction_id || '',
      'Station': session.stations?.name || 'Unknown',
      'Session Start': format(new Date(session.start_ts), 'yyyy-MM-dd HH:mm'),
      'Subtotal (JOD)': parseFloat(billing.subtotal).toFixed(3),
      'Total (JOD)': parseFloat(billing.total_amount).toFixed(3)
    };
  }) || [];

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `billing-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return blob.size;
}

export async function exportBillingToPDF(startDate: Date, endDate: Date, stationId?: string, includeCharts: boolean = true, startTime?: string, endTime?: string, cardNumber?: string): Promise<number> {
  let stationName: string | null = null;
  let operatorName: string | null = null;

  if (stationId) {
    const { data: stationData } = await supabase
      .from('stations')
      .select('name')
      .eq('id', stationId)
      .maybeSingle();
    stationName = stationData?.name || null;
  }

  if (cardNumber) {
    const { data: operatorData } = await supabase
      .from('operators')
      .select('name')
      .eq('card_number', cardNumber)
      .maybeSingle();
    operatorName = operatorData?.name || null;
  }

  let query = supabase
    .from('charging_sessions')
    .select(`
      transaction_id,
      station_id,
      start_ts,
      duration_minutes,
      energy_consumed_kwh,
      stations (
        name
      ),
      billing_calculations (
        calculation_date,
        subtotal,
        total_amount
      )
    `)
    .not('billing_calculations', 'is', null)
    .order('start_ts', { ascending: false })
    .limit(500);

  const startTimestamp = startTime
    ? `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`
    : `${format(startDate, 'yyyy-MM-dd')}T00:00:00`;
  query = query.gte('start_ts', startTimestamp);

  const endTimestamp = endTime
    ? `${format(endDate, 'yyyy-MM-dd')}T${endTime}:59`
    : `${format(endDate, 'yyyy-MM-dd')}T23:59:59`;
  query = query.lte('start_ts', endTimestamp);

  if (stationId) {
    query = query.eq('station_id', stationId);
  }

  if (cardNumber) {
    query = query.eq('card_number', cardNumber);
  }

  const { data: sessions, error } = await query;

  if (error) throw error;

  const filteredBillings = sessions?.filter((s: any) => s.billing_calculations && s.billing_calculations.length > 0) || [];

  const totalEnergy = filteredBillings?.reduce((sum, s: any) => {
    const energy = s.energy_consumed_kwh;
    return sum + (energy ? parseFloat(energy) : 0);
  }, 0) || 0;

  const totalDuration = filteredBillings?.reduce((sum, s: any) => {
    const duration = s.duration_minutes;
    return sum + (duration ? parseFloat(duration) : 0);
  }, 0) || 0;

  const totalIncome = filteredBillings?.reduce((sum, s: any) => {
    const billing = s.billing_calculations?.[0];
    return sum + (billing ? parseFloat(billing.total_amount) : 0);
  }, 0) || 0;

  const doc = new jsPDF({ orientation: 'landscape', compress: true });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Billing Report', 148.5, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const periodText = startTime || endTime
    ? `Period: ${format(startDate, 'MMM dd, yyyy')} ${startTime || '00:00'} - ${format(endDate, 'MMM dd, yyyy')} ${endTime || '23:59'}`
    : `Period: ${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`;
  doc.text(periodText, 148.5, 22, { align: 'center' });

  let startY = 28;

  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(20, startY, 257, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Report Filters Applied', 25, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let filterText = `Date Range: ${format(startDate, 'MMM dd, yyyy')}`;
  if (startTime) filterText += ` ${startTime}`;
  filterText += ` to ${format(endDate, 'MMM dd, yyyy')}`;
  if (endTime) filterText += ` ${endTime}`;

  if (stationName) {
    filterText += ` • Station: ${stationName}`;
  }

  if (operatorName && cardNumber) {
    filterText += ` • Operator: ${operatorName} (${cardNumber})`;
  }

  doc.text(filterText, 25, startY + 12);

  startY = 53;

  doc.setFillColor(240, 248, 255);
  doc.rect(20, startY - 5, 257, 25, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Summary Metrics', 25, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  startY += 7;
  doc.text(`Total Energy: ${totalEnergy.toFixed(2)} kWh`, 25, startY);
  doc.text(`Total Duration: ${totalDuration.toFixed(0)} minutes`, 85, startY);
  doc.text(`Total Income: ${totalIncome.toFixed(2)} JOD`, 145, startY);

  startY += 6;
  doc.text(`Total Transactions: ${filteredBillings?.length || 0}`, 25, startY);

  startY += 12;

  const tableData = filteredBillings?.slice(0, 100).map((session: any) => {
    const billing = session.billing_calculations[0];
    return [
      session.transaction_id || '',
      (session.stations?.name || 'Unknown').substring(0, 25),
      format(new Date(session.start_ts), 'MM/dd/yy'),
      format(new Date(session.start_ts), 'HH:mm'),
      parseFloat(billing.subtotal).toFixed(2),
      parseFloat(billing.total_amount).toFixed(2)
    ];
  }) || [];

  const totalSubtotal = filteredBillings?.reduce((sum, s: any) => {
    const billing = s.billing_calculations?.[0];
    return sum + (billing ? parseFloat(billing.subtotal) : 0);
  }, 0) || 0;

  const footerData = [[
    '',
    '',
    '',
    'TOTALS',
    totalSubtotal.toFixed(2),
    totalIncome.toFixed(2)
  ]];

  autoTable(doc, {
    startY: startY,
    head: [['Transaction ID', 'Station', 'Date', 'Time', 'Subtotal\n(JOD)', 'Total\n(JOD)']],
    body: tableData,
    foot: footerData,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      fontSize: 7,
      lineWidth: 0.1,
      lineColor: [240, 240, 240]
    },
    footStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineWidth: 0.2,
      lineColor: [200, 200, 200]
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 30 }
    },
    margin: { left: 20, right: 20 }
  });

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `billing-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  return pdfBlob.size;
}

export async function generateMonthlySummary(month: Date): Promise<MonthlySummary> {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

  const startDateStr = format(startOfMonth, 'yyyy-MM-dd');
  const endDateStr = format(endOfMonth, 'yyyy-MM-dd');

  const { data: sessions, error: sessionsError } = await supabase
    .from('charging_sessions')
    .select(`
      *,
      stations (
        name
      ),
      billing_calculations (
        total_amount
      )
    `)
    .gte('start_date', startDateStr)
    .lte('start_date', endDateStr);

  if (sessionsError) throw sessionsError;

  const totalSessions = sessions?.length || 0;
  const totalEnergy = sessions?.reduce((sum, s) => sum + parseFloat(s.energy_consumed_kwh), 0) || 0;
  const totalDuration = sessions?.reduce((sum, s) => sum + parseFloat(s.duration_minutes), 0) || 0;
  const totalRevenue = sessions?.reduce((sum, s) => {
    const billing = s.billing_calculations?.[0];
    return sum + (billing ? parseFloat(billing.total_amount) : 0);
  }, 0) || 0;

  const stationMap = new Map<string, { sessions: number; energy: number; revenue: number }>();

  sessions?.forEach((session: any) => {
    const stationName = session.stations?.name || 'Unknown';
    const existing = stationMap.get(stationName) || { sessions: 0, energy: 0, revenue: 0 };

    const billing = session.billing_calculations?.[0];
    const revenue = billing ? parseFloat(billing.total_amount) : 0;

    stationMap.set(stationName, {
      sessions: existing.sessions + 1,
      energy: existing.energy + parseFloat(session.energy_consumed_kwh),
      revenue: existing.revenue + revenue
    });
  });

  const stationBreakdown = Array.from(stationMap.entries()).map(([name, data]) => ({
    stationName: name,
    sessions: data.sessions,
    energy: data.energy,
    revenue: data.revenue
  }));

  return {
    month: format(month, 'MMMM yyyy'),
    totalSessions,
    totalEnergy,
    totalRevenue,
    averageSessionDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
    averageEnergyPerSession: totalSessions > 0 ? totalEnergy / totalSessions : 0,
    averageRevenuePerSession: totalSessions > 0 ? totalRevenue / totalSessions : 0,
    stationBreakdown
  };
}

export async function exportSummaryToExcel(summary: MonthlySummary, includeCharts: boolean = true): Promise<number> {
  const summaryData = [
    { Metric: 'Month', Value: summary.month },
    { Metric: 'Total Sessions', Value: summary.totalSessions },
    { Metric: 'Total Energy (kWh)', Value: summary.totalEnergy.toFixed(3) },
    { Metric: 'Total Revenue (JOD)', Value: summary.totalRevenue.toFixed(3) },
    { Metric: 'Average Session Duration (min)', Value: summary.averageSessionDuration.toFixed(2) },
    { Metric: 'Average Energy per Session (kWh)', Value: summary.averageEnergyPerSession.toFixed(3) },
    { Metric: 'Average Revenue per Session (JOD)', Value: summary.averageRevenuePerSession.toFixed(3) }
  ];

  const ws1 = XLSX.utils.json_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 35 }, { wch: 20 }];

  const stationData = summary.stationBreakdown.map(station => ({
    'Station': station.stationName,
    'Sessions': station.sessions,
    'Energy (kWh)': station.energy.toFixed(3),
    'Revenue (JOD)': station.revenue.toFixed(3)
  }));

  const ws2 = XLSX.utils.json_to_sheet(stationData);
  ws2['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
  XLSX.utils.book_append_sheet(wb, ws2, 'Station Breakdown');

  const fileName = `monthly-summary-${summary.month.replace(' ', '-')}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]).size;
}

export async function exportSummaryToCSV(summary: MonthlySummary): Promise<number> {
  const stationData = summary.stationBreakdown.map(station => ({
    'Station': station.stationName,
    'Sessions': station.sessions,
    'Energy (kWh)': station.energy.toFixed(3),
    'Revenue (JOD)': station.revenue.toFixed(3)
  }));

  const ws = XLSX.utils.json_to_sheet(stationData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-${summary.month.replace(' ', '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return blob.size;
}

export async function exportSummaryToPDF(summary: MonthlySummary, includeCharts: boolean = true): Promise<number> {
  const doc = new jsPDF({ orientation: 'landscape', compress: true });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Monthly Summary Report', 148.5, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(summary.month, 148.5, 22, { align: 'center' });

  let startY = 35;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Overview', 20, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  startY += 7;
  doc.text(`Total Sessions: ${summary.totalSessions}`, 25, startY);
  startY += 6;
  doc.text(`Total Energy: ${summary.totalEnergy.toFixed(2)} kWh`, 25, startY);
  startY += 6;
  doc.text(`Total Revenue: ${summary.totalRevenue.toFixed(2)} JOD`, 25, startY);
  startY += 6;
  doc.text(`Avg Session Duration: ${summary.averageSessionDuration.toFixed(1)} min`, 25, startY);
  startY += 6;
  doc.text(`Avg Energy per Session: ${summary.averageEnergyPerSession.toFixed(2)} kWh`, 25, startY);
  startY += 6;
  doc.text(`Avg Revenue per Session: ${summary.averageRevenuePerSession.toFixed(2)} JOD`, 25, startY);

  startY += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Station Breakdown', 20, startY);
  startY += 5;

  const tableData = summary.stationBreakdown.map(station => [
    station.stationName,
    station.sessions.toString(),
    station.energy.toFixed(2),
    station.revenue.toFixed(2)
  ]);

  const footerData = [[
    'TOTALS',
    summary.totalSessions.toString(),
    summary.totalEnergy.toFixed(2),
    summary.totalRevenue.toFixed(2)
  ]];

  autoTable(doc, {
    startY: startY,
    head: [['Station', 'Sessions', 'Energy (kWh)', 'Revenue (JOD)']],
    body: tableData,
    foot: footerData,
    theme: 'plain',
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      fontSize: 8,
      lineWidth: 0.1,
      lineColor: [240, 240, 240]
    },
    footStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      lineWidth: 0.2,
      lineColor: [200, 200, 200]
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right', cellWidth: 30 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 40 }
    },
    margin: { left: 20, right: 20 }
  });

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-${summary.month.replace(' ', '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  return pdfBlob.size;
}
