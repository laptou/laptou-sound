// track versions page - manage versions for a track
import { createFileRoute, redirect, useNavigate } from "@tanstack/solid-router";
import { Show, For, createSignal } from "solid-js";
import { Link } from "@tanstack/solid-router";
import { ArrowLeft, Upload, Trash2, CheckCircle2, Clock, AlertCircle, Download } from "lucide-solid";
import { getSession } from "../../../lib/server/auth";
import { fetchTrack, fetchTrackVersions } from "../../../lib/server/tracks";
import type { TrackVersion } from "../../../lib/db/types";
import ProcessingStatus from "../../../components/ProcessingStatus";

export const Route = createFileRoute("/track/$trackId/versions")({
  head: ({ loaderData }) => ({
    meta: [{ title: `Versions - ${loaderData?.track?.title || "Track"} - laptou sound` }],
  }),
  beforeLoad: async ({ params }) => {
    const session = await getSession();
    if (!session?.user) {
      throw redirect({ to: "/auth/login" });
    }
    return { session };
  },
  loader: async ({ params, context }) => {
    const [track, versions] = await Promise.all([
      fetchTrack({ data: params.trackId }),
      fetchTrackVersions({ data: params.trackId }),
    ]);

    // check ownership
    const session = (context as any).session;
    if (track.uploader_id !== session.user.id && session.role !== "admin") {
      throw redirect({ to: `/track/${params.trackId}` });
    }

    return { track, versions };
  },
  component: VersionsPage,
});

function VersionsPage() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();

  const track = () => data()?.track;
  const versions = () => data()?.versions ?? [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm("Are you sure you want to delete this version? This cannot be undone.")) {
      return;
    }

    try {
      // import dynamically to avoid SSR issues
      const { deleteTrackVersion } = await import("../../../lib/server/tracks");
      await deleteTrackVersion({ data: versionId });
      // reload page
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete version:", e);
      alert("Failed to delete version");
    }
  };

  return (
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div class="animate-fade-in">
        {/* header */}
        <div class="flex items-center gap-4 mb-8">
          <Link
            href={`/track/${params.trackId}`}
            class="btn-icon btn-ghost"
          >
            <ArrowLeft class="w-5 h-5" />
          </Link>
          <div class="flex-1 min-w-0">
            <h1 class="text-title truncate">{track()?.title}</h1>
            <p class="text-small">Manage versions</p>
          </div>
          <Link
            href={`/track/${params.trackId}/upload`}
            class="btn-primary"
          >
            <Upload class="w-4 h-4" />
            New version
          </Link>
        </div>

        {/* versions list */}
        <div class="space-y-4">
          <For each={versions()}>
            {(version, index) => (
              <div
                class={`card p-4 animate-fade-in stagger-${Math.min(index() + 1, 8)}`}
              >
                <div class="flex items-center gap-4">
                  {/* version number */}
                  <div class="w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900 flex items-center justify-center flex-shrink-0">
                    <span class="font-bold text-accent-600 dark:text-accent-400">
                      v{version.version_number}
                    </span>
                  </div>

                  {/* version info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-medium">
                        Version {version.version_number}
                      </span>
                      <Show when={index() === 0}>
                        <span class="badge-accent">Latest</span>
                      </Show>
                    </div>
                    <div class="flex items-center gap-4 text-small">
                      <span>{formatDate(version.created_at)}</span>
                      <span>{formatDuration(version.duration)}</span>
                    </div>
                  </div>

                  {/* status */}
                  <ProcessingStatus status={version.processing_status} />

                  {/* actions */}
                  <div class="flex items-center gap-2">
                    <Show when={version.processing_status === "complete" && version.original_key}>
                      <a
                        href={`/api/files/${version.original_key}`}
                        download
                        class="btn-icon btn-ghost"
                        title="Download original"
                      >
                        <Download class="w-4 h-4" />
                      </a>
                    </Show>

                    <Show when={versions().length > 1}>
                      <button
                        onClick={() => handleDeleteVersion(version.id)}
                        class="btn-icon btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Delete version"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={versions().length === 0}>
          <div class="card p-8 text-center text-small">
            No versions found. Upload your first version to get started.
          </div>
        </Show>
      </div>
    </div>
  );
}

