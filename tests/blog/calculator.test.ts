import { describe, expect, it } from 'vitest';
import {
  calculate, comparisonLine, defaults, formatPercent, formatUsd, invalidFields, parseAmount, type CalcInput,
} from '../../src/lib/calculator';

const base: CalcInput = { settlement: 90000, feeRate: 100 / 3, costs: 6000, order: 'before', lien: 0, lienReduction: 0 };

describe('worked example from the post ($90,000, one third, $6,000 costs)', () => {
  it('costs first: fee $28,000, take-home $56,000', () => {
    const r = calculate(base);
    expect(r.fee).toBe(28000);
    expect(r.takeHome).toBe(56000);
    expect(r.otherTakeHome).toBe(54000);
    expect(r.orderDifference).toBe(2000);
  });
  it('costs after the fee: fee $30,000, take-home $54,000', () => {
    const r = calculate({ ...base, order: 'after' });
    expect(r.fee).toBe(30000);
    expect(r.takeHome).toBe(54000);
    expect(r.orderDifference).toBe(2000);
  });
});

describe('formula', () => {
  it('uses the spec defaults (33.3%)', () => {
    const r = calculate(defaults);
    expect(r.fee).toBe(27972);
    expect(r.takeHome).toBe(56028);
    expect(formatPercent(r.takeHomeShare!)).toBe('62.3%');
  });
  it('floors the fee at zero when costs exceed the settlement (costs first)', () => {
    const r = calculate({ ...base, settlement: 5000, costs: 6000 });
    expect(r.fee).toBe(0);
    expect(r.takeHome).toBe(-1000);
    expect(r.overdrawn).toBe(true);
  });
  it('applies the lien reduction', () => {
    const r = calculate({ ...base, lien: 10000, lienReduction: 25 });
    expect(r.lien).toBe(7500);
    expect(r.takeHome).toBe(48500);
  });
  it('gives no shares when the settlement is 0', () => {
    const r = calculate({ ...base, settlement: 0, costs: 0 });
    expect(r.fee).toBe(0);
    expect(r.takeHome).toBe(0);
    expect(r.feeShare).toBeNull();
    expect(r.takeHomeShare).toBeNull();
  });
  it('shows the difference between the two orders', () => {
    expect(comparisonLine('before', 2000)).toBe('Taking costs out before the fee changes your take-home by $2,000.');
  });
});

describe('input handling', () => {
  it('parses dollars with separators and rejects bad values', () => {
    expect(parseAmount('$90,000')).toBe(90000);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('flags values outside the limits', () => {
    expect(invalidFields({ settlement: 1e9, feeRate: 61, costs: 0, lien: 0, lienReduction: 101 })).toEqual(['settlement', 'feeRate', 'lienReduction']);
    expect(invalidFields({ settlement: 1, feeRate: 60, costs: 0, lien: 0, lienReduction: 100 })).toEqual([]);
    expect(invalidFields({ settlement: null, feeRate: 1, costs: 0, lien: 0, lienReduction: 0 })).toEqual(['settlement']);
  });
  it('formats US dollars', () => {
    expect(formatUsd(56028)).toBe('$56,028');
    expect(formatUsd(-1000)).toBe('-$1,000');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
  });
});
