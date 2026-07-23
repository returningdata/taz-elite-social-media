export type ApiErrorCode = 'BAD_REQUEST' | 'MISSING_CONFIGURATION' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'INTERNAL_ERROR';

export function apiSuccess(data: unknown, options: { cached?: boolean; maxAge?: number; staleWhileRevalidate?: number } = {}) {
  const maxAge = options.maxAge ?? 60;
  const stale = options.staleWhileRevalidate ?? maxAge * 2;
  return Response.json({ success: true, data, cached: options.cached ?? false, updatedAt: new Date().toISOString() }, {
    headers: {
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${stale}`,
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export function apiError(code: ApiErrorCode, message: string, status = 500, extraHeaders: Record<string, string> = {}) {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', ...extraHeaders }
  });
}

export async function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function upstreamError(service: string, status: number) {
  if (status === 401 || status === 403) return apiError('UNAUTHORIZED', `${service} authorization failed. Check the configured credentials.`, 503);
  if (status === 404) return apiError('NOT_FOUND', `${service} data could not be found.`, 404);
  if (status === 429) return apiError('RATE_LIMITED', `${service} is temporarily rate limited. Please try again later.`, 429, { 'Retry-After': '60' });
  return apiError('UPSTREAM_ERROR', `${service} returned an unexpected response.`, 502);
}

export function safeDiagnostic(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'request timed out';
  return error instanceof Error ? error.message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]') : 'unknown error';
}
