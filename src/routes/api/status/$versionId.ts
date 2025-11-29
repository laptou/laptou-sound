// api route to check processing status of a track version

import type { D1Database } from "@cloudflare/workers-types";
import { createAPIFileRoute } from "@tanstack/solid-start/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../../lib/db/schema";

export const APIRoute = createAPIFileRoute("/api/status/$versionId")({
	GET: async ({ params, context }) => {
		const env = (context as any).cloudflare?.env;
		const db = env?.DB as D1Database | undefined;

		if (!db) {
			return Response.json(
				{ error: "Database not configured" },
				{ status: 500 },
			);
		}

		const { versionId } = params;
		if (!versionId) {
			return Response.json({ error: "Version ID required" }, { status: 400 });
		}

		// use Drizzle for database access
		const drizzleDb = drizzle(db, { schema });
		const versions = await drizzleDb
			.select({
				processingStatus: schema.trackVersion.processingStatus,
				playbackKey: schema.trackVersion.playbackKey,
				waveformKey: schema.trackVersion.waveformKey,
				duration: schema.trackVersion.duration,
			})
			.from(schema.trackVersion)
			.where(eq(schema.trackVersion.id, versionId))
			.limit(1);

		const version = versions[0];
		if (!version) {
			return Response.json({ error: "Version not found" }, { status: 404 });
		}

		return Response.json({
			status: version.processingStatus,
			playbackKey: version.playbackKey ?? null,
			waveformKey: version.waveformKey ?? null,
			duration: version.duration ?? null,
		});
	},
});
