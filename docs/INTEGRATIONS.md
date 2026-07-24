# Social integration setup

The website never sends social-media secrets to the browser. Add runtime values in Netlify under **Project configuration → Environment variables**, then redeploy the site. Use the exact variable names listed below.

## Discord

`DISCORD_INVITE_CODE` is the code after `discord.gg/` for the featured community. The repository defaults to `T3AeBNQdXp`, which currently resolves to The Elite Outpost through Discord’s public invite preview endpoint.

`DISCORD_USER_ID` is the numeric Discord user ID used for personal presence. Enable Discord Developer Mode, right-click the user, and select **Copy User ID**. The repository defaults to `1000470631688712243`.

Personal presence uses the public Lanyard service and does not require a bot token. The Discord account must join the Lanyard server at `discord.gg/lanyard` for presence data to remain available. If Lanyard cannot provide a status, the website reports presence as unavailable rather than forcing an offline result.

## Twitch

Create an application in the Twitch Developer Console. Add its **Client ID** as `TWITCH_CLIENT_ID` and its client secret as `TWITCH_CLIENT_SECRET`. Set `TWITCH_CHANNEL_LOGIN` to `tazeliteplays`.

`TWITCH_USER_ID` is optional. When supplied, it lets the function request the exact broadcaster account by numeric Twitch user ID; otherwise the function resolves the account from `TWITCH_CHANNEL_LOGIN`.

The Netlify function requests a Twitch app access token server-side for each uncached request, then calls the official Helix Users, Channels, Streams, Videos, Clips, Schedule, Games, and Channel Followers endpoints. This powers the live/offline state, current title and game, viewer count, uptime, channel profile, recent broadcasts, clips, upcoming schedule, and recent VOD views.

Twitch may require broadcaster authorization before returning the follower total. To enable that stat, generate a Twitch **user access token** for the channel owner with the `moderator:read:followers` scope and save it as `TWITCH_USER_ACCESS_TOKEN`. The authorized Twitch user must be the broadcaster for `TWITCH_CHANNEL_LOGIN` or one of its moderators. If this optional token is absent or rejected, the page labels followers as unavailable while every app-token stat continues to work.

After adding or changing any Twitch environment variable, redeploy the site. Never add Twitch credentials to source code or browser-side environment variables. Missing or rejected credentials produce a visible setup or authorization message and never expose a token or client secret.

### Twitch setup checklist

1. Register a Twitch application and copy the application Client ID and Client Secret into the matching Netlify variables.
2. Set `TWITCH_CHANNEL_LOGIN` to the channel login exactly as it appears in the Twitch URL, without the `@` symbol.
3. For follower totals, authorize the broadcaster account with `moderator:read:followers`, store the returned user access token as `TWITCH_USER_ACCESS_TOKEN`, and renew that token when Twitch expires or revokes it.
4. Trigger a new deploy so the Netlify Function receives the updated values.
5. Open `/twitch`. Live status, viewers, title, game, uptime, channel images, recent VODs, and VOD views use the app credentials. The follower card confirms separately whether broadcaster authorization is active.

The live player uses Twitch’s official browser embed only when the channel is live. Its `parent` value is generated from `window.location.hostname`, so local development, Netlify previews, the production Netlify hostname, and a connected custom domain use their actual current hostname rather than a hardcoded production or localhost value.

## YouTube

Create or select a Google Cloud project, enable **YouTube Data API v3**, create an API key, and store it as `YOUTUBE_API_KEY`. Restrict the key to the YouTube Data API where practical.

Set `YOUTUBE_CHANNEL_ID` to `UCe2cGb8qKK-guxCtA7GZOEg`. This is the channel ID currently associated with `@tazelite-plays`.

The API key enables subscriber count, total channel views, total video count, video durations, and live-stream status. When the key is absent, the three newest uploads still load from YouTube’s official RSS feed, while unavailable statistics are labeled clearly.

## TikTok

Set `TIKTOK_USERNAME` to `tazeliteplays`. The TikTok function stores the last successful profile response in Netlify Blobs and refreshes it at most once every 24 hours. If a refresh fails or the token later expires, the site continues showing the saved follower count instead of immediately losing the statistic.

For the official automated refresh, create a TikTok developer application with the required Display API scopes, complete the account authorization flow, and store the resulting access token as `TIKTOK_ACCESS_TOKEN`.

If TikTok OAuth cannot be completed, set `TIKTOK_FOLLOWER_COUNT` to the current whole-number follower count. The site persists and displays that manually maintained value for `@tazeliteplays`; update the environment variable and redeploy whenever the public count should change. Manual mode does not invent likes, posts, or live status.

TikTok access tokens can expire or be revoked. The function reports authorization failures distinctly. TikTok does not provide every requested metric, including reliable public live status, through every connection; unsupported data remains labeled unavailable.

## Instagram

`INSTAGRAM_PROFILE_URL` controls the public Follow button. The website currently uses a manually approved local gallery, so no Instagram token is required. Approved images and alt text are maintained in `src/data/content.ts`.

## Site settings

Set `SITE_URL` to the canonical production domain and `CONTACT_EMAIL` to the public contact address. Do not include trailing secrets or paste access tokens into source files.

## Local diagnostics

When the site runs through `netlify dev`, a read-only diagnostics panel lists configured integrations and missing variable names. It never returns values and the diagnostics endpoint returns 404 outside local development.
