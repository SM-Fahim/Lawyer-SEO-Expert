// The owner's and developers' opt-out, set by visiting /?notrack=1. The browser tracker and the
// Worker both use this, so they can't disagree about what the cookie means.
export const hasNoTrackCookie = (cookie: string | null): boolean =>
  /(?:^|;\s*)lse_notrack=1(?:;|$)/.test(cookie ?? '');
