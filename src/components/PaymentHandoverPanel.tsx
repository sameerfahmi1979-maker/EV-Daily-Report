import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Smartphone, Lock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  approveHandover,
  approveHandoverAdjustment,
  createHandoverAdjustment,
  createHandoverDraft,
  isHandoverWorkflowEnabled,
  listHandoverAdjustments,
  listHandoversForShift,
  lockHandover,
  rejectHandover,
  rejectHandoverAdjustment,
  reopenHandover,
  setHandoverManualTotals,
  submitHandover,
} from '../lib/paymentHandoverService';
import { requiresDiscrepancyReason, roundJod3, shortageSurplus, sumSettlement } from '../lib/paymentHandover';
import { formatJOD } from '../lib/billingService';

interface Props {
  shiftId?: string | null;
  shiftTotal?: number | null;
}

type SettlementInput = { cash: string; cliq: string; card: string; note: string };

const EDITABLE_STATUSES = ['draft', 'ready_to_submit', 'rejected', 'reopened'];

export default function PaymentHandoverPanel({ shiftId, shiftTotal }: Props) {
  const [hoEnabled, setHoEnabled] = useState(false);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [adjustmentsByHandover, setAdjustmentsByHandover] = useState<Record<string, any[]>>({});
  const [inputs, setInputs] = useState<Record<string, SettlementInput>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  async function reload() {
    if (!shiftId) return;
    setLoading(true);
    try {
      const list = await listHandoversForShift(shiftId);
      setHandovers(list);
      const adjMap: Record<string, any[]> = {};
      for (const h of list) {
        adjMap[h.id] = await listHandoverAdjustments(h.id);
      }
      setAdjustmentsByHandover(adjMap);
      // Seed editable inputs from server state, but don't clobber values the
      // user is actively editing for a handover already in local state.
      setInputs((prev) => {
        const next = { ...prev };
        for (const h of list) {
          if (!next[h.id]) {
            next[h.id] = {
              cash: h.cash_total ? String(h.cash_total) : '',
              cliq: h.cliq_total ? String(h.cliq_total) : '',
              card: h.card_total ? String(h.card_total) : '',
              note: h.discrepancy_reason || '',
            };
          }
        }
        return next;
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load handover data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    isHandoverWorkflowEnabled().then(setHoEnabled);
  }, []);

  useEffect(() => {
    if (hoEnabled) reload();
  }, [hoEnabled, shiftId]);

  const expectedTotal = useMemo(() => roundJod3(Number(shiftTotal) || 0), [shiftTotal]);

  function getInput(handoverId: string): SettlementInput {
    return inputs[handoverId] || { cash: '', cliq: '', card: '', note: '' };
  }

  function setInput(handoverId: string, patch: Partial<SettlementInput>) {
    setInputs((prev) => ({ ...prev, [handoverId]: { ...getInput(handoverId), ...patch } }));
  }

  if (!hoEnabled) {
    return null;
  }

  const activeHandover = handovers.find((h) => h.status !== 'cancelled' && h.status !== 'rejected');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Shift Cash Settlement</h3>
        <button
          onClick={reload}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
          type="button"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {message && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
          {message}
        </div>
      )}

      <div className="text-sm bg-slate-50 rounded-lg p-3 flex items-center justify-between">
        <span className="text-slate-600">Total Sales for this Shift</span>
        <span className="font-semibold text-slate-900">{formatJOD(expectedTotal)}</span>
      </div>

      {!activeHandover && shiftId && (
        <button
          type="button"
          className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-sm"
          disabled={loading}
          onClick={async () => {
            try {
              const r = await createHandoverDraft(shiftId);
              setMessage(`Handover ${r.handover_number} started`);
              await reload();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Failed to start handover');
            }
          }}
        >
          Start Handover
        </button>
      )}

      {handovers.map((h) => {
        const input = getInput(h.id);
        const editable = EDITABLE_STATUSES.includes(h.status);
        const cash = Number(input.cash) || 0;
        const cliq = Number(input.cliq) || 0;
        const card = Number(input.card) || 0;
        const totalEntered = sumSettlement(cash, cliq, card);
        const approvedAdjustments = (adjustmentsByHandover[h.id] || [])
          .filter((a) => a.status === 'approved')
          .reduce((s, a) => s + (a.cash_impact === 'increase' ? 1 : -1) * Number(a.amount_jod || 0), 0);
        // While editable, mirror the server's live calculation (current shift
        // total + approved adjustments); once finalized, use the stored snapshot.
        const expected = editable
          ? roundJod3(expectedTotal + approvedAdjustments)
          : roundJod3(Number(h.billing_total || 0) + Number(h.net_adjustments || 0));
        const { shortage, surplus } = shortageSurplus(expected, totalEntered);
        const needsNote = requiresDiscrepancyReason(shortage, surplus);

        return (
          <div key={h.id} className="border rounded-lg p-3 text-sm space-y-3 bg-slate-50">
            <div className="flex justify-between items-center">
              <span className="font-medium">{h.handover_number}</span>
              <span className="uppercase tracking-wide text-xs px-2 py-0.5 rounded bg-white border">
                {h.status.replace(/_/g, ' ')}
              </span>
            </div>

            {editable ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="text-xs text-slate-600 flex flex-col gap-1">
                    <span className="flex items-center gap-1"><Banknote size={12} /> Cash (JOD)</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={input.cash}
                      onChange={(e) => setInput(h.id, { cash: e.target.value })}
                      className="border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600 flex flex-col gap-1">
                    <span className="flex items-center gap-1"><Smartphone size={12} /> CliQ (JOD)</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={input.cliq}
                      onChange={(e) => setInput(h.id, { cliq: e.target.value })}
                      className="border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600 flex flex-col gap-1">
                    <span className="flex items-center gap-1"><CreditCard size={12} /> Card (JOD)</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={input.card}
                      onChange={(e) => setInput(h.id, { card: e.target.value })}
                      className="border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>

                <div className={`flex items-center gap-2 rounded-lg p-2 text-xs ${
                  shortage > 0.0005 ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  {shortage > 0.0005 || surplus > 0.0005 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                  <span>
                    Total entered {formatJOD(totalEntered)} vs expected {formatJOD(expected)} —{' '}
                    {shortage > 0.0005
                      ? `Shortage of ${formatJOD(shortage)} (miss — will be deducted from operator's salary)`
                      : surplus > 0.0005
                      ? `Surplus of ${formatJOD(surplus)} (extra amount)`
                      : 'Balanced'}
                  </span>
                </div>

                {needsNote && (
                  <textarea
                    placeholder="Reason for shortage/surplus (required)"
                    value={input.note}
                    onChange={(e) => setInput(h.id, { note: e.target.value })}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm"
                    rows={2}
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving === h.id}
                    className="px-2 py-1 bg-slate-800 text-white rounded text-xs disabled:opacity-50"
                    onClick={async () => {
                      if (needsNote && !input.note.trim()) {
                        setMessage('Please enter a reason for the shortage/surplus before saving');
                        return;
                      }
                      setSaving(h.id);
                      try {
                        await setHandoverManualTotals(h.id, cash, cliq, card, input.note.trim() || null);
                        setMessage('Totals saved');
                        await reload();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : 'Failed to save totals');
                      } finally {
                        setSaving(null);
                      }
                    }}
                  >
                    Save Totals
                  </button>
                  {h.status === 'ready_to_submit' && (
                    <button
                      type="button"
                      disabled={saving === h.id}
                      className="px-2 py-1 bg-blue-700 text-white rounded text-xs disabled:opacity-50"
                      onClick={async () => {
                        setSaving(h.id);
                        try {
                          await submitHandover(h.id);
                          setMessage('Submitted');
                          await reload();
                        } catch (e) {
                          setMessage(e instanceof Error ? e.message : 'Submit failed');
                        } finally {
                          setSaving(null);
                        }
                      }}
                    >
                      Submit Handover
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>Cash {h.cash_total}</div>
                <div>CliQ {h.cliq_total}</div>
                <div>Card {h.card_total}</div>
                <div>Expected {h.expected_cash}</div>
                <div>Shortage {h.shortage_amount}</div>
                <div>Surplus {h.surplus_amount}</div>
                {h.discrepancy_reason && (
                  <div className="col-span-2 md:col-span-4 text-xs text-slate-600">Note: {h.discrepancy_reason}</div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {['submitted', 'under_review', 'reopened'].includes(h.status) && (
                <>
                  <button
                    type="button"
                    className="px-2 py-1 bg-emerald-700 text-white rounded text-xs"
                    onClick={async () => {
                      try {
                        await approveHandover(h.id);
                        setMessage('Approved');
                        await reload();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : 'Approve failed');
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 bg-red-700 text-white rounded text-xs"
                    onClick={async () => {
                      const reason = window.prompt('Rejection reason (required)') || '';
                      if (!reason.trim()) return;
                      try {
                        await rejectHandover(h.id, reason);
                        setMessage('Rejected');
                        await reload();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : 'Reject failed');
                      }
                    }}
                  >
                    Reject
                  </button>
                </>
              )}
              {h.status === 'approved' && (
                <button
                  type="button"
                  className="px-2 py-1 bg-slate-800 text-white rounded text-xs flex items-center gap-1"
                  onClick={async () => {
                    try {
                      await lockHandover(h.id);
                      setMessage('Locked');
                      await reload();
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : 'Lock failed');
                    }
                  }}
                >
                  <Lock size={12} /> Lock
                </button>
              )}
              {h.status === 'locked' && (
                <button
                  type="button"
                  className="px-2 py-1 bg-amber-700 text-white rounded text-xs"
                  onClick={async () => {
                    const reason = window.prompt('Reopen reason (required)') || '';
                    if (!reason) return;
                    try {
                      await reopenHandover(h.id, reason);
                      setMessage('Reopened');
                      await reload();
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : 'Reopen failed');
                    }
                  }}
                >
                  Reopen
                </button>
              )}
            </div>

            {h.status !== 'locked' && (
              <div className="pt-1">
                <button
                  type="button"
                  className="text-xs text-slate-600 underline"
                  onClick={async () => {
                    const impact = window.prompt('Adjustment direction: type "increase" or "decrease"', 'increase');
                    if (impact !== 'increase' && impact !== 'decrease') return;
                    const amountStr = window.prompt('Amount (JOD, positive number)');
                    const amount = Number(amountStr);
                    if (!amountStr || Number.isNaN(amount) || amount <= 0) return;
                    const reason = window.prompt('Reason (required)') || '';
                    if (!reason.trim()) return;
                    try {
                      await createHandoverAdjustment(h.id, impact, amount, reason);
                      setMessage('Adjustment created (pending approval)');
                      await reload();
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : 'Create adjustment failed');
                    }
                  }}
                >
                  + Add adjustment (affects expected total)
                </button>
              </div>
            )}

            {(adjustmentsByHandover[h.id] || []).length > 0 && (
              <div className="border-t pt-2 space-y-1">
                {(adjustmentsByHandover[h.id] || []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border">
                    <span>
                      {a.cash_impact === 'increase' ? '+' : '-'}{Number(a.amount_jod).toFixed(3)} — {a.reason}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`uppercase px-1.5 py-0.5 rounded ${
                        a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        a.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {a.status}
                      </span>
                      {a.status === 'pending' && h.status !== 'locked' && (
                        <>
                          <button
                            type="button"
                            className="text-emerald-700 underline"
                            onClick={async () => {
                              try {
                                await approveHandoverAdjustment(a.id);
                                setMessage('Adjustment approved');
                                await reload();
                              } catch (e) {
                                setMessage(e instanceof Error ? e.message : 'Approve adjustment failed');
                              }
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="text-red-700 underline"
                            onClick={async () => {
                              const reason = window.prompt('Rejection reason (required)') || '';
                              if (!reason.trim()) return;
                              try {
                                await rejectHandoverAdjustment(a.id, reason);
                                setMessage('Adjustment rejected');
                                await reload();
                              } catch (e) {
                                setMessage(e instanceof Error ? e.message : 'Reject adjustment failed');
                              }
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
