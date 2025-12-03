// upload page for creating new tracks
// supports both presigned url uploads (direct to r2) and indirect uploads (through api)

import { createForm } from "@tanstack/solid-form";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FormCheckbox, FormField, FormTextArea } from "@/components/FormField";
import { AccessDeniedError } from "@/lib/errors";
import { hasRole } from "@/server/auth";
import {
	createTrackWithAudio,
	getNewTrackAudioUploadUrl,
} from "@/server/tracks";

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

// feature detection: check if fetch with ReadableStream body supports progress
// this works in modern browsers but not in all environments
function _supportsStreamUpload(): boolean {
	try {
		// check for Request constructor that accepts ReadableStream body
		// and that the browser supports upload progress via streams
		return (
			typeof ReadableStream !== "undefined" &&
			typeof Request !== "undefined" &&
			// @ts-expect-error - checking for experimental feature
			typeof new Request("", {
				method: "POST",
				body: new ReadableStream(),
				duplex: "half",
			}) !== "undefined"
		);
	} catch {
		return false;
	}
}

type UploadProgress =
	| { type: "determinate"; percent: number }
	| { type: "indeterminate" };

function UploadPage() {
	const navigate = useNavigate();
	const [file, setFile] = createSignal<File | null>(null);
	const [isUploading, setIsUploading] = createSignal(false);
	const [uploadProgress, setUploadProgress] = createSignal<UploadProgress>({
		type: "determinate",
		percent: 0,
	});
	const [isFormLocked, setIsFormLocked] = createSignal(false);

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
			setIsFormLocked(true);
			setUploadProgress({ type: "determinate", percent: 0 });

			try {
				const ext = currentFile.name.split(".").pop() || "mp3";

				// get upload url (presigned or indirect)
				const uploadInfo = await getNewTrackAudioUploadUrl({
					data: {
						contentType: currentFile.type,
						fileExtension: ext,
					},
				});

				setUploadProgress({ type: "determinate", percent: 5 });

				let tempKey: string;

				if (uploadInfo.mode === "presigned") {
					// direct upload to r2 via presigned url
					tempKey = uploadInfo.tempKey;
					await uploadWithProgress(uploadInfo.uploadUrl, currentFile, "PUT");
				} else {
					// indirect upload through our api
					const result = await uploadWithProgress(
						uploadInfo.uploadUrl,
						currentFile,
						"POST",
					);
					tempKey = result.tempKey;
				}

				setUploadProgress({ type: "determinate", percent: 90 });

				// create track with uploaded audio file
				const { trackId } = await createTrackWithAudio({
					data: {
						tempKey,
						title: value.title.trim(),
						description: value.description.trim() || undefined,
						isPublic: value.isPublic,
						allowDownload: value.allowDownload,
						fileExtension: ext,
					},
				});

				setUploadProgress({ type: "determinate", percent: 100 });

				toast.success("Track uploaded successfully");
				navigate({ to: `/track/${trackId}` });
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Upload failed");
				setIsFormLocked(false);
				throw err;
			} finally {
				setIsUploading(false);
			}
		},
	}));

	// upload file with progress tracking
	const uploadWithProgress = async (
		url: string,
		fileToUpload: File,
		method: "PUT" | "POST",
	): Promise<{ tempKey: string }> => {
		const fileSize = fileToUpload.size;

		// it would be tempting to use fetch with ReadableStream here, but there
		// are two issues:
		// 1. it does not work in Firefox (it just sends "[object
		//    ReadableStream]" as the body) and there's no easy way to do
		//    feature detection for this
		// 2. in Chrome, it seems to require HTTP/2, which is not supported by
		//    R2, so the request fails with ERR_ALPN_NEGOTIATION_FAILED
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();

			xhr.upload.addEventListener("progress", (e) => {
				if (e.lengthComputable) {
					// upload progress: 5-90% (track creation takes final 10%)
					const percent = 5 + (e.loaded / e.total) * 85;
					setUploadProgress({
						type: "determinate",
						percent: Math.round(percent),
					});
				} else if (e.loaded) {
					// upload progress: 5-90% (track creation takes final 10%)
					const percent = 5 + (e.loaded / fileSize) * 85;
					setUploadProgress({
						type: "determinate",
						percent: Math.round(percent),
					});
				} else {
					// show indeterminate state when progress can't be computed
					setUploadProgress({ type: "indeterminate" });
				}
			});

			xhr.addEventListener("load", () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						// for indirect uploads, parse the response to get tempKey
						if (method === "POST") {
							const data = JSON.parse(xhr.responseText);
							resolve({ tempKey: data.tempKey });
						} else {
							resolve({ tempKey: "" });
						}
					} catch {
						resolve({ tempKey: "" });
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

			xhr.open(method, url);

			if (method === "PUT") {
				// presigned url upload - send raw file with content type
				xhr.setRequestHeader("Content-Type", fileToUpload.type);
				xhr.send(fileToUpload);
			} else {
				// indirect upload - use FormData
				const formData = new FormData();
				formData.append("file", fileToUpload);
				xhr.send(formData);
			}
		});
	};

	// auto-fill title when file is selected
	const handleFileChange = (newFile: File | null) => {
		if (isFormLocked()) return;
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
					disabled={isFormLocked()}
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
								disabled={isFormLocked()}
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
								disabled={isFormLocked()}
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
									disabled={isFormLocked()}
								/>
							)}
						</form.Field>

						<form.Field name="allowDownload">
							{(field) => (
								<FormCheckbox
									field={field}
									label="Allow Downloads"
									description="Let others download the original file"
									disabled={isFormLocked()}
								/>
							)}
						</form.Field>
					</div>

					<Show when={isUploading()}>
						{(() => {
							const progress = uploadProgress();
							return (
								<div class="bg-slate-700/50 rounded-lg p-4">
									<div class="flex justify-between text-sm mb-2">
										<span class="text-gray-300">Uploading...</span>
										<Show
											when={progress.type === "determinate"}
											fallback={<span class="text-gray-400">...</span>}
										>
											<span class="text-gray-400">
												{
													(progress as { type: "determinate"; percent: number })
														.percent
												}
												%
											</span>
										</Show>
									</div>
									<div class="h-2 bg-slate-600 rounded-full overflow-hidden">
										<Show
											when={progress.type === "determinate"}
											fallback={
												<div class="h-full w-1/3 bg-linear-to-r from-violet-500 to-indigo-500 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
											}
										>
											<div
												class="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-300"
												style={{
													width: `${(progress as { type: "determinate"; percent: number }).percent}%`,
												}}
											/>
										</Show>
									</div>
								</div>
							);
						})()}
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
								disabled={
									!state().canSubmit ||
									state().isSubmitting ||
									!file() ||
									isFormLocked()
								}
								class="w-full"
							>
								{state().isSubmitting ? "Uploading..." : "Upload Track"}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>

			{/* css for indeterminate progress animation */}
			<style>
				{`
					@keyframes indeterminate {
						0% { transform: translateX(-100%); }
						100% { transform: translateX(400%); }
					}
				`}
			</style>
		</div>
	);
}
