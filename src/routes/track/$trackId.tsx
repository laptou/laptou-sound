// track detail page
import { createFileRoute } from "@tanstack/solid-router";
import { Show, createSignal, createResource, For, Suspense } from "solid-js";
import { Link } from "@tanstack/solid-router";
import { Music, User, Clock, Play, Download, Share2, Heart, MessageCircle } from "lucide-solid";
import { fetchTrack, fetchPlayCount, recordTrackPlay } from "../../lib/server/tracks";
import { fetchComments } from "../../lib/server/comments";
import { useSession } from "../../lib/auth-client";
import WaveformPlayer from "../../components/WaveformPlayer";
import LoadingSpinner from "../../components/LoadingSpinner";
import ProcessingStatus from "../../components/ProcessingStatus";

export const Route = createFileRoute("/track/$trackId")({
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title || "Track"} - laptou sound` },
      { name: "description", content: loaderData?.description || "Listen on laptou sound" },
    ],
  }),
  loader: async ({ params }) => {
    return fetchTrack({ data: params.trackId });
  },
  component: TrackDetailPage,
});

function TrackDetailPage() {
  const track = Route.useLoaderData();
  const params = Route.useParams();
  const session = useSession();

  const [hasRecordedPlay, setHasRecordedPlay] = createSignal(false);

  // load additional data
  const [playCount] = createResource(
    () => track()?.latest_version_id,
    (versionId) => (versionId ? fetchPlayCount({ data: versionId }) : 0)
  );

  const [comments] = createResource(
    () => params.trackId,
    (trackId) => fetchComments({ data: trackId })
  );

  // format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // cover url
  const coverUrl = () => {
    if (track()?.cover_key) {
      return `/api/files/${track()!.cover_key}`;
    }
    return null;
  };

  // audio urls
  const audioUrl = () => {
    if (track()?.playback_key) {
      return `/api/files/${track()!.playback_key}`;
    }
    return null;
  };

  const waveformUrl = () => {
    if (track()?.waveform_key) {
      return `/api/files/${track()!.waveform_key}`;
    }
    // fallback placeholder
    return "/api/waveform/placeholder";
  };

  // record play on first play
  const handlePlay = async () => {
    if (hasRecordedPlay() || !track()?.latest_version_id) return;

    setHasRecordedPlay(true);
    try {
      await recordTrackPlay({
        data: {
          trackVersionId: track()!.latest_version_id!,
          sessionId: crypto.randomUUID(),
        },
      });
    } catch (e) {
      console.error("Failed to record play:", e);
    }
  };

  // parse social prompt
  const socialPrompt = () => {
    if (!track()?.social_prompt) return null;
    try {
      return JSON.parse(track()!.social_prompt!);
    } catch {
      return null;
    }
  };

  return (
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div class="animate-fade-in-up">
        {/* hero section */}
        <div class="flex flex-col md:flex-row gap-8 mb-8">
          {/* cover art */}
          <div class="w-full md:w-80 flex-shrink-0">
            <div class="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-accent-100 to-accent-200 dark:from-accent-900 dark:to-accent-800 shadow-medium">
              <Show
                when={coverUrl()}
                fallback={
                  <div class="w-full h-full flex items-center justify-center">
                    <Music class="w-24 h-24 text-accent-400 dark:text-accent-600" />
                  </div>
                }
              >
                <img
                  src={coverUrl()!}
                  alt={track()?.title}
                  class="w-full h-full object-cover"
                />
              </Show>
            </div>
          </div>

          {/* track info */}
          <div class="flex-1 min-w-0">
            <h1 class="text-display mb-2 truncate">{track()?.title}</h1>

            <Show when={track()?.description}>
              <p class="text-body text-surface-600 dark:text-surface-400 mb-4 line-clamp-3">
                {track()?.description}
              </p>
            </Show>

            {/* meta info */}
            <div class="flex flex-wrap items-center gap-4 text-small mb-6">
              <div class="flex items-center gap-1.5">
                <Clock class="w-4 h-4" />
                <span>{formatDuration(track()?.duration)}</span>
              </div>

              <div class="flex items-center gap-1.5">
                <Play class="w-4 h-4" />
                <span>{playCount() ?? 0} plays</span>
              </div>

              <div class="flex items-center gap-1.5">
                <MessageCircle class="w-4 h-4" />
                <span>{comments()?.length ?? 0} comments</span>
              </div>

              <span class="text-surface-400">•</span>
              <span>{formatDate(track()?.created_at ?? "")}</span>
            </div>

            {/* processing status */}
            <Show when={track()?.processing_status !== "complete"}>
              <div class="mb-6">
                <ProcessingStatus status={track()?.processing_status ?? "pending"} />
                <p class="text-small mt-2">
                  This track is still being processed. Playback will be available soon.
                </p>
              </div>
            </Show>

            {/* action buttons */}
            <div class="flex flex-wrap gap-3">
              <Show when={track()?.is_downloadable && track()?.processing_status === "complete"}>
                <Link
                  href={`/api/files/${track()?.latest_version_id}/download`}
                  class="btn-secondary"
                >
                  <Download class="w-4 h-4" />
                  Download
                </Link>
              </Show>

              <button class="btn-ghost">
                <Share2 class="w-4 h-4" />
                Share
              </button>

              <button class="btn-ghost">
                <Heart class="w-4 h-4" />
                Like
              </button>
            </div>
          </div>
        </div>

        {/* waveform player */}
        <Show
          when={track()?.processing_status === "complete" && audioUrl()}
          fallback={
            <div class="card p-8 text-center">
              <Show
                when={track()?.processing_status === "failed"}
                fallback={
                  <>
                    <LoadingSpinner size="md" />
                    <p class="text-small mt-4">Processing audio...</p>
                  </>
                }
              >
                <p class="text-surface-600 dark:text-surface-400">
                  Audio processing failed. Please try re-uploading.
                </p>
              </Show>
            </div>
          }
        >
          <WaveformPlayer
            audioUrl={audioUrl()!}
            waveformUrl={waveformUrl()}
            onPlay={handlePlay}
          />
        </Show>

        {/* social prompt for downloads */}
        <Show when={socialPrompt() && (socialPrompt().instagram || socialPrompt().soundcloud || socialPrompt().tiktok)}>
          <div class="card p-6 mt-6">
            <h3 class="font-semibold mb-3">Support the artist</h3>
            <div class="flex flex-wrap gap-3">
              <Show when={socialPrompt().instagram}>
                <a
                  href={`https://instagram.com/${socialPrompt().instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-secondary text-sm"
                >
                  Follow on Instagram
                </a>
              </Show>
              <Show when={socialPrompt().soundcloud}>
                <a
                  href={`https://soundcloud.com/${socialPrompt().soundcloud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-secondary text-sm"
                >
                  Follow on SoundCloud
                </a>
              </Show>
              <Show when={socialPrompt().tiktok}>
                <a
                  href={`https://tiktok.com/@${socialPrompt().tiktok}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-secondary text-sm"
                >
                  Follow on TikTok
                </a>
              </Show>
            </div>
          </div>
        </Show>

        {/* comments section */}
        <section class="mt-8">
          <h2 class="text-title mb-4">Comments</h2>

          <Show
            when={comments() && comments()!.length > 0}
            fallback={
              <div class="card p-6 text-center text-small">
                No comments yet. Be the first to share your thoughts!
              </div>
            }
          >
            <div class="space-y-4">
              <For each={comments()}>
                {(comment) => (
                  <div class="card p-4 animate-fade-in">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0">
                        <Show
                          when={comment.user_image}
                          fallback={<User class="w-5 h-5 text-surface-500" />}
                        >
                          <img
                            src={comment.user_image!}
                            alt={comment.user_name || "User"}
                            class="w-10 h-10 rounded-full"
                          />
                        </Show>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-medium text-sm">
                            {comment.user_name || "Anonymous"}
                          </span>
                          <Show when={comment.timestamp_seconds}>
                            <span class="text-mono text-xs text-accent-500">
                              @ {formatDuration(comment.timestamp_seconds)}
                            </span>
                          </Show>
                          <span class="text-xs text-surface-400">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <p class="text-sm text-surface-700 dark:text-surface-300">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* add comment form */}
          <Show when={session()?.user}>
            <CommentForm trackId={params.trackId} />
          </Show>
        </section>
      </div>
    </div>
  );
}

// comment form component
function CommentForm(props: { trackId: string }) {
  const [content, setContent] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!content().trim()) return;

    setLoading(true);
    try {
      const { addComment } = await import("../../lib/server/comments");
      await addComment({
        data: {
          trackId: props.trackId,
          content: content().trim(),
        },
      });
      setContent("");
      // trigger refetch somehow - for now, reload
      window.location.reload();
    } catch (e) {
      console.error("Failed to add comment:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="card p-4 mt-4">
      <textarea
        value={content()}
        onInput={(e) => setContent(e.currentTarget.value)}
        placeholder="Add a comment..."
        class="input resize-none h-20"
        maxLength={500}
      />
      <div class="flex justify-end mt-3">
        <button
          type="submit"
          class="btn-primary"
          disabled={loading() || !content().trim()}
        >
          {loading() ? "Posting..." : "Post comment"}
        </button>
      </div>
    </form>
  );
}

