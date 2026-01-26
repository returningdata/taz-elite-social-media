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

// Default site configuration
const defaultConfig = {
    site: {
        title: "TazElite Plays",
        subtitle: "Gaming Content Creator & Community Builder",
        tagline: "Welcome to The Upside Down",
        aboutTitle: "About Me",
        aboutText: "Welcome to my corner of the internet! I'm TazElite, a passionate gamer and content creator who loves bringing people together through gaming. Whether I'm streaming the latest titles or building an awesome community on Discord, my goal is to create a fun and welcoming space for everyone.",
        aboutText2: "Come hang out, watch some streams, and join our growing community. Let's game together!",
    },
    theme: {
        name: "stranger-things",
        primaryColor: "#e50914",
        accentColor: "#b81c24",
        backgroundStart: "#0a0a0a",
        backgroundEnd: "#1a0505",
    },
    social: {
        twitch: "tazeliteplays",
        discord: "https://discord.gg/b36UJMhmT8",
        youtube: "https://www.youtube.com/@tazelite-plays",
    },
    features: {
        fallingMonsters: true,
        musicPlayer: true,
        discordPresence: true,
        twitchStatus: true,
        showAnnouncement: false,
        showSchedule: false,
        enableAnalytics: true,
        showWhatIDo: true,
        showAbout: true,
        maintenanceMode: false,
    },
    announcement: {
        enabled: false,
        text: "",
        link: "",
        linkText: "Learn more",
        style: "info",
        dismissable: true,
    },
    pinnedMessages: [],
    schedule: {
        timezone: "America/New_York",
        days: {
            monday: { enabled: false, start: "19:00", end: "22:00", title: "" },
            tuesday: { enabled: false, start: "19:00", end: "22:00", title: "" },
            wednesday: { enabled: false, start: "19:00", end: "22:00", title: "" },
            thursday: { enabled: false, start: "19:00", end: "22:00", title: "" },
            friday: { enabled: false, start: "20:00", end: "24:00", title: "" },
            saturday: { enabled: false, start: "14:00", end: "20:00", title: "" },
            sunday: { enabled: false, start: "14:00", end: "18:00", title: "" },
        },
        specialStreams: [],
    },
    seo: {
        title: "",
        description: "",
        keywords: "",
        ogTitle: "",
        ogDescription: "",
        ogImage: "",
        twitterHandle: "",
        canonical: "",
        googleVerification: "",
        noindex: false,
    },
    navigation: {
        links: [],
    },
    footer: {
        text: "",
        tagline: "From The Upside Down",
        showSocial: true,
        showYear: true,
        links: [],
    },
    custom: {
        css: "",
        headCode: "",
        footerCode: "",
        redirects: [],
    },
};

export default async (req: Request, context: Context) => {
    const store = getStore({ name: "site-config", consistency: "strong" });

    // GET - Read config (public)
    if (req.method === "GET") {
        try {
            const config = await store.get("config", { type: "json" });
            return new Response(JSON.stringify(config || defaultConfig), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify(defaultConfig), {
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // POST/PUT - Update config (requires auth)
    if (req.method === "POST" || req.method === "PUT") {
        const session = parseSession(req.headers.get("cookie"));
        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        try {
            const newConfig = await req.json();
            await store.setJSON("config", newConfig);

            return new Response(JSON.stringify({ success: true, config: newConfig }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to save config" }), {
                status: 500,
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
    path: "/api/admin/config",
};
