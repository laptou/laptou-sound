// global audio player context
// manages playback state, queue, and audio element across navigations

import {
	type Accessor,
	type Component,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	useContext,
} from "solid-js";

// track info stored in the player
export interface QueueTrack {
	id: string;
	versionId: string;
	title: string;
	artist: string;
	streamUrl: string;
	albumArtUrl?: string | null;
	duration?: number;
}

interface AudioPlayerState {
	// current track
	currentTrack: Accessor<QueueTrack | null>;
	// playback state
	isPlaying: Accessor<boolean>;
	currentTime: Accessor<number>;
	duration: Accessor<number>;
	// queue
	queue: Accessor<QueueTrack[]>;
	// actions
	play: (track: QueueTrack) => void;
	pause: () => void;
	resume: () => void;
	togglePlayPause: () => void;
	seek: (time: number) => void;
	seekPercent: (percent: number) => void;
	// queue actions
	addToQueue: (track: QueueTrack) => void;
	removeFromQueue: (index: number) => void;
	clearQueue: () => void;
	playFromQueue: (index: number) => void;
	skipNext: () => void;
	skipPrevious: () => void;
	// audio element ref (for waveform sync)
	audioRef: Accessor<HTMLAudioElement | null>;
}

const AudioPlayerContext = createContext<AudioPlayerState>();

export const AudioPlayerProvider: Component<{ children: JSX.Element }> = (
	props,
) => {
	let audioElement: HTMLAudioElement | undefined;

	const [audioRef, setAudioRef] = createSignal<HTMLAudioElement | null>(null);
	const [currentTrack, setCurrentTrack] = createSignal<QueueTrack | null>(null);
	const [isPlaying, setIsPlaying] = createSignal(false);
	const [currentTime, setCurrentTime] = createSignal(0);
	const [duration, setDuration] = createSignal(0);
	const [queue, setQueue] = createSignal<QueueTrack[]>([]);

	// setup audio element on mount
	onMount(() => {
		if (import.meta.env.SSR) return;
		
		audioElement = new Audio();
		audioElement.preload = "metadata";
		setAudioRef(audioElement);

		const handleTimeUpdate = () => setCurrentTime(audioElement!.currentTime);
		const handleDurationChange = () => setDuration(audioElement!.duration || 0);
		const handleEnded = () => {
			setIsPlaying(false);
			// auto-play next track in queue
			const q = queue();
			if (q.length > 0) {
				playFromQueue(0);
			}
		};
		const handlePlay = () => setIsPlaying(true);
		const handlePause = () => setIsPlaying(false);
		const handleLoadedMetadata = () => setDuration(audioElement!.duration || 0);

		audioElement.addEventListener("timeupdate", handleTimeUpdate);
		audioElement.addEventListener("durationchange", handleDurationChange);
		audioElement.addEventListener("ended", handleEnded);
		audioElement.addEventListener("play", handlePlay);
		audioElement.addEventListener("pause", handlePause);
		audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);

		onCleanup(() => {
			audioElement!.removeEventListener("timeupdate", handleTimeUpdate);
			audioElement!.removeEventListener("durationchange", handleDurationChange);
			audioElement!.removeEventListener("ended", handleEnded);
			audioElement!.removeEventListener("play", handlePlay);
			audioElement!.removeEventListener("pause", handlePause);
			audioElement!.removeEventListener("loadedmetadata", handleLoadedMetadata);
			audioElement!.pause();
			audioElement!.src = "";
		});
	});

	// play a track immediately
	const play = (track: QueueTrack) => {
		if (!audioElement) return;

		setCurrentTrack(track);
		audioElement.src = track.streamUrl;
		audioElement.play().catch((error) => {
			console.error("failed to play audio:", error);
		});
	};

	const pause = () => {
		audioElement?.pause();
	};

	const resume = () => {
		audioElement?.play().catch((error) => {
			console.error("failed to resume audio:", error);
		});
	};

	const togglePlayPause = () => {
		if (isPlaying()) {
			pause();
		} else {
			resume();
		}
	};

	const seek = (time: number) => {
		if (!audioElement) return;
		audioElement.currentTime = Math.max(0, Math.min(time, duration()));
	};

	const seekPercent = (percent: number) => {
		if (!audioElement || !duration()) return;
		seek(percent * duration());
	};

	// queue management
	const addToQueue = (track: QueueTrack) => {
		setQueue((prev) => [...prev, track]);
	};

	const removeFromQueue = (index: number) => {
		setQueue((prev) => prev.filter((_, i) => i !== index));
	};

	const clearQueue = () => {
		setQueue([]);
	};

	const playFromQueue = (index: number) => {
		const q = queue();
		if (index < 0 || index >= q.length) return;

		const track = q[index];
		// remove from queue and play
		setQueue((prev) => prev.filter((_, i) => i !== index));
		play(track);
	};

	const skipNext = () => {
		const q = queue();
		if (q.length > 0) {
			playFromQueue(0);
		}
	};

	const skipPrevious = () => {
		// for now, just restart current track
		seek(0);
	};

	const state: AudioPlayerState = {
		currentTrack,
		isPlaying,
		currentTime,
		duration,
		queue,
		play,
		pause,
		resume,
		togglePlayPause,
		seek,
		seekPercent,
		addToQueue,
		removeFromQueue,
		clearQueue,
		playFromQueue,
		skipNext,
		skipPrevious,
		audioRef,
	};

	return (
		<AudioPlayerContext.Provider value={state}>
			{props.children}
		</AudioPlayerContext.Provider>
	);
};

export const useAudioPlayer = (): AudioPlayerState => {
	const context = useContext(AudioPlayerContext);
	if (!context) {
		throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
	}
	return context;
};

// helper to check if a track is currently playing
export const useIsTrackPlaying = (trackId: string, versionId: string) => {
	const player = useAudioPlayer();
	return createMemo(() => {
		const current = player.currentTrack();
		return (
			current?.id === trackId &&
			current?.versionId === versionId &&
			player.isPlaying()
		);
	});
};

