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

export interface WeaponAttachment {
    slot: string;
    name: string;
    tuning?: string;
}

export interface WeaponLoadout {
    id: string;
    weaponName: string;
    weaponSlug: string;
    weaponCategory: string;
    weaponImage: string;
    game: string;
    description: string;
    attachments: WeaponAttachment[];
    perks: string[];
    equipment: { tactical: string; lethal: string };
    tags: string[];
    featured: boolean;
    createdAt: string;
    updatedAt: string;
}

export default async (req: Request, context: Context) => {
    const store = getStore({ name: "cod-loadouts", consistency: "strong" });
    const url = new URL(req.url);
    const loadoutId = url.searchParams.get("id");

    // GET - Read loadouts (public)
    if (req.method === "GET") {
        try {
            if (loadoutId) {
                const loadout = await store.get(loadoutId, { type: "json" });
                if (!loadout) {
                    return new Response(JSON.stringify({ error: "Loadout not found" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                return new Response(JSON.stringify(loadout), {
                    headers: { "Content-Type": "application/json" },
                });
            }

            // List all loadouts
            const { blobs } = await store.list();
            const loadouts: WeaponLoadout[] = [];
            for (const blob of blobs) {
                const data = await store.get(blob.key, { type: "json" }) as WeaponLoadout | null;
                if (data) loadouts.push(data);
            }

            // Sort by updatedAt descending
            loadouts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

            return new Response(JSON.stringify(loadouts), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to fetch loadouts" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    // POST - Create loadout (requires auth)
    if (req.method === "POST") {
        const session = parseSession(req.headers.get("cookie"));
        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        try {
            const data = await req.json();
            const id = data.id || "loadout_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            const slug = (data.weaponName || "weapon").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

            const loadout: WeaponLoadout = {
                id,
                weaponName: data.weaponName || "",
                weaponSlug: slug,
                weaponCategory: data.weaponCategory || "Assault Rifle",
                weaponImage: data.weaponImage || "",
                game: data.game || "Black Ops 7",
                description: data.description || "",
                attachments: data.attachments || [],
                perks: data.perks || [],
                equipment: data.equipment || { tactical: "", lethal: "" },
                tags: data.tags || [],
                featured: data.featured || false,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await store.setJSON(id, loadout);

            return new Response(JSON.stringify({ success: true, loadout }), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to save loadout" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    // DELETE - Remove loadout (requires auth)
    if (req.method === "DELETE") {
        const session = parseSession(req.headers.get("cookie"));
        if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        try {
            if (!loadoutId) {
                return new Response(JSON.stringify({ error: "Loadout ID required" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                });
            }

            await store.delete(loadoutId);

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to delete loadout" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
    });
};

export const config: Config = {
    path: "/api/loadouts",
};
