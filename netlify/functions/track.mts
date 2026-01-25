import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const statsStore = getStore({ name: "site-stats", consistency: "strong" });
        const body = await req.json().catch(() => ({}));
        const visitorId = body.visitorId || "unknown";

        // Update page views
        const pageViews = await statsStore.get("pageViews", { type: "json" }) || { total: 0, today: 0, lastReset: new Date().toDateString() };

        // Reset daily stats if needed
        const today = new Date().toDateString();
        if (pageViews.lastReset !== today) {
            pageViews.today = 0;
            pageViews.lastReset = today;
        }

        pageViews.total += 1;
        pageViews.today += 1;
        await statsStore.setJSON("pageViews", pageViews);

        // Track unique visitors
        const uniqueVisitors = await statsStore.get("uniqueVisitors", { type: "json" }) || { total: 0, today: 0, lastReset: new Date().toDateString(), visitors: {} };

        if (uniqueVisitors.lastReset !== today) {
            uniqueVisitors.today = 0;
            uniqueVisitors.lastReset = today;
            uniqueVisitors.visitors = {};
        }

        if (!uniqueVisitors.visitors[visitorId]) {
            uniqueVisitors.visitors[visitorId] = true;
            uniqueVisitors.total += 1;
            uniqueVisitors.today += 1;
        }

        // Limit stored visitors to prevent blob from growing too large
        const visitorKeys = Object.keys(uniqueVisitors.visitors);
        if (visitorKeys.length > 10000) {
            uniqueVisitors.visitors = {};
        }

        await statsStore.setJSON("uniqueVisitors", uniqueVisitors);

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Track error:", error);
        return new Response(JSON.stringify({ success: false }), {
            headers: { "Content-Type": "application/json" }
        });
    }
};

export const config: Config = {
    path: "/api/track",
};
