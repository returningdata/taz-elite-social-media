import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from '../lib/api';

const fallbackUserId = '1000470631688712243';

export default async (request: Request) => {
  const requestUrl = new URL(request.url);
  const userId = Netlify.env.get('DISCORD_USER_ID') || requestUrl.searchParams.get('userId') || fallbackUserId;
  if (!/^\d{17,20}$/.test(userId)) return apiError('BAD_REQUEST', 'A valid Discord user ID is required.', 400);

  try {
    const response = await fetchWithTimeout(`https://api.lanyard.rest/v1/users/${userId}`, {}, 9000);
    if (!response.ok) return upstreamError('Discord presence provider', response.status);
    const payload = await response.json();
    if (!payload?.success || !payload?.data?.discord_user) return apiError('INVALID_RESPONSE', 'Discord presence is currently unavailable.', 502);

    const presence = payload.data;
    const user = presence.discord_user;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(user.discriminator || '0', 10) % 5}.png`;
    const customStatus = presence.activities.find((activity: any) => activity.type === 4);
    const activities = presence.activities.filter((activity: any) => activity.type !== 4 && activity.name !== 'Spotify').map((activity: any) => ({
      name: activity.name,
      type: activity.type,
      details: activity.details || null,
      state: activity.state || null,
      timestamps: activity.timestamps || null,
      imageUrl: activity.assets?.large_image && activity.application_id
        ? `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.large_image}.png`
        : null
    }));

    return apiSuccess({
      status: presence.discord_status,
      displayName: user.display_name || user.global_name || user.username,
      username: user.username,
      avatarUrl,
      customStatus: customStatus?.state || null,
      activities,
      spotify: presence.listening_to_spotify && presence.spotify ? {
        song: presence.spotify.song,
        artist: presence.spotify.artist,
        album: presence.spotify.album,
        albumArtUrl: presence.spotify.album_art_url,
        trackId: presence.spotify.track_id
      } : null,
      platforms: {
        desktop: Boolean(presence.active_on_discord_desktop),
        mobile: Boolean(presence.active_on_discord_mobile),
        web: Boolean(presence.active_on_discord_web)
      },
      provider: 'Lanyard'
    }, { maxAge: 15, staleWhileRevalidate: 30 });
  } catch (error) {
    console.error('Discord presence request failed:', safeDiagnostic(error));
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'Discord presence took too long to respond.', 504);
    return apiError('UPSTREAM_ERROR', 'Discord presence is currently unavailable.', 502);
  }
};
