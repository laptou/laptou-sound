// file streaming api - serves files from r2
import { createAPIFileRoute } from "@tanstack/solid-start/api";
import type { R2Bucket } from "@cloudflare/workers-types";

export const APIRoute = createAPIFileRoute("/api/files/$")({
  GET: async ({ request, params, context }) => {
    const env = (context as any).cloudflare?.env;
    const r2 = env?.R2 as R2Bucket | undefined;

    if (!r2) {
      return new Response("Storage not configured", { status: 500 });
    }

    // get file key from path
    const key = params["_splat"];
    if (!key) {
      return new Response("File key required", { status: 400 });
    }

    // get file from r2
    const object = await r2.get(key);
    if (!object) {
      return new Response("File not found", { status: 404 });
    }

    // determine content type
    const contentType =
      object.httpMetadata?.contentType || "application/octet-stream";

    // set cache headers based on file type
    const isPlayback = key.startsWith("playback/");
    const isWaveform = key.startsWith("waveforms/");
    const cacheControl =
      isPlayback || isWaveform
        ? "public, max-age=31536000, immutable" // 1 year for processed files
        : "public, max-age=3600"; // 1 hour for others

    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": object.size.toString(),
        "Cache-Control": cacheControl,
        "Accept-Ranges": "bytes",
      },
    });
  },
});

