// placeholder waveform api - returns generated waveform for tracks without one
import { createAPIFileRoute } from "@tanstack/solid-start/api";

export const APIRoute = createAPIFileRoute("/api/waveform/placeholder")({
	GET: async () => {
		// generate plausible waveform shape
		const peakCount = 150;
		const peaks: number[] = [];

		for (let i = 0; i < peakCount; i++) {
			const base = 0.3 + Math.random() * 0.2;
			const hasPeak = Math.random() > 0.7;
			const peakBoost = hasPeak ? Math.random() * 0.4 : 0;
			const envelope = Math.sin((i / peakCount) * Math.PI) * 0.2;
			const value = Math.min(1, Math.max(0.1, base + peakBoost + envelope));
			peaks.push(value);
		}

		// normalize
		const max = Math.max(...peaks);
		const normalizedPeaks = peaks.map((p) => p / max);

		return Response.json({
			peaks: normalizedPeaks,
			duration: 180, // default 3 minutes
			samplesPerPeak: (44100 * 180) / peakCount,
		});
	},
});
