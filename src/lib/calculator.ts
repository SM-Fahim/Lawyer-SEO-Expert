// The PI settlement and attorney fee calculator's maths. Spec: the "Calculator spec" section of
// content/posts/pi-settlement-and-attorney-fee-calculator.md. No DOM here, so Vitest can test it
// (tests/blog/calculator.test.ts) and the page can pre-render the defaults at build time.

export type CostOrder = 'before' | 'after';

export interface CalcInput {
  /** Settlement or offer, dollars. */
  settlement: number;
  /** Attorney fee rate, percent (33.3 means 33.3%). */
  feeRate: number;
  /** Case costs, dollars. */
  costs: number;
  /** Whether costs come out before or after the fee is figured. */
  order: CostOrder;
  /** Medical liens and bills to repay, dollars. */
  lien: number;
  /** Expected lien reduction, percent. */
  lienReduction: number;
}

export interface CalcResult {
  fee: number;
  costs: number;
  /** The lien after the reduction. */
  lien: number;
  takeHome: number;
  /** Fee as a share of the settlement, 0 to 1, or null when the settlement is 0. */
  feeShare: number | null;
  /** Take-home as a share of the settlement, or null when the settlement is 0. */
  takeHomeShare: number | null;
  /** Take-home if costs came out in the other order. */
  otherTakeHome: number;
  /** Absolute difference between the two orders. */
  orderDifference: number;
  /** True when the deductions are more than the settlement. */
  overdrawn: boolean;
}

export interface FieldSpec {
  key: keyof Omit<CalcInput, 'order'>;
  min: number;
  max: number;
}

export const defaults: CalcInput = {
  settlement: 90000,
  feeRate: 33.3,
  costs: 6000,
  order: 'before',
  lien: 0,
  lienReduction: 0,
};

export const limits: readonly FieldSpec[] = [
  { key: 'settlement', min: 0, max: 100_000_000 },
  { key: 'feeRate', min: 0, max: 60 },
  { key: 'costs', min: 0, max: 10_000_000 },
  { key: 'lien', min: 0, max: 100_000_000 },
  { key: 'lienReduction', min: 0, max: 100 },
];

const cents = (n: number) => Math.round(n * 100) / 100;

function feeFor(settlement: number, rate: number, costs: number, order: CostOrder): number {
  const base = order === 'before' ? Math.max(settlement - costs, 0) : settlement;
  return cents(rate * base);
}

/** Pure calculation. Inputs must already be valid (see validate). */
export function calculate(input: CalcInput): CalcResult {
  const { settlement: S, costs: C, order } = input;
  const r = input.feeRate / 100;
  const L = cents(input.lien * (1 - input.lienReduction / 100));
  const fee = feeFor(S, r, C, order);
  const takeHome = cents(S - fee - C - L);
  const otherOrder: CostOrder = order === 'before' ? 'after' : 'before';
  const otherTakeHome = cents(S - feeFor(S, r, C, otherOrder) - C - L);
  return {
    fee,
    costs: C,
    lien: L,
    takeHome,
    feeShare: S > 0 ? fee / S : null,
    takeHomeShare: S > 0 ? takeHome / S : null,
    otherTakeHome,
    orderDifference: cents(Math.abs(takeHome - otherTakeHome)),
    overdrawn: takeHome < 0,
  };
}

/** Parses a typed value: "$90,000" and "90000.50" work; negatives, blanks and text give null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Field keys whose values are missing or outside their limits. */
export function invalidFields(values: Partial<Record<FieldSpec['key'], number | null>>): FieldSpec['key'][] {
  return limits
    .filter(({ key, min, max }) => {
      const v = values[key];
      return v == null || v < min || v > max;
    })
    .map(({ key }) => key);
}

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/** US dollars, no cents when whole: $56,028. A negative is -$1,200. */
export function formatUsd(n: number): string {
  const v = n === 0 ? 0 : n;
  return Number.isInteger(v) ? usdWhole.format(v) : usdCents.format(v);
}

/** A share as a percent with one decimal when needed: 62.3%. */
export function formatPercent(share: number): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(share * 100)}%`;
}

export const OVERDRAWN_MESSAGE = 'The deductions are more than the settlement. Ask your lawyer to explain the statement.';

export function comparisonLine(order: CostOrder, difference: number): string {
  return `Taking costs out ${order} the fee changes your take-home by ${formatUsd(difference)}.`;
}
