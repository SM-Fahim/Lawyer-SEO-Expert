import { errorText, logError } from '../log';
import { eventsRoute, eventsRetentionJob } from './events';
import { healthRoute } from './health';
import { leadRoute, leadsRetentionJob, outboxJob } from './lead';
import type { CronJob, RouteAddon } from './types';

// Server features, in order. To add one: write its handler in this folder and list it here.
const routes: RouteAddon[] = [healthRoute, leadRoute, eventsRoute];
const cronJobs: CronJob[] = [outboxJob, eventsRetentionJob, leadsRetentionJob];

/** The response for an add-on path, or null so the caller carries on with its own routing. */
export async function handleAddon(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const route = routes.find((candidate) => candidate.path === pathname);
  return route ? route.handle(request, env, ctx) : null;
}

export async function runCronJobs(env: Env): Promise<void> {
  for (const job of cronJobs) {
    try {
      await job.run(env);
    } catch (error) {
      logError('cron_job_failed', { job: job.name, error: errorText(error) });
    }
  }
}
