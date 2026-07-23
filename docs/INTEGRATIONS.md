# Social integration setup

The website never sends social-media secrets to the browser. Add runtime values in Netlify under **Project configuration → Environment variables**, then redeploy the site. Use the exact variable names listed below.

## Discord

`DISCORD_INVITE_CODE` is the code after `discord.gg/` for the featured community. The repository defaults to `T3AeBNQdXp`, which currently resolves to The Elite Outpost through Discord’s public invite preview endpoint.

`DISCORD_USER_ID` is the numeric Discord user ID used for personal presence. Enable Discord Developer Mode, right-click the user, and select **Copy User ID**. The repository defaults to `1000470631688712243`.

Personal presence uses the public Lanyard service and does not require a bot token. The Discord account must join the Lanyard server at `discord.gg/lanyard` for presence data to remain available. If Lanyard cannot provide a status, the website reports presence as unavailable rather than forcing an offline result.

## Twitch

Create an application in the Twitch Developer Console. Add its **Client ID** as `TWITCH_CLIENT_ID` and its client secret as `TWITCH_CLIENT_SECRET`. Set `TWITCH_CHANNEL_LOGIN` to `tazeliteplays`.

The Netlify function requests a Twitch app access token server-side for each uncached request, then calls the official Helix Users, Streams, and Videos endpoints. Missing or rejected credentials produce a visible setup or authorization message and never expose the client secret.

## YouTube

Create or select a Google Cloud project, enable **YouTube Data API v3**, create an API key, and store it as `YOUTUBE_API_KEY`. Restrict the key to the YouTube Data API where practical.

Set `YOUTUBE_CHANNEL_ID` to `UCe2cGb8qKK-guxCtA7GZOEg`. This is the channel ID currently associated with `@tazelite-plays`.

The API key enables subscriber count, total channel views, total video count, video durations, and live-stream status. When the key is absent, the three newest uploads still load from YouTube’s official RSS feed, while unavailable statistics are labeled clearly.

## TikTok

Create a TikTok developer application with the required Display API scopes, complete the account authorization flow, and store the resulting access token as `TIKTOK_ACCESS_TOKEN`. Set `TIKTOK_USERNAME` to `tazeliteplays`.

TikTok access tokens can expire or be revoked. The function reports authorization failures distinctly. TikTok does not provide every requested metric, including reliable public live status, through every connection; unsupported data remains labeled unavailable.

## Instagram

`INSTAGRAM_PROFILE_URL` controls the public Follow button. The website currently uses a manually approved local gallery, so no Instagram token is required. Approved images and alt text are maintained in `src/data/content.ts`.

## Site settings

Set `SITE_URL` to the canonical production domain and `CONTACT_EMAIL` to the public contact address. Do not include trailing secrets or paste access tokens into source files.

## Local diagnostics

When the site runs through `netlify dev`, a read-only diagnostics panel lists configured integrations and missing variable names. It never returns values and the diagnostics endpoint returns 404 outside local development.
