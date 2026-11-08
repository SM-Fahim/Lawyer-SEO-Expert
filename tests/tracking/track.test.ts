/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leadAttribution, trackLead, trackStored } from '../../src/features/tracking/track';

afterEach(() => vi.unstubAllGlobals());

describe('tracking helpers never throw into the page', () => {
  const boom = () => {
    throw new Error('tracker broke');
  };

  it('leadAttribution gives an empty object when fields() throws, so the lead still posts', () => {
    vi.stubGlobal('window', { lse: { fields: boom } });
    expect(leadAttribution()).toEqual({});
  });

  it('is empty with no tracker at all', () => {
    vi.stubGlobal('window', {});
    expect(leadAttribution()).toEqual({});
  });

  it('trackLead and trackStored swallow errors, sync or async', async () => {
    vi.stubGlobal('window', { lse: { lead: boom, store: boom } });
    expect(() => trackLead({ conversionId: 'x' })).not.toThrow();
    expect(() => trackStored('BookingDialogOpened')).not.toThrow();
    vi.stubGlobal('window', { lse: { lead: () => Promise.reject(new Error('late')) } });
    expect(() => trackLead({ conversionId: 'x' })).not.toThrow();
    await Promise.resolve();
  });
});
