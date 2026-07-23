import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from '../lib/api';

export default async (request: Request) => {
  const clientId = Netlify.env.get('TWITCH_CLIENT_ID');
  const clientSecret = Netlify.env.get('TWITCH_CLIENT_SECRET');
  const requestedLogin = new URL(request.url).searchParams.get('username');
  const login = Netlify.env.get('TWITCH_CHANNEL_LOGIN') || requestedLogin || 'tazeliteplays';
  if (!clientId || !clientSecret) return apiError('MISSING_CONFIGURATION', 'Twitch live data is not configured. The channel link remains available.', 503);

  try {
    const tokenResponse = await fetchWithTimeout('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' })
    }, 9000);
    if (!tokenResponse.ok) return upstreamError('Twitch token service', tokenResponse.status);
    const tokenPayload = await tokenResponse.json();
    if (!tokenPayload.access_token) return apiError('INVALID_RESPONSE', 'Twitch did not return a usable access token.', 502);
    const headers = { 'Client-ID': clientId, Authorization: `Bearer ${tokenPayload.access_token}` };

    const userResponse = await fetchWithTimeout(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers }, 9000);
    if (!userResponse.ok) return upstreamError('Twitch profile', userResponse.status);
    const user = (await userResponse.json()).data?.[0];
    if (!user) return apiError('NOT_FOUND', 'The configured Twitch channel could not be found.', 404);

    const [streamResponse, videoResponse] = await Promise.all([
      fetchWithTimeout(`https://api.twitch.tv/helix/streams?user_id=${user.id}`, { headers }, 9000),
      fetchWithTimeout(`https://api.twitch.tv/helix/videos?user_id=${user.id}&first=3&sort=time`, { headers }, 9000)
    ]);
    if (!streamResponse.ok) return upstreamError('Twitch live status', streamResponse.status);
    const stream = (await streamResponse.json()).data?.[0] || null;
    const videos = videoResponse.ok ? (await videoResponse.json()).data || [] : [];

    return apiSuccess({
      channel: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        description: user.description,
        profileImageUrl: user.profile_image_url,
        offlineImageUrl: user.offline_image_url,
        viewCount: user.view_count ?? null,
        url: `https://www.twitch.tv/${user.login}`
      },
      live: stream ? {
        isLive: true,
        title: stream.title,
        game: stream.game_name,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        thumbnailUrl: stream.thumbnail_url?.replace('{width}', '640').replace('{height}', '360') || null
      } : { isLive: false },
      recentContent: videos.map((video: any) => ({
        id: video.id,
        title: video.title,
        publishedAt: video.published_at,
        duration: video.duration,
        viewCount: video.view_count,
        thumbnailUrl: video.thumbnail_url?.replace('%{width}', '640').replace('%{height}', '360') || null,
        url: video.url
      }))
    }, { maxAge: stream ? 60 : 120, staleWhileRevalidate: 300 });
  } catch (error) {
    console.error('Twitch request failed:', safeDiagnostic(error));
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'Twitch took too long to respond.', 504);
    return apiError('UPSTREAM_ERROR', 'Twitch information is temporarily unavailable.', 502);
  }
};
