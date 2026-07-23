import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from '../lib/api';

export default async (request: Request) => {
  const code = new URL(request.url).searchParams.get('code') || 'ajv9r5';
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) return apiError('BAD_REQUEST', 'The FiveM server code is invalid.', 400);
  try {
    const response = await fetchWithTimeout(`https://servers-frontend.fivem.net/api/servers/single/${code}`, { headers: { Accept: 'application/json', 'User-Agent': 'TazEliteWebsite/1.0' } }, 10000);
    if (!response.ok) return upstreamError('FiveM server status', response.status);
    const payload = await response.json();
    const data = payload?.Data || payload;
    if (!data) return apiError('INVALID_RESPONSE', 'FiveM returned an incomplete server response.', 502);
    return apiSuccess({ online: true, players: Number(data.clients || 0), maxPlayers: Number(data.sv_maxclients || 0), hostname: data.hostname || 'California Roleplay', gametype: data.gametype || 'FiveM', mapname: data.mapname || 'Los Santos' }, { maxAge: 30, staleWhileRevalidate: 60 });
  } catch (error) {
    console.error('FiveM status request failed:', safeDiagnostic(error));
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'FiveM server status took too long to respond.', 504);
    return apiError('UPSTREAM_ERROR', 'The FiveM server is offline or unreachable.', 502);
  }
};
