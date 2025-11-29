// better auth api handler - catches all /api/auth/* routes
import { createAPIFileRoute } from "@tanstack/solid-start/api";
import { betterAuth } from "better-auth";
import type { D1Database } from "@cloudflare/workers-types";

// create auth instance for this request
function createAuthInstance(db: D1Database) {
  return betterAuth({
    database: {
      provider: "sqlite",
      url: "", // not used for d1
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    trustedOrigins: ["http://localhost:3000"],
  });
}

// handle all auth requests
async function handleAuth(request: Request, env: any) {
  const db = env.DB as D1Database;
  const auth = createAuthInstance(db);
  return auth.handler(request);
}

export const APIRoute = createAPIFileRoute("/api/auth/$")({
  GET: async ({ request, context }) => {
    const env = (context as any).cloudflare?.env;
    return handleAuth(request, env);
  },
  POST: async ({ request, context }) => {
    const env = (context as any).cloudflare?.env;
    return handleAuth(request, env);
  },
});

