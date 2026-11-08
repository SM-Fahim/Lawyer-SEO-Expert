import { defineConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '8791';

export default defineConfig({
  testDir: 'tests/e2e',
  // One browser at a time against one local server. The owner's PC runs short of memory.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    // Headless Chromium's own user agent says HeadlessChrome, which the tracker treats as a bot.
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // A second lock behind the route handlers in helpers.ts: the browser can't resolve any outside
      // host at all, so a mistake in a test can never reach Reddit, Turnstile or the live site.
      args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'],
    },
  },
  webServer: {
    command: 'node tests/e2e/serve.mjs',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { E2E_PORT: PORT },
  },
});
