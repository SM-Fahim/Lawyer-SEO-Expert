import { runCronJobs } from './addons';
import { route } from './router';

// Add-ons, redirects, live pages and WordPress are all in router.ts. Cron jobs are in addons/.
export default {
  fetch: route,

  async scheduled(_controller, env): Promise<void> {
    await runCronJobs(env);
  },
} satisfies ExportedHandler<Env>;
