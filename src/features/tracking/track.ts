// What the rest of the site calls. The tracker itself is inlined in <head> (tracker.ts) and only
// exists on window.lse when tracking is allowed on this page. So all of these do nothing for bots,
// on pre-launch hosts, with the notrack cookie, or with the tracking feature switched off.

export type StoredEvent = 'BookingDialogOpened' | 'ExitOfferShown';

export interface TrackOptions {
  conversionId?: string;
  value?: number;
  currency?: string;
}

export interface LeadContact {
  conversionId: string;
  email?: string | undefined;
  phone?: string | undefined;
  /** Full name, for Meta's hashed first and last name. Never sent to Reddit. */
  name?: string | undefined;
}

export interface Tracker {
  /** Pixel and /api/activity, one shared ID. Returns the ID. */
  track(name: string, options?: TrackOptions): string;
  /** /api/activity only. Stored in D1, never sent to Reddit. */
  store(name: StoredEvent): void;
  /** Pixels only, after /api/lead has answered. Hashes the contact details first. */
  lead(contact: LeadContact): Promise<void>;
  /** Attribution for the /api/lead body. */
  fields(): Record<string, string | number>;
  /** Where this visitor last came from: UTM values, `referrer` and `landing`. */
  touch(): Record<string, string>;
}

declare global {
  interface Window {
    lse?: Tracker;
  }
}

// Tracking must never get in the way of a page or a lead, so an error in the tracker is swallowed here.
export const trackStored = (name: StoredEvent): void => {
  try {
    window.lse?.store(name);
  } catch {
    // Nothing to do.
  }
};

export const trackLead = (contact: LeadContact): void => {
  try {
    window.lse?.lead(contact).catch(() => undefined);
  } catch {
    // Nothing to do.
  }
};

/** Empty when the tracker is missing or throws, so an opted-out visitor's source goes nowhere. */
export const currentTouch = (): Record<string, string> => {
  try {
    return window.lse?.touch() ?? {};
  } catch {
    return {};
  }
};

/** Empty when the tracker is missing or throws, so the lead still posts without its tracking fields. */
export const leadAttribution = (): Record<string, string | number> => {
  try {
    return window.lse?.fields() ?? {};
  } catch {
    return {};
  }
};
