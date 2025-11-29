// server-side better auth configuration
import { betterAuth } from "better-auth";
import type { D1Database } from "@cloudflare/workers-types";

// create auth instance with d1 database
// note: this must be called with the env context from cloudflare
export function createAuth(db: D1Database) {
  return betterAuth({
    database: {
      provider: "sqlite",
      url: "", // not used for d1, but required
      // d1 uses the fetch adapter internally
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // simplified for now
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // update session every day
    },
    // custom database adapter for d1
    advanced: {
      database: {
        // use d1 directly for queries
        async executeQuery({ query, params }) {
          const stmt = db.prepare(query);
          if (params && params.length > 0) {
            stmt.bind(...params);
          }
          const result = await stmt.all();
          return result.results || [];
        },
      },
    },
  });
}

// type for auth instance
export type Auth = ReturnType<typeof createAuth>;

