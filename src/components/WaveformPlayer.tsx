// waveform audio player component
// displays a soundcloud-style waveform with playback controls

import { useQuery } from "@tanstack/solid-query";
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

interface WaveformData {
	peaks: number[];
	samples: number;
}

interface WaveformPlayerProps {
	streamUrl: string | null;
	waveformUrl: string | null;
	title: string;
	artist: string;
	duration?: number;
	onPlay?: () => void;
}

export const WaveformPlayer: Component<WaveformPlayerProps> = (props) => {
	let audioRef: HTMLAudioElement | undefined;
	let canvasRef: HTMLCanvasElement | undefined;
	let containerRef: HTMLDivElement | undefined;

	const [isPlaying, setIsPlaying] = createSignal(false);
	const [isMuted, setIsMuted] = createSignal(false);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(props.duration ?? 0);
	const [canvasWidth, setCanvasWidth] = createSignal(600);

	// load waveform data using tanstack query
	const waveformQuery = useQuery(() => ({
		queryKey: ["waveform", props.waveformUrl],
		queryFn: async (): Promise<WaveformData> => {
			if (!props.waveformUrl) {
				throw new Error("No waveform URL provided");
			}
			const response = await fetch(props.waveformUrl);
			if (!response.ok) {
				throw new Error("Failed to load waveform");
			}
			return response.json();
		},
		enabled: !!props.waveformUrl && props.waveformUrl !== null,
		retry: 1,
		// generate fallback waveform on error
		placeholderData: () => ({
			peaks: Array.from({ length: 200 }, () => Math.random() * 0.8 + 0.2),
			samples: 200,
		}),
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

	const isLoading = createMemo(() => waveformQuery.isLoading || waveformQuery.isFetching);

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
				ctx.fillStyle = "#475569";
			}

			ctx.beginPath();
			ctx.roundRect(x + barGap / 2, y, barWidth - barGap, barHeight, 2);
			ctx.fill();
		});
	});

	// audio event handlers
	createEffect(() => {
		const audio = audioRef;
		if (!audio) return;

		const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
		const handleDurationChange = () => setDuration(audio.duration || 0);
		const handleEnded = () => setIsPlaying(false);
		const handlePlay = () => {
			setIsPlaying(true);
			props.onPlay?.();
		};
		const handlePause = () => setIsPlaying(false);

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("durationchange", handleDurationChange);
		audio.addEventListener("ended", handleEnded);
		audio.addEventListener("play", handlePlay);
		audio.addEventListener("pause", handlePause);

		onCleanup(() => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("durationchange", handleDurationChange);
			audio.removeEventListener("ended", handleEnded);
			audio.removeEventListener("play", handlePlay);
			audio.removeEventListener("pause", handlePause);
		});
	});

	const togglePlay = () => {
		if (!audioRef || !props.streamUrl) return;
		if (isPlaying()) {
			audioRef.pause();
		} else {
			audioRef.play().catch((error) => {
				console.error("Failed to play audio:", error);
			});
		}
	};

	const toggleMute = () => {
		if (!audioRef) return;
		audioRef.muted = !audioRef.muted;
		setIsMuted(audioRef.muted);
	};

	const seek = (e: MouseEvent) => {
		if (!canvasRef || !audioRef || !duration()) return;

		const rect = canvasRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = x / rect.width;
		audioRef.currentTime = percentage * duration();
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 hover:border-violet-500/30 transition-all duration-300">
			<Show when={props.streamUrl !== null}>
				<audio ref={audioRef} src={props.streamUrl ?? undefined} preload="metadata" />
			</Show>

			{/* debug info */}
			<div class="mb-4 bg-slate-900/50 border border-slate-700 rounded p-2 text-xs">
				<div class="text-gray-400 mb-1 font-medium">Debug Info (WaveformPlayer)</div>
				<div class="space-y-1 text-gray-500 font-mono">
					<div>streamUrl: {props.streamUrl ?? "null"}</div>
					<div>waveformUrl: {props.waveformUrl ?? "null"}</div>
					<div>title: {props.title}</div>
					<div>artist: {props.artist}</div>
					<div>duration: {props.duration ?? "undefined"}</div>
					<div>waveformQuery.enabled: {!!props.waveformUrl && props.waveformUrl !== null ? "true" : "false"}</div>
					<div>waveformQuery.isLoading: {waveformQuery.isLoading ? "true" : "false"}</div>
					<div>waveformQuery.isError: {waveformQuery.isError ? "true" : "false"}</div>
				</div>
			</div>

			<div class="flex items-center gap-4">
				{/* play button */}
				<button
					type="button"
					onClick={togglePlay}
					disabled={!props.streamUrl}
					class="w-12 h-12 flex items-center justify-center bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 rounded-full text-white transition-all duration-200 shadow-lg shadow-violet-500/25 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
				>
					<Show when={isPlaying()} fallback={<Play class="w-5 h-5 ml-0.5" />}>
						<Pause class="w-5 h-5" />
					</Show>
				</button>

				{/* track info and waveform */}
				<div class="flex-1 min-w-0" ref={containerRef}>
					<div class="flex items-baseline gap-2 mb-2">
						<span class="text-white font-medium truncate">{props.title}</span>
						<span class="text-gray-400 text-sm truncate">{props.artist}</span>
					</div>

					{/* waveform canvas */}
					<div class="relative cursor-pointer" onClick={seek}>
						<Show
							when={props.waveformUrl !== null && !isLoading()}
							fallback={
								<Show
									when={props.waveformUrl === null}
									fallback={
										<div class="h-20 bg-slate-700/50 rounded animate-pulse" />
									}
								>
									<div class="h-20 bg-slate-800/50 rounded flex items-center justify-center">
										<p class="text-gray-500 text-xs">No waveform data available</p>
									</div>
								</Show>
							}
						>
							<canvas ref={canvasRef} class="w-full rounded" />
						</Show>
					</div>

					{/* time display */}
					<div class="flex justify-between text-xs text-gray-400 mt-1">
						<span>{formatTime(currentTime())}</span>
						<span>{formatTime(duration())}</span>
					</div>
				</div>

				{/* volume button */}
				<button
					type="button"
					onClick={toggleMute}
					class="p-2 text-gray-400 hover:text-white transition-colors"
				>
					<Show when={isMuted()} fallback={<Volume2 class="w-5 h-5" />}>
						<VolumeX class="w-5 h-5" />
					</Show>
				</button>
			</div>
		</div>
	);
};

export default WaveformPlayer;
