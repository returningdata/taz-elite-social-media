import { getStore } from '@netlify/blobs';
import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic } from '../lib/api';

const cacheLifetimeMs = 24 * 60 * 60 * 1000;
const cacheStore = getStore('social-integration-cache');

interface TikTokPost {
  title: string;
  thumbnail: string | null;
  views: number;
  likes: number;
  comments: number;
  url: string;
}

interface TikTokProfileData {
  displayName: string;
  username: string;
  image: string | null;
  followers: number;
  following: number | null;
  likes: number | null;
  isLive: null;
  liveStatusAvailable: false;
  posts: TikTokPost[];
  cache: {
    source: 'tiktok-api' | 'manual';
    fetchedAt: string;
    stale: boolean;
  };
}

interface TikTokCacheEntry {
  data: TikTokProfileData;
  fetchedAt: string;
}

function manualFollowerCount() {
  const rawValue = Netlify.env.get('TIKTOK_FOLLOWER_COUNT');
  if (!rawValue) return null;
  const count = Number(rawValue.replace(/,/g, ''));
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function manualProfile(username: string, followers: number): TikTokProfileData {
  const fetchedAt = new Date().toISOString();
  return {
    displayName: 'Taz Elite Plays',
    username,
    image: null,
    followers,
    following: null,
    likes: null,
    isLive: null,
    liveStatusAvailable: false,
    posts: [],
    cache: { source: 'manual', fetchedAt, stale: false }
  };
}

async function readCache(key: string) {
  try {
    return await cacheStore.get(key, { type: 'json' }) as TikTokCacheEntry | null;
  } catch (error) {
    console.error('TikTok cache read failed:', safeDiagnostic(error));
    return null;
  }
}

async function writeCache(key: string, data: TikTokProfileData) {
  try {
    await cacheStore.setJSON(key, { data, fetchedAt: data.cache.fetchedAt });
  } catch (error) {
    console.error('TikTok cache write failed:', safeDiagnostic(error));
  }
}

function cachedResponse(entry: TikTokCacheEntry, stale = false) {
  return apiSuccess({
    ...entry.data,
    cache: { ...entry.data.cache, fetchedAt: entry.fetchedAt, stale }
  }, { cached: true, maxAge: stale ? 3600 : 86400, staleWhileRevalidate: stale ? 86400 : 3600 });
}

export default async () => {
  const username = Netlify.env.get('TIKTOK_USERNAME') || 'tazeliteplays';
  const cacheKey = `profile-${username.toLowerCase()}`;
  const accessToken = Netlify.env.get('TIKTOK_ACCESS_TOKEN');
  const configuredFollowerCount = manualFollowerCount();
  let cached = await readCache(cacheKey);

  if (configuredFollowerCount !== null && (!cached || cached.data.cache.source === 'manual' && cached.data.followers !== configuredFollowerCount)) {
    const data = manualProfile(username, configuredFollowerCount);
    await writeCache(cacheKey, data);
    cached = { data, fetchedAt: data.cache.fetchedAt };
  }

  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < cacheLifetimeMs) return cachedResponse(cached);

  if (!accessToken) {
    if (cached) return cachedResponse(cached, true);
    return apiError('MISSING_CONFIGURATION', 'TikTok OAuth is not configured. Add TIKTOK_FOLLOWER_COUNT to show a manually maintained last-known follower count.', 503);
  }

  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [userResponse, videoResponse] = await Promise.all([
      fetchWithTimeout('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count', { headers }, 10000),
      fetchWithTimeout('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,embed_link,create_time,share_url,view_count,like_count,comment_count,share_count', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ max_count: 20 }) }, 10000)
    ]);
    if (!userResponse.ok || !videoResponse.ok) throw new Error(`TikTok authorization or upstream request failed with status ${!userResponse.ok ? userResponse.status : videoResponse.status}`);

    const userPayload = await userResponse.json();
    const videoPayload = await videoResponse.json();
    const user = userPayload.data?.user;
    if (!user) throw new Error('TikTok returned an incomplete profile response');

    const fetchedAt = new Date().toISOString();
    const posts = (videoPayload.data?.videos || [])
      .sort((first: any, second: any) => Number(second.view_count || 0) - Number(first.view_count || 0))
      .slice(0, 3)
      .map((video: any) => ({
        title: video.title || video.video_description || 'TikTok post',
        thumbnail: video.cover_image_url || null,
        views: Number(video.view_count),
        likes: Number(video.like_count),
        comments: Number(video.comment_count),
        url: video.share_url || video.embed_link
      }));
    const data: TikTokProfileData = {
      displayName: user.display_name || 'Taz Elite Plays',
      username: user.username || username,
      image: user.avatar_url || null,
      followers: Number(user.follower_count),
      following: Number(user.following_count),
      likes: Number(user.likes_count),
      isLive: null,
      liveStatusAvailable: false,
      posts,
      cache: { source: 'tiktok-api', fetchedAt, stale: false }
    };
    await writeCache(cacheKey, data);
    return apiSuccess(data, { maxAge: 86400, staleWhileRevalidate: 3600 });
  } catch (error) {
    console.error('TikTok refresh failed:', safeDiagnostic(error));
    if (cached) return cachedResponse(cached, true);
    if (configuredFollowerCount !== null) {
      const data = manualProfile(username, configuredFollowerCount);
      await writeCache(cacheKey, data);
      return apiSuccess(data, { maxAge: 86400, staleWhileRevalidate: 3600 });
    }
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'TikTok took too long to respond and no saved follower count is available.', 504);
    return apiError('UPSTREAM_ERROR', 'TikTok could not refresh and no saved follower count is available. Add TIKTOK_FOLLOWER_COUNT to show a manual last-known value.', 502);
  }
};
