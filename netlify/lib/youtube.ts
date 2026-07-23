import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from './api';

const apiBase = 'https://www.googleapis.com/youtube/v3';
export const fallbackChannelId = 'UCe2cGb8qKK-guxCtA7GZOEg';

export function getYouTubeKey() {
  return Netlify.env.get('YOUTUBE_API_KEY');
}

export function getChannelId() {
  return Netlify.env.get('YOUTUBE_CHANNEL_ID') || fallbackChannelId;
}

export async function getChannel() {
  const apiKey = getYouTubeKey();
  if (!apiKey) throw new Error('MISSING_YOUTUBE_API_KEY');
  const query = new URLSearchParams({ part: 'snippet,statistics,contentDetails', key: apiKey, id: getChannelId() });
  const response = await fetchWithTimeout(`${apiBase}/channels?${query}`, {}, 10000);
  if (!response.ok) throw Object.assign(new Error(`YOUTUBE_HTTP_${response.status}`), { status: response.status });
  const data = await response.json();
  if (!data.items?.[0]) throw new Error('YOUTUBE_CHANNEL_NOT_FOUND');
  return data.items[0];
}

export async function youtubeRequest(path: string, params: Record<string, string>) {
  const apiKey = getYouTubeKey();
  if (!apiKey) throw new Error('MISSING_YOUTUBE_API_KEY');
  const query = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetchWithTimeout(`${apiBase}/${path}?${query}`, {}, 10000);
  if (!response.ok) throw Object.assign(new Error(`YOUTUBE_HTTP_${response.status}`), { status: response.status });
  return response.json();
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function match(entry: string, pattern: RegExp) {
  return decodeXml(entry.match(pattern)?.[1]?.trim() || '');
}

export async function getRecentVideosFromFeed() {
  const response = await fetchWithTimeout(`https://www.youtube.com/feeds/videos.xml?channel_id=${getChannelId()}`, {}, 10000);
  if (!response.ok) throw Object.assign(new Error(`YOUTUBE_FEED_HTTP_${response.status}`), { status: response.status });
  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 3).map((entryMatch) => {
    const entry = entryMatch[1];
    const id = match(entry, /<yt:videoId>(.*?)<\/yt:videoId>/);
    return {
      id,
      title: match(entry, /<title>(.*?)<\/title>/),
      publishedAt: match(entry, /<published>(.*?)<\/published>/),
      thumbnail: match(entry, /<media:thumbnail url="(.*?)"/),
      viewCount: Number(match(entry, /<media:statistics views="(.*?)"/)) || 0,
      duration: null,
      url: `https://www.youtube.com/watch?v=${id}`
    };
  }).filter((item) => item.id);
  return entries;
}

export function formatDuration(value = '') {
  const duration = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!duration) return '';
  const hours = Number(duration[1] || 0);
  const minutes = Number(duration[2] || 0);
  const seconds = Number(duration[3] || 0);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function youtubeError(error: unknown) {
  const message = safeDiagnostic(error);
  console.error('YouTube integration error:', message);
  if (message === 'MISSING_YOUTUBE_API_KEY') return apiError('MISSING_CONFIGURATION', 'YouTube statistics require YOUTUBE_API_KEY. Recent uploads remain available through the official channel feed.', 503);
  if (message === 'YOUTUBE_CHANNEL_NOT_FOUND') return apiError('NOT_FOUND', 'The configured YouTube channel ID could not be found.', 404);
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 0;
  if (status) return upstreamError('YouTube', status);
  if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'YouTube took too long to respond.', 504);
  return apiError('UPSTREAM_ERROR', 'YouTube information is temporarily unavailable.', 502);
}

export { apiSuccess };
