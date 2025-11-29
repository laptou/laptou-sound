// cloudflare queue consumer for audio processing
// this worker processes uploaded audio files:
// 1. generates 128kbps mp3 for playback
// 2. generates waveform peaks for visualization
// 3. updates database with results

import type { D1Database, R2Bucket, ExecutionContext, MessageBatch } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../lib/db/schema";
import { updateTrackVersionStatus } from "../lib/db";

// message type from queue
interface AudioProcessingMessage {
  type: "process_audio";
  trackId: string;
  versionId: string;
  originalKey: string;
  targetPlaybackKey: string;
  targetWaveformKey: string;
}

// env bindings
interface Env {
  DB: D1Database;
  R2: R2Bucket;
}

// waveform data structure
interface WaveformData {
  peaks: number[];
  duration: number;
  samplesPerPeak: number;
}

export default {
  // queue consumer handler
  async queue(
    batch: MessageBatch<AudioProcessingMessage>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        console.log(`Processing audio: ${message.body.versionId}`);
        await processAudioMessage(message.body, env);
        message.ack();
        console.log(`Successfully processed: ${message.body.versionId}`);
      } catch (error) {
        console.error(`Processing failed for ${message.body.versionId}:`, error);
        
        // update status to failed using Drizzle
        const db = drizzle(env.DB, { schema });
        await updateTrackVersionStatus(
          db,
          message.body.versionId,
          "failed"
        );
        
        // retry if we haven't exceeded retries
        message.retry();
      }
    }
  },
};

async function processAudioMessage(
  msg: AudioProcessingMessage,
  env: Env
): Promise<void> {
  // create drizzle instance
  const db = drizzle(env.DB, { schema });

  // update status to processing
  await updateTrackVersionStatus(db, msg.versionId, "processing");

  // fetch original file from r2
  const original = await env.R2.get(msg.originalKey);
  if (!original) {
    throw new Error(`Original file not found: ${msg.originalKey}`);
  }

  const audioData = await original.arrayBuffer();

  // note: actual ffmpeg processing would require either:
  // 1. ffmpeg wasm (limited in workers due to cpu/memory)
  // 2. external processing service
  // 3. cloudflare workers for platforms with larger limits
  //
  // for now, we'll create a placeholder implementation that:
  // - copies the original as the playback file (in production, transcode to 128kbps mp3)
  // - generates simulated waveform data

  // store "processed" playback file (in production: transcode with ffmpeg)
  // for demo purposes, we'll just copy the original
  await env.R2.put(msg.targetPlaybackKey, audioData, {
    httpMetadata: {
      contentType: "audio/mpeg",
    },
  });

  // generate waveform data
  // in production, this would analyze the actual audio
  // for now, generate plausible random peaks
  const waveformData = generateSimulatedWaveform(audioData.byteLength);

  await env.R2.put(msg.targetWaveformKey, JSON.stringify(waveformData), {
    httpMetadata: {
      contentType: "application/json",
    },
  });

  // estimate duration based on file size (very rough estimate)
  // in production, extract actual duration from audio metadata
  const estimatedDuration = estimateDuration(audioData.byteLength);

  // update database with results using Drizzle
  await updateTrackVersionStatus(
    db,
    msg.versionId,
    "complete",
    msg.targetPlaybackKey,
    msg.targetWaveformKey,
    Math.round(estimatedDuration)
  );
}

// generate simulated waveform peaks
// in production, this would analyze actual audio samples
function generateSimulatedWaveform(fileSize: number): WaveformData {
  const peakCount = 150; // number of bars in waveform
  const peaks: number[] = [];

  // generate plausible waveform shape
  // real audio has varying dynamics - simulate this
  for (let i = 0; i < peakCount; i++) {
    // base level with some variation
    const base = 0.3 + Math.random() * 0.2;
    
    // add occasional peaks (like beats/transients)
    const hasPeak = Math.random() > 0.7;
    const peakBoost = hasPeak ? Math.random() * 0.4 : 0;
    
    // add some smooth envelope variation
    const envelope = Math.sin((i / peakCount) * Math.PI) * 0.2;
    
    const value = Math.min(1, Math.max(0.1, base + peakBoost + envelope));
    peaks.push(value);
  }

  // normalize so max is close to 1
  const max = Math.max(...peaks);
  const normalizedPeaks = peaks.map(p => p / max);

  const estimatedDuration = estimateDuration(fileSize);

  return {
    peaks: normalizedPeaks,
    duration: estimatedDuration,
    samplesPerPeak: Math.round((estimatedDuration * 44100) / peakCount),
  };
}

// rough duration estimate based on file size
// assumes ~128kbps mp3 (16KB per second)
function estimateDuration(fileSize: number): number {
  const bytesPerSecond = 16000; // ~128kbps
  return fileSize / bytesPerSecond;
}

// placeholder for actual ffmpeg transcoding
// this would use @ffmpeg/ffmpeg in a larger worker or external service
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function transcodeToMp3(input: ArrayBuffer): Promise<ArrayBuffer> {
  // in production:
  // const ffmpeg = new FFmpeg();
  // await ffmpeg.load();
  // await ffmpeg.writeFile("input", new Uint8Array(input));
  // await ffmpeg.exec([
  //   "-i", "input",
  //   "-codec:a", "libmp3lame",
  //   "-b:a", "128k",
  //   "-ar", "44100",
  //   "output.mp3"
  // ]);
  // const output = await ffmpeg.readFile("output.mp3");
  // return output.buffer;
  
  // for now, return input unchanged
  return input;
}

// placeholder for actual waveform analysis
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function analyzeWaveform(audioData: ArrayBuffer): Promise<WaveformData> {
  // in production, decode audio and analyze samples:
  // const audioContext = new AudioContext();
  // const decoded = await audioContext.decodeAudioData(audioData);
  // const samples = decoded.getChannelData(0);
  // ... analyze samples to extract peaks
  
  return generateSimulatedWaveform(audioData.byteLength);
}

