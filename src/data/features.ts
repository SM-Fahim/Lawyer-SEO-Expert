// Sitewide add-ons. Base.astro renders whatever is on, so a new sitewide feature never means editing each page.
//
// To add one: make a folder in src/features/<name>/ with one .astro file, then add a line here.
// To switch one off: set on to false.
// To skip pages: list their paths in exclude. A trailing * matches a prefix, like '/blog/*'.
import BookingDialog from '../features/booking-dialog/BookingDialog.astro';
import Tracking from '../features/tracking/Tracking.astro';

export interface Feature {
  name: string;
  on: boolean;
  /** 'head' renders early in <head>. 'body' renders after the footer. */
  spot: 'head' | 'body';
  exclude?: string[];
  component: (props: Record<string, never>) => unknown;
}

// TODO(design): LCME also had an exit-intent offer, a sticky mobile bar and an image zoom here. LSE leaves them
// out until the design phase decides it wants them (docs/DECISIONS.md). Add a line below to switch a feature on.
export const features: Feature[] = [
  { name: 'tracking', on: true, spot: 'head', component: Tracking },
  { name: 'booking-dialog', on: true, spot: 'body', component: BookingDialog },
];

function matches(path: string, pattern: string): boolean {
  return pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
}

export function featuresFor(path: string, spot: Feature['spot']): Feature[] {
  return features.filter((f) => f.on && f.spot === spot && !f.exclude?.some((pattern) => matches(path, pattern)));
}
