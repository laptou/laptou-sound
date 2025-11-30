// upload page for creating new tracks

import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { Callout, CalloutContent } from "@ui/callout";
import { Label } from "@ui/label";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "@ui/text-field";
import { Music, Upload, X } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { AccessDeniedError } from "@/lib/errors";
import { hasRole } from "@/server/auth";
import { createTrack } from "@/server/tracks";

export const Route = createFileRoute("/_authed/upload")({
	beforeLoad: async ({ context }) => {
		// check if user has uploader role
		if (!hasRole(context.user?.role as string, "uploader")) {
			throw new AccessDeniedError(
				"You need uploader permissions to upload tracks",
			);
		}
	},
	component: UploadPage,
});

function UploadPage() {
	const navigate = useNavigate();
	const [title, setTitle] = createSignal("");
	const [description, setDescription] = createSignal("");
	const [isPublic, setIsPublic] = createSignal(true);
	const [allowDownload, setAllowDownload] = createSignal(false);
	const [file, setFile] = createSignal<File | null>(null);
	const [error, setError] = createSignal<string | null>(null);
	const [isUploading, setIsUploading] = createSignal(false);
	const [uploadProgress, setUploadProgress] = createSignal(0);

	const handleFileSelect = (e: Event) => {
		const input = e.target as HTMLInputElement;
		const selectedFile = input.files?.[0];

		if (selectedFile) {
			// validate file type
			if (!selectedFile.type.startsWith("audio/")) {
				setError("Please select an audio file");
				return;
			}

			// validate file size (100MB max)
			if (selectedFile.size > 100 * 1024 * 1024) {
				setError("File size must be less than 100MB");
				return;
			}

			setFile(selectedFile);
			setError(null);

			// auto-fill title if empty
			if (!title()) {
				const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
				setTitle(fileName);
			}
		}
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		const droppedFile = e.dataTransfer?.files[0];

		if (droppedFile) {
			if (!droppedFile.type.startsWith("audio/")) {
				setError("Please drop an audio file");
				return;
			}

			setFile(droppedFile);
			setError(null);

			if (!title()) {
				const fileName = droppedFile.name.replace(/\.[^/.]+$/, "");
				setTitle(fileName);
			}
		}
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setError(null);

		if (!file()) {
			setError("Please select a file to upload");
			return;
		}

		if (!title().trim()) {
			setError("Please enter a title");
			return;
		}

		setIsUploading(true);
		setUploadProgress(10);

		try {
			// create track metadata
			const { id: trackId } = await createTrack({
				data: {
					title: title().trim(),
					description: description().trim() || undefined,
					isPublic: isPublic(),
					allowDownload: allowDownload(),
				},
			});

			setUploadProgress(30);

			// upload file
			const formData = new FormData();
			formData.append("file", file()!);
			formData.append("trackId", trackId);

			const response = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				throw new Error("Upload failed");
			}

			setUploadProgress(100);

			// redirect to track page
			navigate({ to: `/track/${trackId}` });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	};

	const removeFile = () => {
		setFile(null);
	};

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div class="max-w-2xl mx-auto">
				<div class="text-center mb-8">
					<h1 class="text-3xl font-bold text-white mb-2">Upload Track</h1>
					<p class="text-gray-400">Share your music with the community</p>
				</div>

				<Show when={error()}>
					{(err) => (
						<Callout variant="error" class="mb-6">
							<CalloutContent>
								<p class="text-center">{err()}</p>
							</CalloutContent>
						</Callout>
					)}
				</Show>

				<form onSubmit={handleSubmit} class="space-y-6">
					{/* file drop zone */}
					<div
						onDrop={handleDrop}
						onDragOver={(e) => e.preventDefault()}
						class={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
							file()
								? "border-violet-500 bg-violet-500/10"
								: "border-slate-600 hover:border-slate-500"
						}`}
					>
						<Show
							when={file()}
							fallback={
								<>
									<Upload class="w-12 h-12 text-gray-400 mx-auto mb-4" />
									<p class="text-white font-medium mb-2">
										Drop your audio file here
									</p>
									<p class="text-gray-400 text-sm mb-4">
										or click to browse (MP3, WAV, FLAC up to 100MB)
									</p>
									<input
										type="file"
										accept="audio/*"
										onChange={handleFileSelect}
										class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
									/>
								</>
							}
						>
							{(f) => (
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center">
											<Music class="w-6 h-6 text-violet-400" />
										</div>
										<div class="text-left">
											<p class="text-white font-medium">{f()?.name}</p>
											<p class="text-gray-400 text-sm">
												{(f()?.size / (1024 * 1024)).toFixed(2)} MB
											</p>
										</div>
									</div>
									<Button
										type="button"
										onClick={removeFile}
										variant="ghost"
										size="icon"
										class="p-2 text-gray-400 hover:text-white"
									>
										<X class="w-5 h-5" />
									</Button>
								</div>
							)}
						</Show>
					</div>

					{/* title */}
					<TextField value={title()} onChange={setTitle} required>
						<TextFieldLabel for="title">Title *</TextFieldLabel>
						<TextFieldInput
							id="title"
							type="text"
							placeholder="Enter track title"
						/>
					</TextField>

					{/* description */}
					<TextField value={description()} onChange={setDescription}>
						<TextFieldLabel for="description">Description</TextFieldLabel>
						<TextFieldTextArea
							id="description"
							rows={3}
							placeholder="Add a description (optional)"
							class="resize-none"
						/>
					</TextField>

					{/* options */}
					<div class="space-y-4">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={isPublic()}
								onChange={(e) => setIsPublic(e.currentTarget.checked)}
								class="w-5 h-5 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500"
							/>
							<div>
								<Label class="text-white font-medium">Public</Label>
								<p class="text-gray-400 text-sm">Anyone can see this track</p>
							</div>
						</label>

						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								checked={allowDownload()}
								onChange={(e) => setAllowDownload(e.currentTarget.checked)}
								class="w-5 h-5 rounded border-slate-600 bg-slate-700 text-violet-500 focus:ring-violet-500"
							/>
							<div>
								<Label class="text-white font-medium">Allow Downloads</Label>
								<p class="text-gray-400 text-sm">
									Let others download the original file
								</p>
							</div>
						</label>
					</div>

					{/* upload progress */}
					<Show when={isUploading()}>
						<div class="bg-slate-700/50 rounded-lg p-4">
							<div class="flex justify-between text-sm mb-2">
								<span class="text-gray-300">Uploading...</span>
								<span class="text-gray-400">{uploadProgress()}%</span>
							</div>
							<div class="h-2 bg-slate-600 rounded-full overflow-hidden">
								<div
									class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
									style={{ width: `${uploadProgress()}%` }}
								/>
							</div>
						</div>
					</Show>

					{/* submit button */}
					<Button
						type="submit"
						disabled={isUploading() || !file()}
						class="w-full"
					>
						{isUploading() ? "Uploading..." : "Upload Track"}
					</Button>
				</form>
			</div>
		</div>
	);
}
