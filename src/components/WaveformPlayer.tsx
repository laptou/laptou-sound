// soundcloud-style waveform audio player
import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-solid";

interface WaveformData {
  peaks: number[];
  duration: number;
}

interface Props {
  audioUrl: string;
  waveformUrl: string;
  onPlay?: () => void;
  onEnded?: () => void;
  initialTime?: number;
}

export default function WaveformPlayer(props: Props) {
  let audioRef: HTMLAudioElement | undefined;
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(1);
  const [isMuted, setIsMuted] = createSignal(false);
  const [peaks, setPeaks] = createSignal<number[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isDragging, setIsDragging] = createSignal(false);

  // load waveform data
  onMount(async () => {
    try {
      const res = await fetch(props.waveformUrl);
      const data: WaveformData = await res.json();
      setPeaks(data.peaks);
      if (data.duration) setDuration(data.duration);
    } catch (e) {
      console.error("Failed to load waveform:", e);
      // generate placeholder peaks
      setPeaks(Array(100).fill(0).map(() => Math.random() * 0.5 + 0.2));
    }
    setIsLoading(false);
  });

  // audio event handlers
  createEffect(() => {
    if (!audioRef) return;

    const handleTimeUpdate = () => {
      if (!isDragging()) {
        setCurrentTime(audioRef!.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audioRef!.duration);
      if (props.initialTime) {
        audioRef!.currentTime = props.initialTime;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      props.onEnded?.();
    };

    audioRef.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.addEventListener("ended", handleEnded);

    onCleanup(() => {
      audioRef?.removeEventListener("timeupdate", handleTimeUpdate);
      audioRef?.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef?.removeEventListener("ended", handleEnded);
    });
  });

  // draw waveform
  createEffect(() => {
    if (!canvasRef || peaks().length === 0) return;

    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvasRef.getBoundingClientRect();

    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const { width, height } = rect;
    const peakData = peaks();
    const barWidth = width / peakData.length;
    const progress = duration() > 0 ? currentTime() / duration() : 0;
    const playedBars = Math.floor(progress * peakData.length);

    ctx.clearRect(0, 0, width, height);

    // get computed styles for colors
    const computedStyle = getComputedStyle(canvasRef);
    const playedColor = computedStyle.getPropertyValue("--color-accent-500").trim() || "#3b82f6";
    const unplayedColor = computedStyle.getPropertyValue("--color-accent-200").trim() || "#93c5fd";

    peakData.forEach((peak, i) => {
      const barHeight = peak * height * 0.85;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = i < playedBars ? playedColor : unplayedColor;

      // rounded bar
      const radius = Math.min(barWidth / 2, 2);
      ctx.beginPath();
      ctx.roundRect(x + 1, y, barWidth - 2, barHeight, radius);
      ctx.fill();
    });
  });

  // handle resize
  onMount(() => {
    const handleResize = () => {
      // trigger redraw
      setPeaks([...peaks()]);
    };

    window.addEventListener("resize", handleResize);
    onCleanup(() => window.removeEventListener("resize", handleResize));
  });

  // playback controls
  const togglePlay = () => {
    if (!audioRef) return;

    if (isPlaying()) {
      audioRef.pause();
      setIsPlaying(false);
    } else {
      audioRef.play();
      setIsPlaying(true);
      props.onPlay?.();
    }
  };

  const toggleMute = () => {
    if (!audioRef) return;
    const newMuted = !isMuted();
    setIsMuted(newMuted);
    audioRef.muted = newMuted;
  };

  const handleVolumeChange = (e: InputEvent) => {
    if (!audioRef) return;
    const value = parseFloat((e.target as HTMLInputElement).value);
    setVolume(value);
    audioRef.volume = value;
    setIsMuted(value === 0);
  };

  const seek = (e: MouseEvent) => {
    if (!containerRef || !audioRef) return;
    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    const time = progress * duration();
    setCurrentTime(time);
    audioRef.currentTime = time;
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    seek(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging()) {
      seek(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // skip forward/back
  const skipBack = () => {
    if (!audioRef) return;
    audioRef.currentTime = Math.max(0, audioRef.currentTime - 10);
  };

  const skipForward = () => {
    if (!audioRef) return;
    audioRef.currentTime = Math.min(duration(), audioRef.currentTime + 10);
  };

  return (
    <div class="card p-4">
      <audio
        ref={audioRef}
        src={props.audioUrl}
        preload="metadata"
        class="hidden"
      />

      {/* waveform */}
      <div
        ref={containerRef}
        class="relative h-20 cursor-pointer rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Show
          when={!isLoading()}
          fallback={
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="flex gap-1">
                {Array(20).fill(0).map((_, i) => (
                  <div
                    class="w-1 bg-accent-300 dark:bg-accent-700 rounded-full animate-waveform-bar"
                    style={{
                      height: `${20 + Math.random() * 40}px`,
                      "animation-delay": `${i * 50}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          }
        >
          <canvas
            ref={canvasRef}
            class="absolute inset-0 w-full h-full"
            style={{
              "--color-accent-500": "oklch(55% 0.16 235)",
              "--color-accent-200": "oklch(88% 0.06 230)",
            }}
          />

          {/* progress overlay */}
          <div
            class="absolute inset-y-0 left-0 bg-accent-500/10 pointer-events-none"
            style={{ width: `${(currentTime() / duration()) * 100}%` }}
          />

          {/* playhead */}
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-accent-500 pointer-events-none"
            style={{
              left: `${(currentTime() / duration()) * 100}%`,
              "box-shadow": "0 0 8px var(--color-accent-500)",
            }}
          />
        </Show>
      </div>

      {/* controls */}
      <div class="flex items-center justify-between mt-4">
        {/* left: time */}
        <div class="text-mono text-small w-24">
          {formatTime(currentTime())} / {formatTime(duration())}
        </div>

        {/* center: playback controls */}
        <div class="flex items-center gap-2">
          <button onClick={skipBack} class="btn-icon btn-ghost" aria-label="Skip back 10 seconds">
            <SkipBack class="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            class="btn-icon bg-accent-500 text-white hover:bg-accent-600 rounded-full w-12 h-12 shadow-glow"
            aria-label={isPlaying() ? "Pause" : "Play"}
          >
            <Show when={isPlaying()} fallback={<Play class="w-5 h-5 ml-0.5" />}>
              <Pause class="w-5 h-5" />
            </Show>
          </button>

          <button onClick={skipForward} class="btn-icon btn-ghost" aria-label="Skip forward 10 seconds">
            <SkipForward class="w-4 h-4" />
          </button>
        </div>

        {/* right: volume */}
        <div class="flex items-center gap-2 w-24 justify-end">
          <button onClick={toggleMute} class="btn-icon btn-ghost" aria-label={isMuted() ? "Unmute" : "Mute"}>
            <Show when={isMuted() || volume() === 0} fallback={<Volume2 class="w-4 h-4" />}>
              <VolumeX class="w-4 h-4" />
            </Show>
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume()}
            onInput={handleVolumeChange}
            class="w-16 h-1 accent-accent-500 cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

