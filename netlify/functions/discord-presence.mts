import type { Context, Config } from "@netlify/functions";

interface LanyardActivity {
    name: string;
    type: number;
    state?: string;
    details?: string;
    application_id?: string;
    timestamps?: {
        start?: number;
        end?: number;
    };
    assets?: {
        large_image?: string;
        large_text?: string;
        small_image?: string;
        small_text?: string;
    };
    emoji?: {
        name: string;
        id?: string;
        animated?: boolean;
    };
}

interface LanyardSpotify {
    track_id: string;
    timestamps: {
        start: number;
        end: number;
    };
    album: string;
    album_art_url: string;
    artist: string;
    song: string;
}

interface LanyardDiscordUser {
    id: string;
    username: string;
    avatar: string;
    discriminator: string;
    display_name?: string;
    global_name?: string;
    avatar_decoration_data?: {
        asset: string;
        sku_id: string;
    } | null;
}

interface LanyardData {
    spotify: LanyardSpotify | null;
    listening_to_spotify: boolean;
    discord_user: LanyardDiscordUser;
    discord_status: 'online' | 'idle' | 'dnd' | 'offline';
    activities: LanyardActivity[];
    active_on_discord_web: boolean;
    active_on_discord_desktop: boolean;
    active_on_discord_mobile: boolean;
}

interface LanyardResponse {
    success: boolean;
    data: LanyardData;
}

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);

        if (!response.ok) {
            return new Response(JSON.stringify({
                success: false,
                error: 'User not found or not in Lanyard Discord server',
                message: 'The user must join discord.gg/lanyard to enable presence tracking'
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=30'
                }
            });
        }

        const data: LanyardResponse = await response.json();

        if (!data.success) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to fetch presence data'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { discord_user, discord_status, activities, spotify, listening_to_spotify, active_on_discord_desktop, active_on_discord_mobile, active_on_discord_web } = data.data;

        // Get the main activity (game, etc.) - exclude custom status and Spotify
        const mainActivity = activities.find(a => a.type !== 4 && a.name !== 'Spotify');

        // Get custom status if present
        const customStatus = activities.find(a => a.type === 4);

        // Build avatar URL
        const avatarUrl = discord_user.avatar
            ? `https://cdn.discordapp.com/avatars/${discord_user.id}/${discord_user.avatar}.${discord_user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(discord_user.discriminator) % 5}.png`;

        // Get activity image if available
        let activityImage = null;
        if (mainActivity?.assets?.large_image) {
            if (mainActivity.assets.large_image.startsWith('mp:')) {
                // External asset
                activityImage = `https://media.discordapp.net/${mainActivity.assets.large_image.replace('mp:', '')}`;
            } else if (mainActivity.application_id) {
                // Discord application asset
                activityImage = `https://cdn.discordapp.com/app-assets/${mainActivity.application_id}/${mainActivity.assets.large_image}.png`;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            user: {
                id: discord_user.id,
                username: discord_user.username,
                displayName: discord_user.display_name || discord_user.global_name || discord_user.username,
                avatar: avatarUrl,
                discriminator: discord_user.discriminator
            },
            status: discord_status,
            platforms: {
                desktop: active_on_discord_desktop,
                mobile: active_on_discord_mobile,
                web: active_on_discord_web
            },
            customStatus: customStatus ? {
                text: customStatus.state || null,
                emoji: customStatus.emoji || null
            } : null,
            activity: mainActivity ? {
                name: mainActivity.name,
                type: mainActivity.type,
                details: mainActivity.details || null,
                state: mainActivity.state || null,
                image: activityImage,
                largeText: mainActivity.assets?.large_text || null,
                timestamps: mainActivity.timestamps || null
            } : null,
            spotify: listening_to_spotify && spotify ? {
                song: spotify.song,
                artist: spotify.artist,
                album: spotify.album,
                albumArt: spotify.album_art_url,
                trackId: spotify.track_id,
                timestamps: spotify.timestamps
            } : null
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=10'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch Discord presence'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export const config: Config = {
    path: "/api/discord-presence"
};
