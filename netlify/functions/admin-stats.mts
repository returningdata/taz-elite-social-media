import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

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
        if (payload.exp < Date.now()) return null;
        if (payload.userId !== ALLOWED_USER_ID) return null;
        return payload;
    } catch {
        return null;
    }
}

export default async (req: Request, context: Context) => {
    // Require authentication
    const session = parseSession(req.headers.get("cookie"));
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    const statsStore = getStore({ name: "site-stats", consistency: "strong" });

    // GET - Read stats
    if (req.method === "GET") {
        try {
            const pageViews = await statsStore.get("pageViews", { type: "json" }) || { total: 0, today: 0, lastReset: new Date().toDateString() };
            const uniqueVisitors = await statsStore.get("uniqueVisitors", { type: "json" }) || { total: 0, today: 0, lastReset: new Date().toDateString() };

            // Reset daily stats if needed
            const today = new Date().toDateString();
            if (pageViews.lastReset !== today) {
                pageViews.today = 0;
                pageViews.lastReset = today;
                await statsStore.setJSON("pageViews", pageViews);
            }
            if (uniqueVisitors.lastReset !== today) {
                uniqueVisitors.today = 0;
                uniqueVisitors.lastReset = today;
                await statsStore.setJSON("uniqueVisitors", uniqueVisitors);
            }

            return new Response(JSON.stringify({
                pageViews,
                uniqueVisitors,
                lastUpdated: new Date().toISOString(),
            }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                pageViews: { total: 0, today: 0 },
                uniqueVisitors: { total: 0, today: 0 },
                lastUpdated: new Date().toISOString(),
            }), {
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
    });
};

export const config: Config = {
    path: "/api/admin/stats",
};
