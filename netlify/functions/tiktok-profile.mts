import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from '../lib/api';

export default async () => {
  const accessToken = Netlify.env.get('TIKTOK_ACCESS_TOKEN');
  if (!accessToken) return apiError('MISSING_CONFIGURATION', 'Some TikTok statistics are unavailable through the current connection. Visit TikTok for the latest profile information.', 503);

  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [userResponse, videoResponse] = await Promise.all([
      fetchWithTimeout('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count', { headers }, 10000),
      fetchWithTimeout('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,duration,cover_image_url,embed_link,create_time,share_url,view_count,like_count,comment_count,share_count', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ max_count: 20 }) }, 10000)
    ]);
    if (!userResponse.ok) return upstreamError('TikTok profile', userResponse.status);
    if (!videoResponse.ok) return upstreamError('TikTok videos', videoResponse.status);
    const userPayload = await userResponse.json();
    const videoPayload = await videoResponse.json();
    const user = userPayload.data?.user;
    if (!user) return apiError('INVALID_RESPONSE', 'TikTok returned an incomplete profile response.', 502);
    const posts = (videoPayload.data?.videos || []).sort((first: any, second: any) => Number(second.view_count || 0) - Number(first.view_count || 0)).slice(0, 3).map((video: any) => ({
      title: video.title || video.video_description || 'TikTok post',
      thumbnail: video.cover_image_url || null,
      views: Number(video.view_count),
      likes: Number(video.like_count),
      comments: Number(video.comment_count),
      url: video.share_url || video.embed_link
    }));
    return apiSuccess({
      displayName: user.display_name,
      username: user.username || Netlify.env.get('TIKTOK_USERNAME') || 'tazeliteplays',
      image: user.avatar_url,
      followers: Number(user.follower_count),
      following: Number(user.following_count),
      likes: Number(user.likes_count),
      isLive: null,
      liveStatusAvailable: false,
      posts
    }, { maxAge: 600, staleWhileRevalidate: 1200 });
  } catch (error) {
    console.error('TikTok request failed:', safeDiagnostic(error));
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'TikTok took too long to respond.', 504);
    return apiError('UPSTREAM_ERROR', 'TikTok information is temporarily unavailable.', 502);
  }
};
