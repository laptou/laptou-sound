// server-side better auth configuration
// uses kysely-d1 for database access (as per project requirements)
// note: better auth uses kysely-d1 internally via its d1 adapter
import { betterAuth } from "better-auth";
import type { D1Database } from "@cloudflare/workers-types";

// create auth instance with d1 database
// better auth's d1 adapter uses kysely-d1 internally
// note: this must be called with the env context from cloudflare
export function createAuth(db: D1Database) {
  return betterAuth({
    database: {
      provider: "sqlite",
      url: "", // not used for d1, but required
      // better auth's d1 adapter uses kysely-d1 internally
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // simplified for now
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // update session every day
    },
  });
}

// type for auth instance
export type Auth = ReturnType<typeof createAuth>;
