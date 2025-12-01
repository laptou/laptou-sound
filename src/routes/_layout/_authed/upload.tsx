// upload page for creating new tracks

import { createForm } from "@tanstack/solid-form";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import { FileUploadZone } from "@/components/FileUploadZone";
import {
	FormCheckbox,
	FormField,
	FormTextArea,
} from "@/components/FormField";
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
			setUploadProgress(10);

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

				setUploadProgress(30);

				// upload file
				const formData = new FormData();
				formData.append("file", currentFile);
				formData.append("trackId", trackId);

				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					throw new Error("Upload failed");
				}

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
		<div class="flex flex-col gap-8">
			<div class="text-center mb-8">
				<h1 class="text-3xl font-bold text-white mb-2">Upload Track</h1>
				<p class="text-gray-400">Share your music with the community</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				class="space-y-6"
			>
				<FileUploadZone
					file={file()}
					onFileChange={handleFileChange}
					placeholder="Drop your audio file here"
				/>

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
			</form>
		</div>
	);
}
