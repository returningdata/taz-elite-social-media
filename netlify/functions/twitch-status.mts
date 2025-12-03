import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);
    const username = url.searchParams.get('username');

    if (!username) {
        return new Response(JSON.stringify({ error: 'Username is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const clientId = Netlify.env.get('TWITCH_CLIENT_ID');
        const clientSecret = Netlify.env.get('TWITCH_CLIENT_SECRET');

        if (!clientId || !clientSecret) {
            return new Response(JSON.stringify({
                isLive: false,
                message: 'Twitch API credentials not configured'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            })
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const streamResponse = await fetch(
            `https://api.twitch.tv/helix/streams?user_login=${username}`,
            {
                headers: {
                    'Client-ID': clientId,
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        const streamData = await streamResponse.json();
        const isLive = streamData.data && streamData.data.length > 0;

        return new Response(JSON.stringify({
            isLive,
            title: isLive ? streamData.data[0].title : null,
            game: isLive ? streamData.data[0].game_name : null,
            viewerCount: isLive ? streamData.data[0].viewer_count : null
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            isLive: false,
            error: 'Failed to check stream status'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export const config: Config = {
    path: "/api/twitch-status"
};
