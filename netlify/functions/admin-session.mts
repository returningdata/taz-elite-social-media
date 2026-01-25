import type { Context, Config } from "@netlify/functions";

const ALLOWED_USER_ID = "1000470631688712243";

interface SessionPayload {
    userId: string;
    username: string;
    avatar: string;
    exp: number;
}

function parseSession(cookie: string | null): SessionPayload | null {
    if (!cookie) return null;

    const cookies = cookie.split(";").reduce((acc, c) => {
        const [key, value] = c.trim().split("=");
        acc[key] = value;
        return acc;
    }, {} as Record<string, string>);

    const sessionToken = cookies["admin_session"];
    if (!sessionToken) return null;

    try {
        const payload = JSON.parse(Buffer.from(sessionToken, "base64").toString("utf-8")) as SessionPayload;

        // Check expiration
        if (payload.exp < Date.now()) return null;

        // Verify user ID
        if (payload.userId !== ALLOWED_USER_ID) return null;

        return payload;
    } catch {
        return null;
    }
}

export default async (req: Request, context: Context) => {
    const cookie = req.headers.get("cookie");
    const session = parseSession(cookie);

    if (!session) {
        return new Response(JSON.stringify({ authenticated: false }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({
        authenticated: true,
        user: {
            id: session.userId,
            username: session.username,
            avatar: session.avatar,
        }
    }), {
        headers: { "Content-Type": "application/json" }
    });
};

export const config: Config = {
    path: "/api/admin/session",
};
