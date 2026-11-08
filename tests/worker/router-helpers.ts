import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { vi } from 'vitest';
import worker from '../../worker/index';

export const SITE = 'https://lawyerseoexpert.com';

/** Production settings. Override per test. */
export function envWith(overrides: Partial<Env> = {}): Env {
  return { ...env, LIVE: 'true', ...overrides };
}

/** The Worker has no origin behind it, so any fetch from these paths is a bug. It records and refuses. */
export function originMustNotBeCalled(): { requests: Request[] } {
  const requests: Request[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    requests.push(new Request(input as Request | string | URL, init as RequestInit));
    throw new Error('The Worker tried to reach an origin');
  });
  return { requests };
}

/** Calls the Worker's real fetch handler and waits for everything in ctx.waitUntil. */
export async function send(
  input: string | Request,
  options: { env?: Env; init?: RequestInit } = {},
): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, options.init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, options.env ?? envWith(), ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
