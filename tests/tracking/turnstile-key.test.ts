import { describe, expect, it } from 'vitest';
import { usesRealTurnstile } from '../../src/features/tracking/core';

describe('usesRealTurnstile', () => {
  it('is true on production and the pre-launch host', () => {
    expect(usesRealTurnstile('lawyerseoexpert.com')).toBe(true);
    expect(usesRealTurnstile('lawyerseoexpert-site.fahim-afd.workers.dev')).toBe(true);
  });
  it('is false on Previews and localhost', () => {
    expect(usesRealTurnstile('phase-5-qa-lawyerseoexpert-site.fahim-afd.workers.dev')).toBe(false);
    expect(usesRealTurnstile('localhost')).toBe(false);
  });
});
