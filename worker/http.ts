const NO_STORE = { 'cache-control': 'no-store' };

export function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const response = Response.json(data, { status, headers: NO_STORE });
  new Headers(headers).forEach((value, key) => response.headers.set(key, value));
  return response;
}

export function emptyResponse(status: number, headers: HeadersInit = {}): Response {
  const response = new Response(null, { status, headers: NO_STORE });
  new Headers(headers).forEach((value, key) => response.headers.set(key, value));
  return response;
}

export function methodNotAllowed(allow: string): Response {
  return emptyResponse(405, { allow });
}
