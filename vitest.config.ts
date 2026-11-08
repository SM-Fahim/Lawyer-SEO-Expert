import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      // Everything stays local: no account access, and no binding can reach a real service.
      remoteBindings: false,
      miniflare: {
        // Production's settings must never apply here: LIVE would send real events to outside services.
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
          LIVE: 'false',
          REDDIT_TEST_ID: '',
          // Blank: Meta is off unless a test turns it on with its own fake ID and token.
          META_PIXEL_ID: '',
          META_CAPI_TOKEN: '',
        },
        // A second lock: anything a test forgets to mock fails instead of reaching the internet.
        outboundService: () => new Response('A test tried to reach the network', { status: 599 }),
        // Small fixture pages, so the router tests use the real assets binding without a site build.
        assets: {
          directory: './tests/worker/fixtures/site',
          binding: 'ASSETS',
          assetConfig: { html_handling: 'auto-trailing-slash', not_found_handling: '404-page' },
        },
      },
    })),
  ],
  test: {
    include: ['tests/worker/**/*.test.ts', 'tests/tracking/**/*.test.ts', 'tests/blog/**/*.test.ts', 'tests/lib/**/*.test.ts'],
    setupFiles: ['./tests/worker/apply-migrations.ts'],
    // The owner's PC runs short of memory.
    maxWorkers: 1,
  },
});
