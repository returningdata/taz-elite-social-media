import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
    const url = new URL(req.url);

    // Clear the session cookie
    return new Response(null, {
        status: 302,
        headers: {
            "Location": `${url.origin}/admin/login`,
            "Set-Cookie": `admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${url.protocol === "https:" ? "; Secure" : ""}`,
        },
    });
};

export const config: Config = {
    path: "/api/admin/logout",
};
