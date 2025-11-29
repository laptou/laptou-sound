// api route to check processing status of a track version
import { createAPIFileRoute } from "@tanstack/solid-start/api";
import type { D1Database } from "@cloudflare/workers-types";

export const APIRoute = createAPIFileRoute("/api/status/$versionId")({
  GET: async ({ params, context }) => {
    const env = (context as any).cloudflare?.env;
    const db = env?.DB as D1Database | undefined;

    if (!db) {
      return Response.json({ error: "Database not configured" }, { status: 500 });
    }

    const { versionId } = params;
    if (!versionId) {
      return Response.json({ error: "Version ID required" }, { status: 400 });
    }

    const version = await db
      .prepare(
        `SELECT processing_status, playback_key, waveform_key, duration 
         FROM track_version WHERE id = ?`
      )
      .bind(versionId)
      .first<{
        processing_status: string;
        playback_key: string | null;
        waveform_key: string | null;
        duration: number | null;
      }>();

    if (!version) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }

    return Response.json({
      status: version.processing_status,
      playbackKey: version.playback_key,
      waveformKey: version.waveform_key,
      duration: version.duration,
    });
  },
});

