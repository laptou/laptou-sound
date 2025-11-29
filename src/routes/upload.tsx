// upload page - create new tracks (uploader+ only)
import { createFileRoute, redirect, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show, createEffect } from "solid-js";
import { Upload, Music, X, CheckCircle2, AlertCircle, FileAudio } from "lucide-solid";
import { getSession } from "../lib/server/auth";
import { createNewTrack, uploadTrackVersion, queueAudioProcessing } from "../lib/server/tracks";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [{ title: "Upload - laptou sound" }],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user) {
      throw redirect({ to: "/auth/login" });
    }
    if (session.role !== "uploader" && session.role !== "admin") {
      throw redirect({ to: "/" });
    }
    return { session };
  },
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const context = Route.useRouteContext();

  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [file, setFile] = createSignal<File | null>(null);
  const [coverFile, setCoverFile] = createSignal<File | null>(null);
  const [coverPreview, setCoverPreview] = createSignal<string | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [uploadState, setUploadState] = createSignal<
    "idle" | "uploading" | "processing" | "complete" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  // handle cover preview
  createEffect(() => {
    const cover = coverFile();
    if (cover) {
      const url = URL.createObjectURL(cover);
      setCoverPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCoverPreview(null);
    }
  });

  // drag and drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer?.files[0];
    if (droppedFile && isAudioFile(droppedFile)) {
      setFile(droppedFile);
      if (!title()) {
        // auto-fill title from filename
        setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const selectedFile = input.files?.[0];
    if (selectedFile && isAudioFile(selectedFile)) {
      setFile(selectedFile);
      if (!title()) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleCoverSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const selectedFile = input.files?.[0];
    if (selectedFile && isImageFile(selectedFile)) {
      setCoverFile(selectedFile);
    }
  };

  const isAudioFile = (f: File) => {
    return f.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|ogg|aiff|aif)$/i.test(f.name);
  };

  const isImageFile = (f: File) => {
    return f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearFile = () => {
    setFile(null);
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!file() || !title().trim()) return;

    setUploadState("uploading");
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      // 1. create the track record
      const track = await createNewTrack({
        data: {
          title: title().trim(),
          description: description().trim() || undefined,
        },
      });

      setUploadProgress(20);

      // 2. create version and get upload key
      const { version, uploadKey } = await uploadTrackVersion({
        data: {
          trackId: track.id,
          filename: file()!.name,
          contentType: file()!.type || "audio/mpeg",
        },
      });

      setUploadProgress(30);

      // 3. upload the file
      const fileBuffer = await file()!.arrayBuffer();
      const uploadRes = await fetch(`/api/upload?key=${encodeURIComponent(uploadKey)}`, {
        method: "POST",
        headers: {
          "Content-Type": file()!.type || "audio/mpeg",
        },
        body: fileBuffer,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      setUploadProgress(70);

      // 4. upload cover if provided
      if (coverFile()) {
        const coverBuffer = await coverFile()!.arrayBuffer();
        const coverKey = `covers/${track.id}/${coverFile()!.name}`;
        
        await fetch(`/api/upload?key=${encodeURIComponent(coverKey)}`, {
          method: "POST",
          headers: {
            "Content-Type": coverFile()!.type || "image/jpeg",
          },
          body: coverBuffer,
        });
      }

      setUploadProgress(85);

      // 5. queue for processing
      setUploadState("processing");
      await queueAudioProcessing({
        data: {
          trackId: track.id,
          versionId: version.id,
        },
      });

      setUploadProgress(100);
      setUploadState("complete");

      // redirect to track page after short delay
      setTimeout(() => {
        navigate({ to: `/track/${track.id}` });
      }, 1500);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadState("error");
      setErrorMessage(err.message || "Failed to upload track");
    }
  };

  return (
    <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div class="animate-fade-in-up">
        <h1 class="text-title mb-2">Upload a track</h1>
        <p class="text-small mb-8">Share your music with the community</p>

        {/* upload state feedback */}
        <Show when={uploadState() !== "idle"}>
          <div
            class={`card p-6 mb-6 ${
              uploadState() === "error"
                ? "border-red-500"
                : uploadState() === "complete"
                ? "border-green-500"
                : "border-accent-500"
            }`}
          >
            <Show when={uploadState() === "uploading" || uploadState() === "processing"}>
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-accent-100 dark:bg-accent-900 flex items-center justify-center">
                  <Upload class="w-6 h-6 text-accent-500 animate-bounce-soft" />
                </div>
                <div class="flex-1">
                  <p class="font-medium">
                    {uploadState() === "uploading" ? "Uploading..." : "Processing..."}
                  </p>
                  <div class="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full mt-2 overflow-hidden">
                    <div
                      class="h-full bg-accent-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress()}%` }}
                    />
                  </div>
                </div>
              </div>
            </Show>

            <Show when={uploadState() === "complete"}>
              <div class="flex items-center gap-4 text-green-600 dark:text-green-400">
                <CheckCircle2 class="w-8 h-8" />
                <div>
                  <p class="font-medium">Upload complete!</p>
                  <p class="text-sm opacity-80">Redirecting to your track...</p>
                </div>
              </div>
            </Show>

            <Show when={uploadState() === "error"}>
              <div class="flex items-center gap-4 text-red-600 dark:text-red-400">
                <AlertCircle class="w-8 h-8" />
                <div>
                  <p class="font-medium">Upload failed</p>
                  <p class="text-sm opacity-80">{errorMessage()}</p>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* upload form */}
        <form onSubmit={handleSubmit} class="space-y-6">
          {/* file drop zone */}
          <div>
            <label class="block text-sm font-medium mb-2">Audio file</label>
            <Show
              when={file()}
              fallback={
                <div
                  class={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                    isDragging()
                      ? "border-accent-500 bg-accent-50 dark:bg-accent-950"
                      : "border-surface-300 dark:border-surface-700 hover:border-accent-400"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div class="flex flex-col items-center gap-4">
                    <div class="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                      <FileAudio class="w-8 h-8 text-surface-400" />
                    </div>
                    <div>
                      <p class="font-medium mb-1">Drag and drop your audio file</p>
                      <p class="text-small">or click to browse</p>
                    </div>
                    <label class="btn-secondary cursor-pointer">
                      <Upload class="w-4 h-4" />
                      Choose file
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif"
                        onChange={handleFileSelect}
                        class="hidden"
                      />
                    </label>
                    <p class="text-xs text-surface-400">
                      MP3, WAV, FLAC, M4A, OGG, AIFF • Max 500MB
                    </p>
                  </div>
                </div>
              }
            >
              <div class="card p-4 flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900 flex items-center justify-center flex-shrink-0">
                  <Music class="w-6 h-6 text-accent-600 dark:text-accent-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{file()!.name}</p>
                  <p class="text-small">{formatFileSize(file()!.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  class="btn-icon btn-ghost text-surface-400 hover:text-red-500"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </Show>
          </div>

          {/* cover art */}
          <div>
            <label class="block text-sm font-medium mb-2">
              Cover art <span class="text-surface-400 font-normal">(optional)</span>
            </label>
            <Show
              when={coverFile()}
              fallback={
                <label class="flex items-center gap-4 p-4 border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl cursor-pointer hover:border-accent-400 transition-colors">
                  <div class="w-16 h-16 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                    <Music class="w-6 h-6 text-surface-400" />
                  </div>
                  <div>
                    <p class="text-sm font-medium">Add cover image</p>
                    <p class="text-xs text-surface-400">JPG, PNG, or WebP • 1:1 ratio recommended</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={handleCoverSelect}
                    class="hidden"
                  />
                </label>
              }
            >
              <div class="card p-4 flex items-center gap-4">
                <img
                  src={coverPreview()!}
                  alt="Cover preview"
                  class="w-16 h-16 rounded-xl object-cover"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{coverFile()!.name}</p>
                  <p class="text-small">{formatFileSize(coverFile()!.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearCover}
                  class="btn-icon btn-ghost text-surface-400 hover:text-red-500"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </Show>
          </div>

          {/* title */}
          <div>
            <label for="title" class="block text-sm font-medium mb-2">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              class="input"
              placeholder="Track title"
              required
              maxLength={100}
            />
          </div>

          {/* description */}
          <div>
            <label for="description" class="block text-sm font-medium mb-2">
              Description <span class="text-surface-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              class="input resize-none h-24"
              placeholder="Add a description..."
              maxLength={500}
            />
          </div>

          {/* submit */}
          <button
            type="submit"
            class="btn-primary w-full"
            disabled={!file() || !title().trim() || uploadState() !== "idle"}
          >
            <Upload class="w-4 h-4" />
            Upload track
          </button>
        </form>
      </div>
    </div>
  );
}

