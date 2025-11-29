// database access helper for cloudflare d1

import { env } from "cloudflare:workers";
import { createServerOnlyFn } from "@tanstack/solid-start";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const getDb = createServerOnlyFn(() => {
	return drizzle(env.laptou_sound_db, { schema });
});

export * from "./schema";
