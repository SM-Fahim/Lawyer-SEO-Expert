/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookingSource } from '../../src/scripts/booking-source';

afterEach(() => vi.unstubAllGlobals());

const withTouch = (touch: Record<string, string>) => vi.stubGlobal('window', { lse: { touch: () => touch } });

describe('the source each Calendly booking carries', () => {
  it('marks the site in utm_content when the visitor brought no tags', () => {
    withTouch({});
    expect(bookingSource()).toEqual({ utm_content: 'lawyerseoexpert.com' });
  });

  it('keeps the referring site as utm_source next to the site mark', () => {
    withTouch({ referrer: 'google.com' });
    expect(bookingSource()).toEqual({ utm_source: 'google.com', utm_content: 'lawyerseoexpert.com' });
  });

  it('never overwrites the visitor own utm_content', () => {
    withTouch({ utm_source: 'reddit', utm_campaign: 'spring', utm_content: 'ad-7' });
    expect(bookingSource()).toEqual({ utm_source: 'reddit', utm_campaign: 'spring', utm_content: 'ad-7' });
  });

  it('still marks the site when the tracker is missing or opted out', () => {
    vi.stubGlobal('window', {});
    expect(bookingSource()).toEqual({ utm_content: 'lawyerseoexpert.com' });
  });
});
