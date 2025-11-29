// track card component for grid display
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { Play, Clock, Music } from "lucide-solid";
import type { TrackWithLatestVersion } from "../lib/db/types";
import ProcessingStatus from "./ProcessingStatus";

interface Props {
  track: TrackWithLatestVersion;
  index?: number;
}

export default function TrackCard(props: Props) {
  const track = () => props.track;

  // format duration as mm:ss
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // get cover image url or placeholder
  const coverUrl = () => {
    if (track().cover_key) {
      return `/api/files/${track().cover_key}`;
    }
    return null;
  };

  // stagger animation delay class
  const staggerClass = () => {
    if (props.index === undefined) return "";
    return `stagger-${Math.min(props.index + 1, 8)}`;
  };

  return (
    <Link
      href={`/track/${track().id}`}
      class={`card-hover group block opacity-0 animate-fade-in ${staggerClass()}`}
    >
      {/* cover image / placeholder */}
      <div class="aspect-square relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-accent-100 to-accent-200 dark:from-accent-900 dark:to-accent-800">
        <Show
          when={coverUrl()}
          fallback={
            <div class="absolute inset-0 flex items-center justify-center">
              <Music class="w-16 h-16 text-accent-400 dark:text-accent-600" />
            </div>
          }
        >
          <img
            src={coverUrl()!}
            alt={track().title}
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </Show>

        {/* play button overlay */}
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <div class="w-14 h-14 rounded-full bg-white/90 dark:bg-surface-900/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-200 shadow-medium">
            <Play class="w-6 h-6 text-accent-600 dark:text-accent-400 ml-0.5" />
          </div>
        </div>

        {/* processing status badge */}
        <Show when={track().processing_status && track().processing_status !== "complete"}>
          <div class="absolute top-2 right-2">
            <ProcessingStatus status={track().processing_status!} />
          </div>
        </Show>
      </div>

      {/* track info */}
      <div class="p-4">
        <h3 class="font-semibold text-surface-900 dark:text-surface-100 truncate group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
          {track().title}
        </h3>

        <Show when={track().description}>
          <p class="text-small line-clamp-2 mt-1">{track().description}</p>
        </Show>

        <div class="flex items-center gap-3 mt-3 text-small">
          {/* duration */}
          <div class="flex items-center gap-1">
            <Clock class="w-3.5 h-3.5" />
            <span>{formatDuration(track().duration)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

