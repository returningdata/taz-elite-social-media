export class IntegrationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function fetchIntegration<T>(url: string, timeoutMs = 10000): Promise<{ data: T; cached: boolean; updatedAt: string }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => null);
    if (!payload?.success) {
      const code = payload?.error?.code || (response.status === 429 ? 'RATE_LIMITED' : 'INVALID_RESPONSE');
      const message = payload?.error?.message || 'The integration returned an unreadable response.';
      throw new IntegrationError(code, message, response.status);
    }
    return { data: payload.data as T, cached: Boolean(payload.cached), updatedAt: payload.updatedAt };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new IntegrationError('TIMEOUT', 'The request took too long. Please try again.', 504);
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError('NETWORK_ERROR', 'The service could not be reached. Check your connection and try again.', 0);
  } finally {
    window.clearTimeout(timeout);
  }
}

export function formatCount(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? 'Unavailable' : new Intl.NumberFormat().format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function errorLabel(code: string) {
  if (code === 'MISSING_CONFIGURATION') return 'Setup required';
  if (code === 'RATE_LIMITED') return 'Rate limited';
  if (code === 'UNAUTHORIZED') return 'Authorization failed';
  if (code === 'TIMEOUT') return 'Request timed out';
  return 'Temporarily unavailable';
}
