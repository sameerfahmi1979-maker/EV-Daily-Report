export const CURRENCY = {
  CODE: 'JOD',
  DECIMALS: 3,
  SYMBOL: 'JOD',
} as const;

export function formatJOD(amount: number): string {
  return `${amount.toFixed(CURRENCY.DECIMALS)} ${CURRENCY.CODE}`;
}

export function parseJOD(formattedAmount: string): number {
  const cleaned = formattedAmount.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

export function roundJOD(amount: number): number {
  return Math.round(amount * 1000) / 1000;
}

export function formatJODShort(amount: number): string {
  return amount.toFixed(CURRENCY.DECIMALS);
}
