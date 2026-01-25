import type { Context, Config } from "@netlify/functions";

const DISCORD_CLIENT_ID = Netlify.env.get("DISCORD_CLIENT_ID");
const DISCORD_CLIENT_SECRET = Netlify.env.get("DISCORD_CLIENT_SECRET");
const ALLOWED_USER_ID = "1000470631688712243";

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const redirectUri = `${url.origin}/api/discord-auth`;

    // If no code, redirect to Discord OAuth
    if (!code) {
        if (!DISCORD_CLIENT_ID) {
            return new Response(JSON.stringify({ error: "Discord OAuth not configured" }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
        discordAuthUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
        discordAuthUrl.searchParams.set("redirect_uri", redirectUri);
        discordAuthUrl.searchParams.set("response_type", "code");
        discordAuthUrl.searchParams.set("scope", "identify");

        return Response.redirect(discordAuthUrl.toString(), 302);
    }

    // Exchange code for token
    try {
        if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
            return new Response(JSON.stringify({ error: "Discord OAuth not configured" }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            console.error("Token exchange failed:", await tokenResponse.text());
            return Response.redirect(`${url.origin}/admin/login?error=token_exchange_failed`, 302);
        }

        const tokenData = await tokenResponse.json();

        // Get user info
        const userResponse = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        if (!userResponse.ok) {
            console.error("User fetch failed:", await userResponse.text());
            return Response.redirect(`${url.origin}/admin/login?error=user_fetch_failed`, 302);
        }

        const userData = await userResponse.json();

        // Check if user is allowed
        if (userData.id !== ALLOWED_USER_ID) {
            return Response.redirect(`${url.origin}/admin/login?error=unauthorized`, 302);
        }

        // Create a session token (simple JWT-like token)
        const sessionPayload = {
            userId: userData.id,
            username: userData.username,
            avatar: userData.avatar,
            exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        };

        const sessionToken = Buffer.from(JSON.stringify(sessionPayload)).toString("base64");

        // Set cookie and redirect to admin
        return new Response(null, {
            status: 302,
            headers: {
                "Location": `${url.origin}/admin`,
                "Set-Cookie": `admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`,
            },
        });
    } catch (error) {
        console.error("Auth error:", error);
        return Response.redirect(`${url.origin}/admin/login?error=auth_failed`, 302);
    }
};

export const config: Config = {
    path: "/api/discord-auth",
};
