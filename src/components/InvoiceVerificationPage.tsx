import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Zap, Clock, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { formatJOD } from '../lib/billingService';

interface VerifiedInvoice {
  ok: true;
  invoice_number: string;
  invoice_date: string;
  verified_at: string;
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
    fees: number | null;
    taxes: number | null;
    total_amount: number;
    currency: string;
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
  fixed_charges: Array<{ name?: string; charge_name?: string; amount: number }>;
  station: { name: string; station_code: string | null };
  operator: { name: string | null };
}

interface VerifyError {
  ok: false;
  error: string;
}

type VerifyResult = VerifiedInvoice | VerifyError;

export default function InvoiceVerificationPage({ token }: { token: string }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('verify_invoice_public', { p_token: token });
        if (cancelled) return;
        if (error) {
          setFatalError(error.message);
        } else {
          setResult(data as VerifyResult);
        }
      } catch (e) {
        if (!cancelled) setFatalError(e instanceof Error ? e.message : 'Verification failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-2xl">
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-slate-500 text-sm">Verifying invoice…</p>
          </div>
        )}

        {!loading && (fatalError || (result && !result.ok)) && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <XCircle className="w-14 h-14 text-red-500 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-slate-900">Invoice Not Verified</h1>
            <p className="text-sm text-slate-500 mt-2">
              {fatalError || (result && !result.ok ? result.error : 'This link is invalid or has expired.')}
            </p>
          </div>
        )}

        {!loading && result && result.ok && (
          <InvoiceCard invoice={result} />
        )}

        <p className="text-center text-xs text-slate-400 mt-6">
          This page verifies the authenticity of an EV charging invoice. No login is required.
        </p>
      </div>
    </div>
  );
}

function InvoiceCard({ invoice }: { invoice: VerifiedInvoice }) {
  const s = invoice.session;
  const b = invoice.billing;
  const totalFixed = (invoice.fixed_charges || []).reduce((sum, fc) => sum + (Number(fc.amount) || 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Verified banner */}
      <div className="bg-emerald-600 text-white px-6 py-4 flex items-center gap-3">
        <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
        <div>
          <p className="font-bold leading-tight">Verified Genuine Invoice</p>
          <p className="text-xs text-emerald-100">
            Checked {format(new Date(invoice.verified_at), 'dd MMM yyyy, HH:mm')}
          </p>
        </div>
        <ShieldCheck className="w-5 h-5 ml-auto opacity-80" />
      </div>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <p className="text-sm text-slate-500">
              Issued {format(new Date(invoice.invoice_date), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total Amount</p>
            <p className="text-2xl font-bold text-blue-700">{formatJOD(b.total_amount)}</p>
          </div>
        </div>

        {/* Station / operator / card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-slate-500 text-xs">Station</p>
              <p className="font-medium text-slate-800">
                {invoice.station.name}{invoice.station.station_code ? ` (${invoice.station.station_code})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
            <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div>
              <p className="text-slate-500 text-xs">Card / Operator</p>
              <p className="font-medium text-slate-800">
                {s.card_number}{invoice.operator?.name ? ` — ${invoice.operator.name}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Session details */}
        <div className="border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Session Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Transaction ID</p>
              <p className="font-medium text-slate-800 break-all">{s.transaction_id}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Charge ID</p>
              <p className="font-medium text-slate-800 break-all">{s.charge_id}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Start</p>
              <p className="font-medium text-slate-800">{format(new Date(s.start_ts), 'dd/MM/yy HH:mm:ss')}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> End</p>
              <p className="font-medium text-slate-800">{format(new Date(s.end_ts), 'dd/MM/yy HH:mm:ss')}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Duration</p>
              <p className="font-medium text-slate-800">
                {Number(s.duration_minutes).toFixed(0)} min ({(Number(s.duration_minutes) / 60).toFixed(2)} h)
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs flex items-center gap-1"><Zap className="w-3 h-3" /> Energy</p>
              <p className="font-medium text-slate-800">{Number(s.energy_consumed_kwh).toFixed(3)} kWh</p>
            </div>
          </div>
        </div>

        {/* Billing breakdown */}
        {invoice.breakdown.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Billing Breakdown</h2>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Period</th>
                    <th className="px-3 py-2 text-right">Duration (min)</th>
                    <th className="px-3 py-2 text-right">Energy (kWh)</th>
                    <th className="px-3 py-2 text-right">Rate (JOD/kWh)</th>
                    <th className="px-3 py-2 text-right">Energy Charge</th>
                    <th className="px-3 py-2 text-right">Demand (kW)</th>
                    <th className="px-3 py-2 text-right">Demand Charge</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.breakdown.map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">{item.period_name}</td>
                      <td className="px-3 py-2 text-right">{Number(item.duration_minutes).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{Number(item.energy_kwh).toFixed(3)}</td>
                      <td className="px-3 py-2 text-right">{Number(item.rate_per_kwh).toFixed(3)}</td>
                      <td className="px-3 py-2 text-right">{formatJOD(item.energy_charge)}</td>
                      <td className="px-3 py-2 text-right">{item.demand_kw ? Number(item.demand_kw).toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 text-right">{item.demand_charge ? formatJOD(item.demand_charge) : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatJOD(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fixed charges */}
        {invoice.fixed_charges.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Fixed Charges</h2>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {invoice.fixed_charges.map((fc, i) => (
                <div key={i} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-slate-600">{fc.charge_name || fc.name || 'Fixed Charge'}</span>
                  <span className="font-medium text-slate-800">{formatJOD(fc.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="bg-slate-50 rounded-lg p-4 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatJOD(b.subtotal)}</span>
          </div>
          {totalFixed > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Fixed Charges</span>
              <span>{formatJOD(totalFixed)}</span>
            </div>
          )}
          {Number(b.taxes) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Taxes</span>
              <span>{formatJOD(b.taxes || 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Total</span>
            <span>{formatJOD(b.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
