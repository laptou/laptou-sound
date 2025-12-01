// global media controls bar
// appears at the bottom of the screen when a track is playing

import { ClientOnly } from "@tanstack/solid-router";
import Music from "lucide-solid/icons/music";
import Pause from "lucide-solid/icons/pause";
import Play from "lucide-solid/icons/play";
import SkipBack from "lucide-solid/icons/skip-back";
import SkipForward from "lucide-solid/icons/skip-forward";
import Volume2 from "lucide-solid/icons/volume-2";
import VolumeX from "lucide-solid/icons/volume-x";
import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useAudioPlayer } from "@/lib/audio-player-context";
import { cn } from "@/lib/utils";
import { QueuePanel } from "./QueuePanel";

const formatTime = (seconds: number) => {
	if (!Number.isFinite(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const MediaControlsInner: Component = () => {
	const player = useAudioPlayer();
	const [isMuted, setIsMuted] = createSignal(false);
	const [hoverProgress, setHoverProgress] = createSignal<number | null>(null);

	let progressRef: HTMLDivElement | undefined;

	// spacebar to toggle play/pause (skip when focused on inputs)
	onMount(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code !== "Space") return;
			if (!player.currentTrack()) return;

			const target = e.target as HTMLElement;
			const isInput =
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable;
			if (isInput) return;

			e.preventDefault();
			player.togglePlayPause();
		};

		window.addEventListener("keydown", handleKeyDown);
		onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
	});

	const progress = () => {
		const dur = player.duration();
		if (!dur) return 0;
		return (player.currentTime() / dur) * 100;
	};

	const toggleMute = () => {
		const audio = player.audioRef();
		if (!audio) return;
		audio.muted = !audio.muted;
		setIsMuted(audio.muted);
	};

	const handleProgressClick = (e: MouseEvent) => {
		if (!progressRef) return;
		const rect = progressRef.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		player.seekPercent(Math.max(0, Math.min(1, percent)));
	};

	const handleProgressHover = (e: MouseEvent) => {
		if (!progressRef) return;
		const rect = progressRef.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		setHoverProgress(Math.max(0, Math.min(1, percent)));
	};

	const handleProgressLeave = () => {
		setHoverProgress(null);
	};

	// hide when no track
	const isVisible = () => player.currentTrack() !== null;

	return (
		<div
			class={cn(
				"fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
				isVisible()
					? "translate-y-0 opacity-100"
					: "translate-y-full opacity-0 pointer-events-none",
			)}
			style={{
				"view-transition-name": "media-controls",
			}}
		>
			{/* backdrop blur layer */}
			<div class="absolute inset-0 bg-stone-950/90 backdrop-blur-xl border-t border-stone-800/50" />

			{/* content */}
			<div class="relative max-w-4xl mx-auto px-4 py-3">
				<div class="flex items-center gap-4">
					{/* track info */}
					<div class="flex items-center gap-3 min-w-0 shrink-0 w-48">
						<Show when={player.currentTrack()}>
							{(track) => (
								<>
									<div class="w-12 h-12 rounded-lg bg-stone-800 shrink-0 overflow-hidden shadow-lg">
										<Show
											when={track().albumArtUrl}
											fallback={
												<div class="w-full h-full flex items-center justify-center">
													<Music class="w-5 h-5 text-stone-600" />
												</div>
											}
										>
											{(url) => (
												<img
													src={url()}
													alt=""
													class="w-full h-full object-cover"
												/>
											)}
										</Show>
									</div>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-white truncate">
											{track().title}
										</p>
										<p class="text-xs text-stone-400 truncate">
											<Show
												when={track().artist && track().artist !== "Artist"}
												fallback={
													track().ownerName ?? "Unknown Artist"
												}
											>
												{(artist) => (
													<>
														{artist()}
														<Show when={track().ownerName}>
															{(owner) => (
																<> &bull; {owner()}</>
															)}
														</Show>
													</>
												)}
											</Show>
										</p>
									</div>
								</>
							)}
						</Show>
					</div>

					{/* center controls */}
					<div class="flex-1 flex flex-col items-center gap-2">
						{/* playback buttons */}
						<div class="flex items-center gap-2">
							<button
								type="button"
								onClick={() => player.skipPrevious()}
								class="p-2 text-stone-400 hover:text-white transition-colors"
							>
								<SkipBack class="w-5 h-5" />
							</button>
							<button
								type="button"
								onClick={() => player.togglePlayPause()}
								class="w-10 h-10 flex items-center justify-center bg-white rounded-full text-stone-900 hover:scale-105 active:scale-95 transition-transform shadow-lg"
							>
								<Show
									when={player.isPlaying()}
									fallback={<Play class="w-5 h-5 ml-0.5" />}
								>
									<Pause class="w-5 h-5" />
								</Show>
							</button>
							<button
								type="button"
								onClick={() => player.skipNext()}
								disabled={player.queue().length === 0}
								class="p-2 text-stone-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
							>
								<SkipForward class="w-5 h-5" />
							</button>
						</div>

						{/* progress bar */}
						<div class="w-full flex items-center gap-2">
							<span class="text-xs text-stone-500 w-10 text-right tabular-nums">
								{formatTime(player.currentTime())}
							</span>
							<div
								ref={progressRef}
								onClick={handleProgressClick}
								onMouseMove={handleProgressHover}
								onMouseLeave={handleProgressLeave}
								class="flex-1 h-1.5 bg-stone-700 rounded-full cursor-pointer relative group"
							>
								{/* filled progress */}
								<div
									class="absolute inset-y-0 left-0 bg-linear-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
									style={{ width: `${progress()}%` }}
								/>
								{/* hover indicator */}
								<Show when={hoverProgress() !== null}>
									<div
										class="absolute inset-y-0 left-0 bg-white/20 rounded-full"
										style={{ width: `${(hoverProgress() ?? 0) * 100}%` }}
									/>
								</Show>
								{/* scrubber */}
								<div
									class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
									style={{ left: `calc(${progress()}% - 6px)` }}
								/>
							</div>
							<span class="text-xs text-stone-500 w-10 tabular-nums">
								{formatTime(player.duration())}
							</span>
						</div>
					</div>

					{/* right controls */}
					<div class="flex items-center gap-2 shrink-0 w-48 justify-end">
						{/* volume */}
						<button
							type="button"
							onClick={toggleMute}
							class="p-2 text-stone-400 hover:text-white transition-colors"
						>
							<Show when={isMuted()} fallback={<Volume2 class="w-5 h-5" />}>
								<VolumeX class="w-5 h-5" />
							</Show>
						</button>

						{/* queue panel */}
						<QueuePanel />
					</div>
				</div>
			</div>
		</div>
	);
};

export const MediaControls: Component = () => {
	return (
		<ClientOnly>
			<MediaControlsInner />
		</ClientOnly>
	);
};

