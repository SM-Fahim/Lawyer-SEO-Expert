import { jsonResponse, methodNotAllowed } from '../http';
import { errorText, logError } from '../log';
import { outboxStuck } from '../outbox';
import type { RouteAddon } from './types';

// For the uptime monitor. No other detail, because this URL is public. Anything wrong also
// returns 503, so a monitor that only reads the status code still alerts.
export const healthRoute: RouteAddon = {
  path: '/api/health',
  async handle(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed('GET, HEAD');
    try {
      const stuck = await outboxStuck(env.DB);
      return jsonResponse({ ok: !stuck, outboxStuck: stuck }, stuck ? 503 : 200);
    } catch (error) {
      logError('health_check_failed', { error: errorText(error) });
      return jsonResponse({ ok: false, outboxStuck: false }, 503);
    }
  },
};
