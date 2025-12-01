// queue panel component using popover
// displays the playback queue with track list and controls

import { ClientOnly } from "@tanstack/solid-router";
import ChevronDown from "lucide-solid/icons/chevron-down";
import ListMusic from "lucide-solid/icons/list-music";
import Music from "lucide-solid/icons/music";
import Play from "lucide-solid/icons/play";
import Trash2 from "lucide-solid/icons/trash-2";
import X from "lucide-solid/icons/x";
import { type Component, For, Show } from "solid-js";
import { type QueueTrack, useAudioPlayer } from "@/lib/audio-player-context";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface QueuePanelProps {
	class?: string;
}

export const QueuePanel: Component<QueuePanelProps> = (props) => {
	const player = useAudioPlayer();

	return (
		<Popover placement="top-end">
			<PopoverTrigger
				class={cn(
					"flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
					"bg-stone-800/80 hover:bg-stone-700/80 text-white/70 data-expanded:bg-violet-500/20 data-expanded:text-violet-300",
					props.class,
				)}
			>
				<ListMusic class="w-4 h-4" />
				<span>Queue</span>
				<Show when={player.queue().length > 0}>
					<span class="ml-1 px-1.5 py-0.5 bg-violet-500/30 rounded text-xs">
						{player.queue().length}
					</span>
				</Show>
				<ChevronDown class="w-4 h-4 transition-transform duration-200 in-data-expanded:rotate-180" />
			</PopoverTrigger>

			<PopoverContent
				class="min-w-80 p-0 bg-stone-900/95 backdrop-blur-lg border-stone-700/50 shadow-2xl shadow-black/50 overflow-hidden"
				style={{ "view-transition-name": "queue-panel" }}
			>
				{/* header */}
				<div class="flex items-center justify-between px-4 py-3 border-b border-stone-700/50">
					<span class="font-medium text-white/90">Up Next</span>
					<Show when={player.queue().length > 0}>
						<button
							type="button"
							onClick={() => player.clearQueue()}
							class="text-xs text-stone-400 hover:text-red-400 transition-colors flex items-center gap-1"
						>
							<Trash2 class="w-3 h-3" />
							Clear
						</button>
					</Show>
				</div>

				{/* queue list */}
				<div class="overflow-y-auto max-h-60">
					<Show
						when={player.queue().length > 0}
						fallback={
							<div class="px-4 py-8 text-center text-stone-500 text-sm">
								<ListMusic class="w-8 h-8 mx-auto mb-2 opacity-50" />
								<p>Queue is empty</p>
								<p class="text-xs mt-1 opacity-70">
									Add tracks to play them next
								</p>
							</div>
						}
					>
						<ul class="divide-y divide-stone-800/50">
							<For each={player.queue()}>
								{(track, index) => (
									<QueueItem
										track={track}
										index={index()}
										onPlay={() => player.playFromQueue(index())}
										onRemove={() => player.removeFromQueue(index())}
									/>
								)}
							</For>
						</ul>
					</Show>
				</div>
			</PopoverContent>
		</Popover>
	);
};

interface QueueItemProps {
	track: QueueTrack;
	index: number;
	onPlay: () => void;
	onRemove: () => void;
}

const QueueItem: Component<QueueItemProps> = (props) => {
	return (
		<li
			class="flex items-center gap-3 px-4 py-2 hover:bg-stone-800/50 transition-colors group"
			style={{ "view-transition-name": `queue-item-${props.index}` }}
		>
			{/* album art */}
			<div class="w-10 h-10 rounded bg-stone-800 shrink-0 overflow-hidden relative">
				<Show
					when={props.track.albumArtUrl}
					fallback={
						<div class="w-full h-full flex items-center justify-center">
							<Music class="w-4 h-4 text-stone-600" />
						</div>
					}
				>
					{(url) => (
						<img src={url()} alt="" class="w-full h-full object-cover" />
					)}
				</Show>
				{/* play overlay */}
				<button
					type="button"
					onClick={props.onPlay}
					class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
				>
					<Play class="w-4 h-4 text-white" />
				</button>
			</div>

			{/* track info */}
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-white truncate">
					{props.track.title}
				</p>
				<p class="text-xs text-stone-400 truncate">{props.track.artist}</p>
			</div>

			{/* remove button */}
			<button
				type="button"
				onClick={props.onRemove}
				class="p-1.5 rounded hover:bg-stone-700/50 text-stone-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
			>
				<X class="w-4 h-4" />
			</button>
		</li>
	);
};

// wrapper for client-only rendering
export const QueuePanelWrapper: Component<QueuePanelProps> = (props) => {
	return (
		<ClientOnly>
			<QueuePanel {...props} />
		</ClientOnly>
	);
};
