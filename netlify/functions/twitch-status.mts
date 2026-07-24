import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from '../lib/api';

export default async (request: Request) => {
  const clientId = Netlify.env.get('TWITCH_CLIENT_ID');
  const clientSecret = Netlify.env.get('TWITCH_CLIENT_SECRET');
  const configuredUserId = Netlify.env.get('TWITCH_USER_ID');
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

    const userQuery = configuredUserId ? `id=${encodeURIComponent(configuredUserId)}` : `login=${encodeURIComponent(login)}`;
    const userResponse = await fetchWithTimeout(`https://api.twitch.tv/helix/users?${userQuery}`, { headers }, 9000);
    if (!userResponse.ok) return upstreamError('Twitch profile', userResponse.status);
    const user = (await userResponse.json()).data?.[0];
    if (!user) return apiError('NOT_FOUND', 'The configured Twitch channel could not be found.', 404);

    const followerToken = Netlify.env.get('TWITCH_USER_ACCESS_TOKEN') || tokenPayload.access_token;
    const [streamResponse, videoResponse, channelResponse, followerResponse, clipResponse, scheduleResponse] = await Promise.all([
      fetchWithTimeout(`https://api.twitch.tv/helix/streams?user_id=${user.id}`, { headers }, 9000),
      fetchWithTimeout(`https://api.twitch.tv/helix/videos?user_id=${user.id}&first=3&sort=time&type=archive`, { headers }, 9000),
      fetchWithTimeout(`https://api.twitch.tv/helix/channels?broadcaster_id=${user.id}`, { headers }, 9000),
      fetchWithTimeout(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}&first=1`, {
        headers: { 'Client-ID': clientId, Authorization: `Bearer ${followerToken}` }
      }, 9000),
      fetchWithTimeout(`https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&first=6`, { headers }, 9000),
      fetchWithTimeout(`https://api.twitch.tv/helix/schedule?broadcaster_id=${user.id}&first=5`, { headers }, 9000)
    ]);
    if (!streamResponse.ok) return upstreamError('Twitch live status', streamResponse.status);
    const stream = (await streamResponse.json()).data?.[0] || null;
    const videos = videoResponse.ok ? (await videoResponse.json()).data || [] : [];
    const channel = channelResponse.ok ? (await channelResponse.json()).data?.[0] || null : null;
    const followers = followerResponse.ok ? (await followerResponse.json()).total ?? null : null;
    const clips = clipResponse.ok ? (await clipResponse.json()).data || [] : [];
    const schedulePayload = scheduleResponse.ok ? await scheduleResponse.json() : null;
    const scheduledStreams = schedulePayload?.data?.segments || [];
    const gameIds = [...new Set(clips.map((clip: any) => clip.game_id).filter(Boolean))];
    const gameResponse = gameIds.length
      ? await fetchWithTimeout(`https://api.twitch.tv/helix/games?${gameIds.map((id) => `id=${encodeURIComponent(String(id))}`).join('&')}`, { headers }, 9000)
      : null;
    const games = gameResponse?.ok ? (await gameResponse.json()).data || [] : [];
    const gameNames = new Map(games.map((game: any) => [game.id, game.name]));

    return apiSuccess({
      channel: {
        id: user.id,
        login: user.login,
        displayName: user.display_name,
        description: user.description,
        profileImageUrl: user.profile_image_url,
        offlineImageUrl: user.offline_image_url,
        broadcasterType: user.broadcaster_type || null,
        createdAt: user.created_at || null,
        language: channel?.broadcaster_language || null,
        tags: channel?.tags || [],
        url: `https://www.twitch.tv/${user.login}`
      },
      live: stream ? {
        isLive: true,
        title: stream.title,
        game: stream.game_name,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        language: stream.language,
        tags: stream.tags || [],
        thumbnailUrl: stream.thumbnail_url?.replace('{width}', '640').replace('{height}', '360') || null
      } : { isLive: false },
      stats: {
        followers,
        recentVideoViews: videos.reduce((total: number, video: any) => total + (video.view_count || 0), 0)
      },
      recentContent: videos.map((video: any) => ({
        id: video.id,
        title: video.title,
        publishedAt: video.published_at,
        duration: video.duration,
        viewCount: video.view_count,
        thumbnailUrl: video.thumbnail_url?.replace('%{width}', '640').replace('%{height}', '360') || null,
        url: video.url
      })),
      clips: clips.map((clip: any) => ({
        id: clip.id,
        title: clip.title,
        creatorName: clip.creator_name,
        game: gameNames.get(clip.game_id) || null,
        viewCount: clip.view_count,
        createdAt: clip.created_at,
        thumbnailUrl: clip.thumbnail_url || null,
        url: clip.url
      })),
      schedule: {
        available: scheduleResponse.ok,
        segments: scheduledStreams
          .filter((segment: any) => !segment.canceled_until && new Date(segment.start_time).getTime() >= Date.now())
          .map((segment: any) => ({
            id: segment.id,
            title: segment.title || null,
            startTime: segment.start_time,
            endTime: segment.end_time,
            category: segment.category?.name || null
          }))
      }
    }, { maxAge: stream ? 60 : 120, staleWhileRevalidate: 300 });
  } catch (error) {
    console.error('Twitch request failed:', safeDiagnostic(error));
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'Twitch took too long to respond.', 504);
    return apiError('UPSTREAM_ERROR', 'Twitch information is temporarily unavailable.', 502);
  }
};
