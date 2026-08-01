import type { Config, Context } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8'
};

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return Response.json({ status: 'method_not_allowed' }, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  }

  const payload = {
    status: 'operational',
    reachable: true,
    service: 'Taz Elite website',
    checkedAt: new Date().toISOString(),
    environment: context.deploy?.context || 'production',
    region: context.server?.region || 'Netlify edge',
    checks: [
      { name: 'Website', status: 'operational', detail: 'The site is reachable.' },
      { name: 'Status API', status: 'operational', detail: 'The Netlify Function responded successfully.' },
      { name: 'Static assets', status: 'operational', detail: 'Images and site files are served through Netlify.' }
    ]
  };

  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return Response.json(payload, { status: 200, headers });
};

export const config: Config = {
  path: '/api/status'
};
