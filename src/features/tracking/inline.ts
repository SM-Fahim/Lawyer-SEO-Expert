// Compiles tracker.ts to one small script for the early <head>. It runs at build time only.
import { join } from 'node:path';
import { build } from 'esbuild';
import { site } from '../../data/site';

let compiled: Promise<string> | undefined;

export function trackerScript(): Promise<string> {
  compiled ??= build({
    entryPoints: [join(process.cwd(), 'src/features/tracking/tracker.ts')],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    define: {
      __PIXEL_ID__: JSON.stringify(site.tracking.redditPixelId),
      __GA4_ID__: JSON.stringify(site.tracking.ga4MeasurementId),
      __META_PIXEL_ID__: JSON.stringify(site.tracking.metaPixelId),
    },
  }).then((result) => result.outputFiles[0]?.text.trim() ?? '');
  return compiled;
}
