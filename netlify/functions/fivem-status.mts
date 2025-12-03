import type { Context, Config } from "@netlify/functions";

interface CFXServerData {
    Data?: {
        clients?: number;
        sv_maxclients?: number;
        hostname?: string;
        gametype?: string;
        mapname?: string;
        players?: Array<{ name: string; id: number; ping: number }>;
    };
    clients?: number;
    sv_maxclients?: number;
    hostname?: string;
    gametype?: string;
    mapname?: string;
}

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);
    // CFX server code from cfx-finder (e.g., "ajv9r5" from cfx.re/join/ajv9r5)
    const cfxCode = url.searchParams.get('code') || 'ajv9r5';

    try {
        // Use the CFX.re servers API with the join code
        const cfxResponse = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${cfxCode}`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; ServerStatus/1.0)'
            }
        });

        if (!cfxResponse.ok) {
            throw new Error(`CFX API returned ${cfxResponse.status}`);
        }

        const cfxData: CFXServerData = await cfxResponse.json();
        const data = cfxData?.Data || cfxData;

        const players = data?.clients || 0;
        const maxPlayers = data?.sv_maxclients || 0;

        return new Response(JSON.stringify({
            online: true,
            players: players,
            maxPlayers: maxPlayers,
            hostname: data?.hostname || 'California Roleplay',
            gametype: data?.gametype || 'FiveM',
            mapname: data?.mapname || 'Los Santos'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Error fetching server status:', error);

        return new Response(JSON.stringify({
            online: false,
            players: 0,
            maxPlayers: 0,
            hostname: 'California Roleplay',
            error: 'Server is offline or unreachable'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export const config: Config = {
    path: "/api/fivem-status"
};
