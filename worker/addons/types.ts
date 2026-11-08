/** A server feature that answers one path. */
export interface RouteAddon {
  path: string;
  handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response;
}

/** A job the 5-minute cron runs. A failing job can't stop the ones after it. */
export interface CronJob {
  name: string;
  run(env: Env): Promise<unknown>;
}
