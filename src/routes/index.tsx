// home page - displays recent tracks
import { createFileRoute } from "@tanstack/solid-router";
import { For, Show, Suspense, createResource } from "solid-js";
import { Music, Disc3 } from "lucide-solid";
import { fetchRecentTracks } from "../lib/server/tracks";
import TrackCard from "../components/TrackCard";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "laptou sound - Discover music" },
      { name: "description", content: "Discover and share music with laptou sound" },
    ],
  }),
  loader: async () => {
    return fetchRecentTracks({ data: { limit: 20, offset: 0 } });
  },
  component: HomePage,
});

function HomePage() {
  const tracks = Route.useLoaderData();

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* hero section */}
      <section class="text-center mb-12 animate-fade-in">
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-accent-100 dark:bg-accent-900 rounded-full mb-6">
          <Disc3 class="w-4 h-4 text-accent-600 dark:text-accent-400 animate-spin-slow" />
          <span class="text-sm font-medium text-accent-700 dark:text-accent-300">
            Now playing
          </span>
        </div>
        <h1 class="text-display text-surface-900 dark:text-white mb-4">
          Discover new sounds
        </h1>
        <p class="text-subtitle text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
          A private space for sharing and discovering music. Listen to the
          latest uploads from our community.
        </p>
      </section>

      {/* recent tracks */}
      <section>
        <h2 class="text-title mb-6">Recent uploads</h2>

        <Show
          when={tracks() && tracks()!.length > 0}
          fallback={
            <EmptyState
              icon={<Music class="w-12 h-12 text-surface-400" />}
              title="No tracks yet"
              description="Be the first to upload a track and share your music with the community."
            />
          }
        >
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            <For each={tracks()}>
              {(track, index) => <TrackCard track={track} index={index()} />}
            </For>
          </div>
        </Show>
      </section>
    </div>
  );
}
