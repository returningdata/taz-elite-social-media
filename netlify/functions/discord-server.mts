import { apiError, apiSuccess, fetchWithTimeout, safeDiagnostic, upstreamError } from '../lib/api';

const defaultInvite = 'T3AeBNQdXp';
const verificationLevels = ['None', 'Low', 'Medium', 'High', 'Very High'];

export default async (request: Request) => {
  const requestUrl = new URL(request.url);
  const inviteCode = requestUrl.searchParams.get('invite') || Netlify.env.get('DISCORD_INVITE_CODE') || defaultInvite;
  if (!/^[A-Za-z0-9-]{2,32}$/.test(inviteCode)) return apiError('BAD_REQUEST', 'The Discord invite code is invalid.', 400);

  try {
    const response = await fetchWithTimeout(`https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true&with_expiration=true`, {
      headers: { 'User-Agent': 'TazEliteWebsite/1.0' }
    }, 9000);
    if (!response.ok) return upstreamError('Discord server preview', response.status);
    const payload = await response.json();
    const guild = payload.guild;
    if (!guild?.id || !guild?.name) return apiError('INVALID_RESPONSE', 'Discord server information is temporarily unavailable.', 502);

    const iconExtension = guild.icon?.startsWith('a_') ? 'gif' : 'png';
    const bannerExtension = guild.banner?.startsWith('a_') ? 'gif' : 'png';
    return apiSuccess({
      id: guild.id,
      name: guild.name,
      description: guild.description || null,
      iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${iconExtension}?size=256` : null,
      bannerUrl: guild.banner ? `https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.${bannerExtension}?size=1024` : null,
      memberCount: payload.approximate_member_count ?? null,
      onlineCount: payload.approximate_presence_count ?? null,
      boostCount: guild.premium_subscription_count ?? null,
      boostLevel: guild.premium_tier ?? null,
      verificationLevel: verificationLevels[guild.verification_level] || null,
      inviteCode,
      inviteUrl: `https://discord.gg/${inviteCode}`
    }, { maxAge: 300, staleWhileRevalidate: 900 });
  } catch (error) {
    console.error('Discord server request failed:', safeDiagnostic(error));
    if (error instanceof DOMException && error.name === 'AbortError') return apiError('TIMEOUT', 'Discord server information took too long to respond.', 504);
    return apiError('UPSTREAM_ERROR', 'Discord server information is temporarily unavailable.', 502);
  }
};
