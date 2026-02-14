import type { Context, Config } from "@netlify/functions";

const COD_API_BASE = "https://my.callofduty.com/api/papi-client";

const PLATFORM_MAP: Record<string, string> = {
    battlenet: "battle",
    psn: "psn",
    xbl: "xbl",
    steam: "steam",
    uno: "uno",
};

interface CodStatsResponse {
    username: string;
    platform: string;
    level?: number;
    prestige?: number;
    kd?: number;
    wins?: number;
    kills?: number;
    deaths?: number;
    wl?: number;
    matches?: number;
    timePlayed?: number;
    accuracy?: number;
    headshots?: number;
    bestStreak?: number;
    losses?: number;
    recentMatches?: RecentMatch[];
    error?: string;
}

interface RecentMatch {
    map: string;
    mode: string;
    result: string;
    kills: number;
    deaths: number;
    kd: number;
    timestamp: number;
}

function formatTimePlayed(seconds: number): string {
    if (!seconds || seconds <= 0) return "0h";
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function extractStats(data: any): Partial<CodStatsResponse> {
    try {
        // The Activision API nests stats differently depending on the endpoint
        // Try multiple paths to find the lifetime stats
        const lifetime =
            data?.data?.lifetime?.all?.properties ||
            data?.data?.lifetime?.mode?.gun?.properties ||
            data?.data?.lifetime?.mode?.dom?.properties ||
            data?.data?.lifetime?.mode?.war?.properties ||
            {};

        const mp = data?.data?.mp || {};
        const level = mp?.level || data?.data?.level || null;
        const prestige = mp?.prestige || data?.data?.prestige || null;

        // Aggregate stats from all modes if available
        const allModes = data?.data?.lifetime?.all?.properties || {};
        const modeData = data?.data?.lifetime?.mode || {};

        // Try to get aggregate stats
        let kills = allModes.kills;
        let deaths = allModes.deaths;
        let wins = allModes.wins;
        let losses = allModes.losses;
        let timePlayed = allModes.timePlayedTotal;
        let headshots = allModes.headshots;
        let bestStreak = allModes.recordKillStreak || allModes.bestKills;
        let matches = allModes.totalGamesPlayed;
        let accuracy = allModes.accuracy;

        // If aggregate isn't available, sum across modes
        if (kills === undefined && modeData) {
            kills = 0; deaths = 0; wins = 0; losses = 0; timePlayed = 0;
            headshots = 0; matches = 0;
            for (const mode of Object.values(modeData) as any[]) {
                const props = mode?.properties || {};
                kills += props.kills || 0;
                deaths += props.deaths || 0;
                wins += props.wins || 0;
                losses += props.losses || 0;
                timePlayed += props.timePlayedTotal || props.timePlayed || 0;
                headshots += props.headshots || 0;
                matches += props.totalGamesPlayed || 0;
                if ((props.recordKillStreak || 0) > (bestStreak || 0)) {
                    bestStreak = props.recordKillStreak;
                }
            }
        }

        const kd = deaths && deaths > 0 ? kills / deaths : kills || 0;
        const wl = losses && losses > 0 ? wins / losses : wins || 0;

        return {
            level: level ?? undefined,
            prestige: prestige ?? undefined,
            kd: Math.round(kd * 100) / 100,
            wins: wins || 0,
            kills: kills || 0,
            deaths: deaths || 0,
            wl: Math.round(wl * 100) / 100,
            matches: matches || 0,
            timePlayed: timePlayed || 0,
            accuracy: accuracy ? Math.round(accuracy * 10000) / 100 : undefined,
            headshots: headshots || 0,
            bestStreak: bestStreak || 0,
            losses: losses || 0,
        };
    } catch {
        return {};
    }
}

function extractRecentMatches(data: any): RecentMatch[] {
    try {
        const matches = data?.data?.matches || data?.data?.recentMatches || [];
        if (!Array.isArray(matches)) return [];

        return matches.slice(0, 10).map((m: any) => ({
            map: m.map || m.mapId || "Unknown",
            mode: m.mode || m.modeId || "Unknown",
            result: m.result === "win" || m.isPresentAtEnd === true
                ? "win"
                : m.result === "loss" ? "loss" : m.result || "unknown",
            kills: m.playerStats?.kills || m.kills || 0,
            deaths: m.playerStats?.deaths || m.deaths || 0,
            kd: m.playerStats?.kdRatio || m.kdRatio ||
                ((m.playerStats?.deaths || m.deaths) > 0
                    ? Math.round(((m.playerStats?.kills || m.kills || 0) / (m.playerStats?.deaths || m.deaths || 1)) * 100) / 100
                    : m.playerStats?.kills || m.kills || 0),
            timestamp: m.utcStartSeconds
                ? m.utcStartSeconds * 1000
                : m.timestamp || Date.now(),
        }));
    } catch {
        return [];
    }
}

export default async (req: Request, context: Context) => {
    if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    const url = new URL(req.url);
    const username = url.searchParams.get("username");
    const platform = url.searchParams.get("platform") || "battlenet";

    if (!username) {
        return new Response(JSON.stringify({ error: "Username is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const ssoToken = Netlify.env.get("ACT_SSO_COOKIE") || "";

    if (!ssoToken) {
        return new Response(JSON.stringify({
            error: "COD API not configured. The site owner needs to set the ACT_SSO_COOKIE environment variable. See the admin instructions for how to obtain this token from callofduty.com."
        }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
        });
    }

    const codPlatform = PLATFORM_MAP[platform] || "battle";
    // Encode the username for the URL (Battle.net tags use # which needs encoding)
    const encodedUsername = encodeURIComponent(username);

    // Build cookies for the Activision API
    const cookies = `ACT_SSO_COOKIE=${ssoToken}; ACT_SSO_COOKIE_EXPIRY=1735689600000; new_SiteId=cod; comCookies=on`;

    const headers: Record<string, string> = {
        "Cookie": cookies,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://my.callofduty.com/",
        "Origin": "https://my.callofduty.com",
    };

    const result: CodStatsResponse = {
        username,
        platform,
    };

    // Fetch lifetime multiplayer stats
    try {
        const statsUrl = `${COD_API_BASE}/stats/cod/v1/title/mw/platform/${codPlatform}/gamer/${encodedUsername}/profile/type/mp`;
        const statsResp = await fetch(statsUrl, { headers });

        if (statsResp.ok) {
            const statsData = await statsResp.json();
            if (statsData?.status === "success" && statsData?.data) {
                const extracted = extractStats(statsData);
                Object.assign(result, extracted);
            } else if (statsData?.data?.message) {
                // API returned an error message (e.g. "Not permitted: not allowed")
                result.error = statsData.data.message;
            }
        } else if (statsResp.status === 404) {
            return new Response(JSON.stringify({
                error: `Player "${username}" not found on ${platform}. Make sure the gamertag is spelled correctly and the right platform is selected.`
            }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        } else if (statsResp.status === 401 || statsResp.status === 403) {
            return new Response(JSON.stringify({
                error: "COD API authentication expired. The site owner needs to refresh the ACT_SSO_COOKIE token."
            }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            });
        }
    } catch (err: any) {
        console.error("Failed to fetch COD stats:", err?.message);
    }

    // Fetch recent matches
    try {
        const matchesUrl = `${COD_API_BASE}/crm/cod/v2/title/mw/platform/${codPlatform}/gamer/${encodedUsername}/matches/mp/start/0/end/0/details`;
        const matchResp = await fetch(matchesUrl, { headers });

        if (matchResp.ok) {
            const matchData = await matchResp.json();
            if (matchData?.status === "success") {
                result.recentMatches = extractRecentMatches(matchData);
            }
        }
    } catch (err: any) {
        console.error("Failed to fetch recent matches:", err?.message);
    }

    return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
    });
};

export const config: Config = {
    path: "/api/cod-stats",
};
