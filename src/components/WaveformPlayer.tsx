// waveform audio player component
// displays a soundcloud-style waveform with playback controls
// waveform is computed client-side using web audio api

import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
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
	title: string;
	artist: string;
	duration?: number;
	onPlay?: () => void;
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
	let audioRef: HTMLAudioElement | undefined;
	let canvasRef: HTMLCanvasElement | undefined;
	let containerRef: HTMLDivElement | undefined;

	const [isPlaying, setIsPlaying] = createSignal(false);
	const [isMuted, setIsMuted] = createSignal(false);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(props.duration ?? 0);
	const [canvasWidth, setCanvasWidth] = createSignal(600);

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

		if (audio.duration) {
			setDuration(audio.duration || 0);
		} else {
			audio.addEventListener(
				"loadedmetadata",
				() => setDuration(audio.duration || 0),
				{ once: true },
			);
		}

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
		<div class="bg-stone-900/50 backdrop-blur-sm rounded-xl p-4 transition-all duration-300">
			<Show when={props.streamUrl !== null}>
				<audio
					ref={audioRef}
					src={props.streamUrl ?? undefined}
					preload="metadata"
				/>
			</Show>

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
					<div class="flex items-baseline gap-2 mb-2">
						<span class="text-white font-medium truncate">{props.title}</span>
						<span class="text-sm truncate opacity-70">{props.artist}</span>
					</div>

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
	);
};

export const WaveformPlayer = (props: WaveformPlayerProps) => {
	return (
		<ClientOnly>
			<WaveformPlayerInner {...props} />
		</ClientOnly>
	);
};
