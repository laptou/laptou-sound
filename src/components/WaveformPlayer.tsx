// waveform audio player component
// displays a soundcloud-style waveform with playback controls
// syncs with global audio player state for cross-page playback

import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import ListPlus from "lucide-solid/icons/list-plus";
import Pause from "lucide-solid/icons/pause";
import Play from "lucide-solid/icons/play";
import Volume2 from "lucide-solid/icons/volume-2";
import VolumeX from "lucide-solid/icons/volume-x";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { type QueueTrack, useAudioPlayer } from "@/lib/audio-player-context";

interface WaveformData {
	peaks: number[];
	samples: number;
}

export interface WaveformPlayerProps {
	trackId: string;
	versionId: string;
	streamUrl: string | null;
	title: string;
	artist: string;
	albumArtUrl?: string | null;
	duration?: number;
	onPlay?: () => void;
	// hide track title/artist when shown elsewhere on the page
	hideTitle?: boolean;
}

// generate waveform data from audio buffer using web audio api
async function generateWaveformFromUrl(url: string): Promise<WaveformData> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch audio file");
	}

	const arrayBuffer = await response.arrayBuffer();
	const audioContext = new AudioContext();

	try {
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		const channelData = audioBuffer.getChannelData(0);

		// downsample to ~200 peaks for visualization
		const numPeaks = 200;
		const blockSize = Math.floor(channelData.length / numPeaks);
		const peaks: number[] = [];

		for (let i = 0; i < numPeaks; i++) {
			const start = i * blockSize;
			const end = Math.min(start + blockSize, channelData.length);

			// find max absolute value in this block
			let max = 0;
			for (let j = start; j < end; j++) {
				const abs = Math.abs(channelData[j]);
				if (abs > max) max = abs;
			}

			peaks.push(max);
		}

		// normalize peaks to 0-1 range
		const maxPeak = Math.max(...peaks, 0.01);
		const normalizedPeaks = peaks.map((p) => p / maxPeak);

		return { peaks: normalizedPeaks, samples: numPeaks };
	} finally {
		await audioContext.close();
	}
}

const WaveformPlayerInner: Component<WaveformPlayerProps> = (props) => {
	const player = useAudioPlayer();
	let canvasRef: HTMLCanvasElement | undefined;
	let containerRef: HTMLDivElement | undefined;

	const [isMuted, setIsMuted] = createSignal(false);
	const [canvasWidth, setCanvasWidth] = createSignal(600);

	// check if this track is currently playing in the global player
	const isCurrentTrack = createMemo(() => {
		const current = player.currentTrack();
		return (
			current?.id === props.trackId && current?.versionId === props.versionId
		);
	});

	// derive playback state from global player when this is the current track
	const isPlaying = createMemo(() => isCurrentTrack() && player.isPlaying());
	const currentTime = createMemo(() =>
		isCurrentTrack() ? player.currentTime() : 0,
	);
	const duration = createMemo(() =>
		isCurrentTrack() ? player.duration() : (props.duration ?? 0),
	);

	// compute waveform data client-side from audio stream
	const waveformQuery = useQuery(() => ({
		queryKey: ["waveform", props.streamUrl],
		queryFn: async (): Promise<WaveformData> => {
			if (!props.streamUrl) {
				throw new Error("No stream URL provided");
			}
			return generateWaveformFromUrl(props.streamUrl);
		},
		enabled: !!props.streamUrl,
		retry: 1,
		staleTime: Number.POSITIVE_INFINITY, // waveform won't change for same url
		gcTime: 1000 * 60 * 30, // cache for 30 minutes
	}));

	// get waveform data with fallback
	const waveformData = createMemo(() => {
		if (waveformQuery.data) {
			return waveformQuery.data;
		}
		if (waveformQuery.isError) {
			// return fallback waveform on error
			return {
				peaks: Array.from({ length: 200 }, () => Math.random() * 0.8 + 0.2),
				samples: 200,
			};
		}
		return null;
	});

	const isLoading = createMemo(
		() => waveformQuery.isLoading || waveformQuery.isFetching,
	);

	// resize observer for canvas
	onMount(() => {
		if (!containerRef) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setCanvasWidth(entry.contentRect.width);
			}
		});

		observer.observe(containerRef);
		onCleanup(() => observer.disconnect());
	});

	// draw waveform
	createEffect(() => {
		const data = waveformData();
		const canvas = canvasRef;
		if (!data || !canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const width = canvasWidth();
		const height = 80;
		const progress = duration() > 0 ? currentTime() / duration() : 0;

		// set canvas size
		canvas.width = width * window.devicePixelRatio;
		canvas.height = height * window.devicePixelRatio;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

		// clear
		ctx.clearRect(0, 0, width, height);

		const barWidth = width / data.peaks.length;
		const barGap = 1;

		data.peaks.forEach((peak, i) => {
			const x = i * barWidth;
			const barHeight = peak * (height - 10);
			const y = (height - barHeight) / 2;

			// determine if this bar is before or after progress
			const barProgress = (i + 0.5) / data.peaks.length;
			const isPlayed = barProgress <= progress;

			// played gradient: violet to indigo
			// unplayed: slate gray
			if (isPlayed) {
				const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
				gradient.addColorStop(0, "#8b5cf6");
				gradient.addColorStop(1, "#6366f1");
				ctx.fillStyle = gradient;
			} else {
				ctx.fillStyle = "#57534e"; // stone-600
			}

			ctx.beginPath();
			ctx.roundRect(x + barGap / 2, y, barWidth - barGap, barHeight, 2);
			ctx.fill();
		});
	});

	// create queue track object
	const createQueueTrack = (): QueueTrack => ({
		id: props.trackId,
		versionId: props.versionId,
		title: props.title,
		artist: props.artist,
		streamUrl: props.streamUrl!,
		albumArtUrl: props.albumArtUrl,
		duration: props.duration,
	});

	const togglePlay = () => {
		if (!props.streamUrl) return;

		if (isCurrentTrack()) {
			// toggle play/pause on global player
			player.togglePlayPause();
		} else {
			// start playing this track
			player.play(createQueueTrack());
			props.onPlay?.();
		}
	};

	const toggleMute = () => {
		const audio = player.audioRef();
		if (!audio) return;
		audio.muted = !audio.muted;
		setIsMuted(audio.muted);
	};

	const seek = (e: MouseEvent) => {
		if (!canvasRef || !duration()) return;

		const rect = canvasRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = x / rect.width;

		if (isCurrentTrack()) {
			player.seekPercent(percentage);
		} else {
			// start playing from this position
			const track = createQueueTrack();
			player.play(track);
			// seek after a small delay to ensure audio is loaded
			setTimeout(() => {
				player.seekPercent(percentage);
			}, 100);
			props.onPlay?.();
		}
	};

	const addToQueue = () => {
		if (!props.streamUrl) return;
		player.addToQueue(createQueueTrack());
		toast.success("Added to queue", {
			description: props.title,
		});
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div class="bg-stone-900/50 backdrop-blur-sm rounded-xl p-4 transition-all duration-300">
			<div class="flex items-center gap-4">
				{/* play button */}
				<button
					type="button"
					onClick={togglePlay}
					disabled={!props.streamUrl}
					class="w-12 h-12 flex items-center justify-center bg-linear-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-full text-white transition-all duration-200 shadow-lg shadow-violet-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
				>
					<Show when={isPlaying()} fallback={<Play class="w-5 h-5 ml-0.5" />}>
						<Pause class="w-5 h-5" />
					</Show>
				</button>

				{/* track info and waveform */}
				<div class="flex-1 min-w-0" ref={containerRef}>
					<Show when={!props.hideTitle}>
						<div class="flex items-baseline gap-2 mb-2">
							<span class="text-white font-medium truncate">{props.title}</span>
							<span class="text-sm truncate opacity-70">{props.artist}</span>
						</div>
					</Show>

					{/* waveform canvas */}
					<div class="relative cursor-pointer" onClick={seek}>
						<Show
							when={!isLoading() && waveformData()}
							fallback={
								<Show
									when={props.streamUrl === null}
									fallback={
										<div class="h-20 bg-stone-800/50 rounded animate-pulse flex items-center justify-center">
											<span class="text-xs opacity-50">
												Computing waveform...
											</span>
										</div>
									}
								>
									<div class="h-20 bg-stone-800/30 rounded flex items-center justify-center">
										<p class="text-xs opacity-50">No audio available</p>
									</div>
								</Show>
							}
						>
							<canvas ref={canvasRef} class="w-full rounded" />
						</Show>
					</div>

					{/* time display */}
					<div class="flex justify-between text-xs opacity-50 mt-1">
						<span>{formatTime(currentTime())}</span>
						<span>{formatTime(duration())}</span>
					</div>
				</div>

				{/* action buttons */}
				<div class="flex flex-col gap-1">
					{/* add to queue button */}
					<button
						type="button"
						onClick={addToQueue}
						disabled={!props.streamUrl}
						class="p-2 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
						title="Add to queue"
					>
						<ListPlus class="w-5 h-5" />
					</button>

					{/* volume button */}
					<button
						type="button"
						onClick={toggleMute}
						class="p-2 opacity-70 hover:opacity-100 transition-opacity"
					>
						<Show when={isMuted()} fallback={<Volume2 class="w-5 h-5" />}>
							<VolumeX class="w-5 h-5" />
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};

export const WaveformPlayer = (props: WaveformPlayerProps) => {
	return (
		<ClientOnly>
			<WaveformPlayerInner {...props} />
		</ClientOnly>
	);
};
