// upload page for creating new tracks

import { createForm } from "@tanstack/solid-form";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FormCheckbox, FormField, FormTextArea } from "@/components/FormField";
import { AccessDeniedError } from "@/lib/errors";
import { hasRole } from "@/server/auth";
import { createTrack } from "@/server/tracks";

export const Route = createFileRoute("/_layout/_authed/upload")({
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
	const [file, setFile] = createSignal<File | null>(null);
	const [isUploading, setIsUploading] = createSignal(false);
	const [uploadProgress, setUploadProgress] = createSignal(0);

	// track form
	const form = createForm(() => ({
		defaultValues: {
			title: "",
			description: "",
			isPublic: true,
			allowDownload: false,
		},
		onSubmit: async ({ value }) => {
			const currentFile = file();

			if (!currentFile) {
				toast.error("Please select a file to upload");
				throw new Error("No file selected");
			}

			setIsUploading(true);
			setUploadProgress(0);

			try {
				// create track metadata
				const { id: trackId } = await createTrack({
					data: {
						title: value.title.trim(),
						description: value.description.trim() || undefined,
						isPublic: value.isPublic,
						allowDownload: value.allowDownload,
					},
				});

				setUploadProgress(5);

				// upload file with progress tracking
				const formData = new FormData();
				formData.append("file", currentFile);
				formData.append("trackId", trackId);

				// use xmlhttprequest to track upload progress
				const response = await new Promise<{ versionId: string; versionNumber: number }>(
					(resolve, reject) => {
						const xhr = new XMLHttpRequest();

						// track upload progress (5-95% range, leaving 5% for completion)
						xhr.upload.addEventListener("progress", (e) => {
							if (e.lengthComputable) {
								const percentComplete = 5 + (e.loaded / e.total) * 90;
								setUploadProgress(Math.round(percentComplete));
							}
						});

						xhr.addEventListener("load", () => {
							if (xhr.status >= 200 && xhr.status < 300) {
								try {
									const data = JSON.parse(xhr.responseText);
									resolve(data);
								} catch (err) {
									reject(new Error("Failed to parse response"));
								}
							} else {
								try {
									const error = JSON.parse(xhr.responseText);
									reject(new Error(error.error || "Upload failed"));
								} catch {
									reject(new Error(`Upload failed with status ${xhr.status}`));
								}
							}
						});

						xhr.addEventListener("error", () => {
							reject(new Error("Network error during upload"));
						});

						xhr.addEventListener("abort", () => {
							reject(new Error("Upload was cancelled"));
						});

						xhr.open("POST", "/api/upload");
						xhr.send(formData);
					},
				);

				setUploadProgress(100);

				toast.success("Track uploaded successfully");
				navigate({ to: `/track/${trackId}` });
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Upload failed");
				throw err;
			} finally {
				setIsUploading(false);
			}
		},
	}));

	// auto-fill title when file is selected
	const handleFileChange = (newFile: File | null) => {
		setFile(newFile);

		if (newFile && !form.getFieldValue("title")) {
			const fileName = newFile.name.replace(/\.[^/.]+$/, "");
			form.setFieldValue("title", fileName);
		}
	};

	return (
		<div class="flex flex-col gap-8 items-center">
			<div class="text-center">
				<h1 class="text-3xl font-bold text-white mb-2">Upload Track</h1>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				class="flex flex-col md:flex-row gap-8 w-full max-w-4xl"
			>
				<FileUploadZone
					class="w-full flex-1"
					file={file()}
					onFileChange={handleFileChange}
					placeholder="Drop your audio file here"
				/>

				<div class="flex flex-col gap-4 w-full flex-1">
					<form.Field
						name="title"
						validators={{
							onChange: ({ value }) =>
								!value?.trim() ? "Title is required" : undefined,
						}}
					>
						{(field) => (
							<FormField
								field={field}
								label="Title *"
								placeholder="Enter track title"
								required
							/>
						)}
					</form.Field>

					<form.Field name="description">
						{(field) => (
							<FormTextArea
								field={field}
								label="Description"
								placeholder="Add a description (optional)"
								rows={3}
								textareaClass="resize-none"
							/>
						)}
					</form.Field>

					<div class="space-y-4">
						<form.Field name="isPublic">
							{(field) => (
								<FormCheckbox
									field={field}
									label="Public"
									description="Anyone can see this track"
								/>
							)}
						</form.Field>

						<form.Field name="allowDownload">
							{(field) => (
								<FormCheckbox
									field={field}
									label="Allow Downloads"
									description="Let others download the original file"
								/>
							)}
						</form.Field>
					</div>

					<Show when={isUploading()}>
						<div class="bg-slate-700/50 rounded-lg p-4">
							<div class="flex justify-between text-sm mb-2">
								<span class="text-gray-300">Uploading...</span>
								<span class="text-gray-400">{uploadProgress()}%</span>
							</div>
							<div class="h-2 bg-slate-600 rounded-full overflow-hidden">
								<div
									class="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-300"
									style={{ width: `${uploadProgress()}%` }}
								/>
							</div>
						</div>
					</Show>

					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{(state) => (
							<Button
								type="submit"
								disabled={!state().canSubmit || state().isSubmitting || !file()}
								class="w-full"
							>
								{state().isSubmitting ? "Uploading..." : "Upload Track"}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
