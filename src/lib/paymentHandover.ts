/**
 * EV-D payment allocation + cash handover helpers (client + pure formulas).
 */

export type PaymentMethod = 'Cash' | 'Card' | 'CliQ';

export function roundJod3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function expectedPhysicalCash(params: {
  cashTotal: number;
  approvedIncrease: number;
  approvedDecrease: number;
}): number {
  return roundJod3(params.cashTotal + params.approvedIncrease - params.approvedDecrease);
}

export function shortageSurplus(expected: number, actual: number | null | undefined) {
  if (actual == null || Number.isNaN(actual)) {
    return { shortage: 0, surplus: 0, difference: null as number | null };
  }
  const difference = roundJod3(actual - expected);
  return {
    difference,
    shortage: roundJod3(Math.max(expected - actual, 0)),
    surplus: roundJod3(Math.max(actual - expected, 0)),
  };
}

export function requiresDiscrepancyReason(shortage: number, surplus: number): boolean {
  return roundJod3(shortage) > 0.0005 || roundJod3(surplus) > 0.0005;
}

/**
 * Manual Shift Cash Settlement: sums the three manually-entered totals
 * (Cash + CliQ + Card) the station manager enters at handover time. The
 * result is compared to the shift's total sales via shortageSurplus().
 */
export function sumSettlement(cash: number, cliq: number, card: number): number {
  return roundJod3((Number(cash) || 0) + (Number(cliq) || 0) + (Number(card) || 0));
}

export function paymentReconciliationOk(params: {
  billingTotal: number;
  cashTotal: number;
  cardTotal: number;
  cliqTotal: number;
  unassignedCount: number;
  tolerance?: number;
}): boolean {
  const tol = params.tolerance ?? 0.001;
  const sum = roundJod3(params.cashTotal + params.cardTotal + params.cliqTotal);
  return params.unassignedCount === 0 && Math.abs(roundJod3(params.billingTotal) - sum) <= tol;
}

export function summarizeByMethod(
  rows: Array<{ payment_method: string; amount_jod: number }>
): { cash: number; card: number; cliq: number; billing: number } {
  let cash = 0;
  let card = 0;
  let cliq = 0;
  let billing = 0;
  for (const r of rows) {
    const a = Number(r.amount_jod) || 0;
    billing += a;
    if (r.payment_method === 'Cash') cash += a;
    else if (r.payment_method === 'Card') card += a;
    else if (r.payment_method === 'CliQ') cliq += a;
  }
  return {
    cash: roundJod3(cash),
    card: roundJod3(card),
    cliq: roundJod3(cliq),
    billing: roundJod3(billing),
  };
}
