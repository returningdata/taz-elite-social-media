import type { Context } from '@netlify/functions';
import { apiError, apiSuccess } from '../lib/api';

const variables = {
  discordPresence: { required: [], optional: ['DISCORD_USER_ID'], fallback: 'Built-in Discord user ID + Lanyard' },
  discordServer: { required: [], optional: ['DISCORD_INVITE_CODE'], fallback: 'Built-in public invite code' },
  twitch: { required: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'], optional: ['TWITCH_CHANNEL_LOGIN'], fallback: null },
  youtube: { required: ['YOUTUBE_API_KEY'], optional: ['YOUTUBE_CHANNEL_ID'], fallback: 'Official RSS feed for recent videos only' },
  tiktok: { required: ['TIKTOK_ACCESS_TOKEN'], optional: ['TIKTOK_USERNAME'], fallback: null },
  instagram: { required: [], optional: ['INSTAGRAM_PROFILE_URL'], fallback: 'Approved local gallery' }
};

export default async (_request: Request, context: Context) => {
  const isDevelopment = context.deploy?.context === 'dev' || Netlify.env.get('CONTEXT') === 'dev';
  if (!isDevelopment) return apiError('NOT_FOUND', 'Not found.', 404);
  const integrations = Object.fromEntries(Object.entries(variables).map(([name, settings]) => [name, {
    configured: settings.required.every((variable) => Netlify.env.has(variable)),
    missing: settings.required.filter((variable) => !Netlify.env.has(variable)),
    optionalMissing: settings.optional.filter((variable) => !Netlify.env.has(variable)),
    fallback: settings.fallback
  }]));
  return apiSuccess({ integrations, note: 'Values are intentionally never returned.' }, { maxAge: 0, staleWhileRevalidate: 0 });
};
