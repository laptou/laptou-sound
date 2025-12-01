// track edit page with version management

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { Label } from "@ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/select";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldTextArea,
} from "@ui/text-field";
import Check from "lucide-solid/icons/check";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import Copy from "lucide-solid/icons/copy";
import ImagePlus from "lucide-solid/icons/image-plus";
import Loader2 from "lucide-solid/icons/loader-2";
import Music from "lucide-solid/icons/music";
import Plus from "lucide-solid/icons/plus";
import Star from "lucide-solid/icons/star";
import Trash2 from "lucide-solid/icons/trash-2";
import Upload from "lucide-solid/icons/upload";
import X from "lucide-solid/icons/x";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FormCheckboxSimple, FormField } from "@/components/FormField";
import type { TrackVersion } from "@/db/schema";
import { AccessDeniedError } from "@/lib/errors";
import { wrapLoader } from "@/lib/loader-wrapper";
import {
	deleteTrackMutationOptions,
	deleteTrackVersionMutationOptions,
	setActiveVersionMutationOptions,
	updateTrackMutationOptions,
	updateVersionMetadataMutationOptions,
	uploadAlbumArtMutationOptions,
	uploadTrackVersionMutationOptions,
} from "@/lib/track-queries";
import { getTrack, getTrackVersions } from "@/server/tracks";

export const Route = createFileRoute("/_layout/track/$trackId/edit")({
	loader: wrapLoader("/track/$trackId/edit", async ({ params, context }) => {
		const [track, versions] = await Promise.all([
			getTrack({ data: { trackId: params.trackId } }),
			getTrackVersions({ data: { trackId: params.trackId } }),
		]);

		if (!track) {
			throw new Error("Track not found");
		}

		const session = context.session;
		if (!session?.user) {
			throw new AccessDeniedError("You must be logged in to edit tracks");
		}

		const isOwner = track.ownerId === session.user.id;
		const isAdmin = session.user.role === "admin";

		if (!isOwner && !isAdmin) {
			throw new AccessDeniedError(
				"You do not have permission to edit this track",
			);
		}

		return { track, versions };
	}),
	component: TrackEditPage,
});

// helper to parse social links from json string
function parseSocialLinks(links: string | null): {
	instagram: string;
	soundcloud: string;
	tiktok: string;
} {
	if (!links) return { instagram: "", soundcloud: "", tiktok: "" };
	try {
		const parsed = JSON.parse(links) as {
			instagram?: string;
			soundcloud?: string;
			tiktok?: string;
		};
		return {
			instagram: parsed.instagram ?? "",
			soundcloud: parsed.soundcloud ?? "",
			tiktok: parsed.tiktok ?? "",
		};
	} catch {
		return { instagram: "", soundcloud: "", tiktok: "" };
	}
}

function TrackEditPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const data = Route.useLoaderData();

	// mutations
	const updateTrackMutation = useMutation(() => updateTrackMutationOptions());
	const setActiveVersionMutation = useMutation(() =>
		setActiveVersionMutationOptions(),
	);
	const deleteVersionMutation = useMutation(() =>
		deleteTrackVersionMutationOptions(),
	);
	const uploadVersionMutation = useMutation(() =>
		uploadTrackVersionMutationOptions(),
	);
	const deleteTrackMutation = useMutation(() => deleteTrackMutationOptions());
	const updateVersionMutation = useMutation(() =>
		updateVersionMetadataMutationOptions(),
	);
	const uploadAlbumArtMutation = useMutation(() =>
		uploadAlbumArtMutationOptions(),
	);

	// selected version state - default to active version or first version
	const [selectedVersionId, setSelectedVersionId] = createSignal<string | null>(
		data().track.activeVersion ?? data().versions[0]?.id ?? null,
	);

	// get selected version
	const selectedVersion = createMemo(() => {
		const id = selectedVersionId();
		if (!id) return null;
		return data().versions.find((v) => v.id === id) ?? null;
	});

	// album art preview state for newly uploaded art
	const [albumArtPreview, setAlbumArtPreview] = createSignal<string | null>(
		null,
	);

	// autosave state for title/description
	const [autoSaveStatus, setAutoSaveStatus] = createSignal<
		"idle" | "saving" | "saved"
	>("idle");
	let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	// title/description form with autosave
	const infoForm = createForm(() => {
		const track = data().track;
		return {
			defaultValues: {
				title: track.title,
				description: track.description ?? "",
			},
			onSubmit: async ({ value }) => {
				setAutoSaveStatus("saving");
				try {
					await updateTrackMutation.mutateAsync({
						trackId: data().track.id,
						title: value.title,
						description: value.description || undefined,
					});
					setAutoSaveStatus("saved");
					// reset to idle after a bit
					setTimeout(() => setAutoSaveStatus("idle"), 2000);
				} catch (err) {
					setAutoSaveStatus("idle");
					toast.error(
						err instanceof Error ? err.message : "Failed to save track info",
					);
					throw err;
				}
			},
		};
	});

	// watch for changes and trigger autosave
	const infoFormValues = infoForm.useStore((state) => state.values);
	createEffect(
		on(
			() => ({
				title: infoFormValues().title,
				desc: infoFormValues().description,
			}),
			() => {
				// clear existing timeout
				if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
				// set new timeout to save after 800ms of no changes
				autoSaveTimeout = setTimeout(() => {
					const values = infoFormValues();
					// only save if there's a title
					if (values.title?.trim()) {
						infoForm.handleSubmit();
					}
				}, 800);
			},
			{ defer: true },
		),
	);

	// permissions form - requires explicit save
	const permissionsForm = createForm(() => {
		const track = data().track;
		const socialLinks = parseSocialLinks(track.socialLinks);

		return {
			defaultValues: {
				isPublic: track.isPublic,
				allowDownload: track.allowDownload,
				socialPromptEnabled: track.socialPromptEnabled,
				instagram: socialLinks.instagram,
				soundcloud: socialLinks.soundcloud,
				tiktok: socialLinks.tiktok,
			},
			onSubmit: async ({ value }) => {
				try {
					await updateTrackMutation.mutateAsync({
						trackId: data().track.id,
						isPublic: value.isPublic,
						allowDownload: value.allowDownload,
						socialPromptEnabled: value.socialPromptEnabled,
						socialLinks: {
							instagram: value.instagram || undefined,
							soundcloud: value.soundcloud || undefined,
							tiktok: value.tiktok || undefined,
						},
					});
					toast.success("Permissions saved");
					router.load();
				} catch (err) {
					toast.error(
						err instanceof Error ? err.message : "Failed to save permissions",
					);
					throw err;
				}
			},
		};
	});

	// version metadata form
	const versionForm = createForm(() => {
		const version = selectedVersion();
		return {
			defaultValues: {
				artist: version?.artist ?? "",
				album: version?.album ?? "",
				genre: version?.genre ?? "",
				year: version?.year?.toString() ?? "",
			},
			onSubmit: async ({ value }) => {
				const versionId = selectedVersionId();
				if (!versionId) return;

				try {
					await updateVersionMutation.mutateAsync({
						trackId: data().track.id,
						versionId,
						artist: value.artist || null,
						album: value.album || null,
						genre: value.genre || null,
						year: value.year ? Number.parseInt(value.year, 10) : null,
					});
					toast.success("Version metadata saved");
					router.load();
				} catch (err) {
					toast.error(
						err instanceof Error ? err.message : "Failed to save metadata",
					);
					throw err;
				}
			},
		};
	});

	// reset version form when selected version changes
	createEffect(
		on(
			() => selectedVersionId(),
			() => {
				const version = selectedVersion();
				if (version) {
					versionForm.reset();
					setAlbumArtPreview(null);
				}
			},
			{ defer: true },
		),
	);

	// ui state
	const [showUpload, setShowUpload] = createSignal(false);
	const [uploadFile, setUploadFile] = createSignal<File | null>(null);

	// check if selected version is the active one
	const isSelectedVersionActive = createMemo(() => {
		return data().track.activeVersion === selectedVersionId();
	});

	const handleSetActiveVersion = async () => {
		const versionId = selectedVersionId();
		if (!versionId) return;

		try {
			await setActiveVersionMutation.mutateAsync({
				trackId: data().track.id,
				versionId,
			});
			toast.success("Active version updated");
			router.load();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to set active version",
			);
		}
	};

	const handleDeleteVersion = async () => {
		const versionId = selectedVersionId();
		if (!versionId) return;

		if (
			!confirm(
				"Are you sure you want to delete this version? This cannot be undone.",
			)
		) {
			return;
		}

		try {
			await deleteVersionMutation.mutateAsync({
				trackId: data().track.id,
				versionId,
			});
			toast.success("Version deleted");
			// select another version after deletion
			const remaining = data().versions.filter((v) => v.id !== versionId);
			setSelectedVersionId(remaining[0]?.id ?? null);
			router.load();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to delete version",
			);
		}
	};

	const handleUploadVersion = async () => {
		const file = uploadFile();
		if (!file) return;

		try {
			await uploadVersionMutation.mutateAsync({
				trackId: data().track.id,
				file,
			});
			toast.success("New version uploaded successfully");
			setShowUpload(false);
			setUploadFile(null);
			router.load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload failed");
		}
	};

	const handleAlbumArtSelect = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const versionId = selectedVersionId();
		if (!versionId) return;

		// validate file type
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		// validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image must be less than 5MB");
			return;
		}

		// show preview immediately
		const previewUrl = URL.createObjectURL(file);
		setAlbumArtPreview(previewUrl);

		try {
			await uploadAlbumArtMutation.mutateAsync({
				trackId: data().track.id,
				versionId,
				file,
			});
			toast.success("Album art updated");
			router.load();
		} catch (err) {
			// revert preview on error
			setAlbumArtPreview(null);
			toast.error(
				err instanceof Error ? err.message : "Failed to upload album art",
			);
		}
	};

	const getAlbumArtUrl = (version: TrackVersion | null): string | null => {
		// use preview if we have one (newly selected file)
		if (albumArtPreview()) return albumArtPreview();
		if (!version?.albumArtKey) return null;
		return `/files/${version.albumArtKey}`;
	};

	const formatDuration = (seconds: number | null) => {
		if (!seconds) return "--:--";
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const formatBitrate = (bitrate: number | null) => {
		if (!bitrate) return "N/A";
		return `${Math.round(bitrate / 1000)} kbps`;
	};

	// copy metadata from another version
	const copyMetadataFromVersion = (source: TrackVersion) => {
		versionForm.setFieldValue("artist", source.artist ?? "");
		versionForm.setFieldValue("album", source.album ?? "");
		versionForm.setFieldValue("genre", source.genre ?? "");
		versionForm.setFieldValue("year", source.year?.toString() ?? "");
	};

	// other versions (for copy metadata feature)
	const otherVersions = createMemo(() => {
		const id = selectedVersionId();
		return data().versions.filter((v) => v.id !== id);
	});

	// watch social prompt toggle to show/hide social links
	const socialPromptEnabled = permissionsForm.useStore(
		(state) => state.values.socialPromptEnabled,
	);

	return (
		<>
			{/* header with back button and autosave indicator */}
			<div class="flex items-center justify-between mb-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => navigate({ to: `/track/${data().track.id}` })}
				>
					<ChevronLeft class="w-4 h-4 mr-1" />
					Back
				</Button>

				{/* autosave indicator */}
				<Show when={autoSaveStatus() !== "idle"}>
					<div class="flex items-center gap-1.5 text-xs opacity-70">
						<Show
							when={autoSaveStatus() === "saving"}
							fallback={
								<>
									<Check class="w-3 h-3 text-green-400" />
									<span class="text-green-400">Saved</span>
								</>
							}
						>
							<Loader2 class="w-3 h-3 animate-spin" />
							<span>Saving...</span>
						</Show>
					</div>
				</Show>
			</div>

			{/* track info section: title and description */}
			<div class="mb-8">
				{/* title field - autosaves */}
				<infoForm.Field
					name="title"
					validators={{
						onChange: ({ value }) =>
							!value?.trim() ? "Title is required" : undefined,
					}}
				>
					{(field) => (
						<TextField
							value={field().state.value}
							onChange={(v) => field().handleChange(v)}
							validationState={
								field().state.meta.errors.length > 0 ? "invalid" : "valid"
							}
						>
							<TextFieldInput
								type="text"
								placeholder="Track title"
								onBlur={field().handleBlur}
								class="text-4xl py-6 font-bold text-white vt-track-name"
							/>
							<TextFieldErrorMessage>
								{field().state.meta.errors[0]}
							</TextFieldErrorMessage>
						</TextField>
					)}
				</infoForm.Field>

				{/* description field - autosaves */}
				<infoForm.Field name="description">
					{(field) => (
						<TextField
							value={field().state.value}
							onChange={(v) => field().handleChange(v)}
							class="mt-2"
						>
							<TextFieldTextArea
								rows={2}
								placeholder="Track description"
								onBlur={field().handleBlur}
								class="text-lg opacity-70"
							/>
						</TextField>
					)}
				</infoForm.Field>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* left column: version selector + version details */}
				<div class="flex flex-col gap-6">
					{/* version selector */}
					<div>
						<div class="flex items-center justify-between mb-3">
							<h2 class="text-lg font-semibold text-white">Version</h2>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowUpload(!showUpload())}
							>
								<Plus class="w-4 h-4 mr-1" />
								Add Version
							</Button>
						</div>

						{/* upload section */}
						<Show when={showUpload()}>
							<div class="mb-4 p-4 bg-stone-800/50 rounded-lg">
								<div class="flex items-center justify-between mb-3">
									<span class="text-white font-medium">Upload New Version</span>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => {
											setShowUpload(false);
											setUploadFile(null);
										}}
									>
										<X class="w-4 h-4" />
									</Button>
								</div>

								<FileUploadZone
									file={uploadFile()}
									onFileChange={setUploadFile}
									isUploading={uploadVersionMutation.isPending}
									onUpload={handleUploadVersion}
									uploadLabel="Upload"
								/>
							</div>
						</Show>

						{/* version select dropdown */}
						<Show
							when={data().versions.length > 0}
							fallback={
								<div class="text-center py-8 bg-stone-800/30 rounded-lg opacity-70">
									<Music class="w-12 h-12 mx-auto mb-2 opacity-50" />
									<p>No versions yet</p>
									<Button
										variant="outline"
										size="sm"
										class="mt-3"
										onClick={() => setShowUpload(true)}
									>
										<Upload class="w-4 h-4 mr-1" />
										Upload First Version
									</Button>
								</div>
							}
						>
							<Select
								value={selectedVersionId()}
								onChange={(val) => setSelectedVersionId(val)}
								options={data().versions.map((v) => v.id)}
								itemComponent={(props) => {
									const version = data().versions.find(
										(v) => v.id === props.item.rawValue,
									);
									const isActive =
										data().track.activeVersion === props.item.rawValue;
									return (
										<SelectItem item={props.item}>
											<div class="flex items-center gap-2">
												<span>v{version?.versionNumber}</span>
												<Show when={isActive}>
													<span class="px-1.5 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded">
														Active
													</span>
												</Show>
												<Show when={version?.processingStatus !== "complete"}>
													<span
														class={`px-1.5 py-0.5 text-xs rounded ${
															version?.processingStatus === "failed"
																? "bg-red-500/20 text-red-300"
																: "bg-yellow-500/20 text-yellow-300"
														}`}
													>
														{version?.processingStatus}
													</span>
												</Show>
											</div>
										</SelectItem>
									);
								}}
							>
								<SelectTrigger class="w-full">
									<SelectValue<string>>
										{(state) => {
											const version = data().versions.find(
												(v) => v.id === state.selectedOption(),
											);
											const isActive =
												data().track.activeVersion === state.selectedOption();
											return (
												<div class="flex items-center gap-2">
													<span>v{version?.versionNumber}</span>
													<Show when={isActive}>
														<span class="px-1.5 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded">
															Active
														</span>
													</Show>
												</div>
											);
										}}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</Show>
					</div>

					{/* version details */}
					<Show when={selectedVersion()}>
						{(version) => (
							<div class="flex flex-col gap-6">
								{/* album art - clickable to change */}
								<div class="flex gap-6">
									<div class="shrink-0">
										<div class="relative group">
											<Show
												when={getAlbumArtUrl(version())}
												fallback={
													<div class="w-32 h-32 bg-stone-700 rounded-lg flex items-center justify-center">
														<Music class="w-12 h-12 opacity-50" />
													</div>
												}
											>
												{(url) => (
													<img
														src={url()}
														alt="Album art"
														class="w-32 h-32 rounded-lg object-cover shadow-lg vt-track-album-art"
													/>
												)}
											</Show>
											{/* upload overlay */}
											<label class="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
												<Show
													when={!uploadAlbumArtMutation.isPending}
													fallback={
														<div class="text-white text-sm">Uploading...</div>
													}
												>
													<div class="flex flex-col items-center text-white">
														<ImagePlus class="w-6 h-6 mb-1" />
														<span class="text-sm">Change Art</span>
													</div>
												</Show>
												<input
													type="file"
													accept="image/*"
													onChange={handleAlbumArtSelect}
													disabled={uploadAlbumArtMutation.isPending}
													class="sr-only"
												/>
											</label>
										</div>
										<p class="text-xs text-center mt-2 opacity-50">
											Click to change
										</p>
									</div>

									{/* version info */}
									<div class="flex-1 space-y-2">
										<div class="grid grid-cols-2 gap-2 text-sm">
											<div>
												<span class="opacity-50">Duration:</span>{" "}
												<span class="opacity-70">
													{formatDuration(version().duration)}
												</span>
											</div>
											<div>
												<span class="opacity-50">Bitrate:</span>{" "}
												<span class="opacity-70">
													{formatBitrate(version().bitrate)}
												</span>
											</div>
											<div>
												<span class="opacity-50">Created:</span>{" "}
												<span class="opacity-70">
													{new Date(version().createdAt).toLocaleDateString()}
												</span>
											</div>
											<div>
												<span class="opacity-50">Status:</span>{" "}
												<span
													class={`${
														version().processingStatus === "complete"
															? "text-green-400"
															: version().processingStatus === "failed"
																? "text-red-400"
																: "text-yellow-400"
													}`}
												>
													{version().processingStatus}
												</span>
											</div>
										</div>

										{/* version actions */}
										<div class="flex gap-2 pt-2">
											<Show
												when={
													version().processingStatus === "complete" &&
													!isSelectedVersionActive()
												}
											>
												<Button
													variant="outline"
													size="sm"
													onClick={handleSetActiveVersion}
													disabled={setActiveVersionMutation.isPending}
												>
													<Star class="w-4 h-4 mr-1" />
													Set as Active
												</Button>
											</Show>
											<Button
												variant="ghost"
												size="sm"
												onClick={handleDeleteVersion}
												disabled={deleteVersionMutation.isPending}
												class="text-red-400 hover:text-red-300"
											>
												<Trash2 class="w-4 h-4 mr-1" />
												Delete
											</Button>
										</div>
									</div>
								</div>

								{/* version metadata form */}
								<form
									onSubmit={(e) => {
										e.preventDefault();
										e.stopPropagation();
										versionForm.handleSubmit();
									}}
									class="space-y-4"
								>
									<div class="flex items-center justify-between">
										<h3 class="text-md font-medium text-white">Metadata</h3>
										{/* copy from other version */}
										<Show when={otherVersions().length > 0}>
											<div class="flex gap-1">
												<For each={otherVersions()}>
													{(otherVersion) => (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															title={`Copy from v${otherVersion.versionNumber}`}
															onClick={() =>
																copyMetadataFromVersion(otherVersion)
															}
														>
															<Copy class="w-3 h-3 mr-1" />v
															{otherVersion.versionNumber}
														</Button>
													)}
												</For>
											</div>
										</Show>
									</div>

									<div class="grid grid-cols-2 gap-3">
										<versionForm.Field name="artist">
											{(field) => (
												<FormField
													field={field}
													label="Artist"
													placeholder="Artist name"
												/>
											)}
										</versionForm.Field>

										<versionForm.Field name="album">
											{(field) => (
												<FormField
													field={field}
													label="Album"
													placeholder="Album name"
												/>
											)}
										</versionForm.Field>

										<versionForm.Field name="genre">
											{(field) => (
												<FormField
													field={field}
													label="Genre"
													placeholder="Genre"
												/>
											)}
										</versionForm.Field>

										<versionForm.Field name="year">
											{(field) => (
												<FormField
													field={field}
													label="Year"
													placeholder="Year"
												/>
											)}
										</versionForm.Field>
									</div>

									<versionForm.Subscribe
										selector={(state) => ({
											canSubmit: state.canSubmit,
											isSubmitting: state.isSubmitting,
										})}
									>
										{(state) => (
											<Button
												type="submit"
												disabled={!state().canSubmit || state().isSubmitting}
												class="w-full"
											>
												<Check class="w-4 h-4 mr-1" />
												{state().isSubmitting
													? "Saving..."
													: "Save Version Metadata"}
											</Button>
										)}
									</versionForm.Subscribe>
								</form>
							</div>
						)}
					</Show>
				</div>

				{/* right column: permissions */}
				<div class="flex flex-col gap-4">
					<h2 class="text-lg font-semibold text-white">Permissions</h2>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							permissionsForm.handleSubmit();
						}}
						class="flex flex-col gap-4"
					>
						<div class="flex flex-col gap-3 flex-1">
							<permissionsForm.Field name="isPublic">
								{(field) => <FormCheckboxSimple field={field} label="Public" />}
							</permissionsForm.Field>

							<permissionsForm.Field name="allowDownload">
								{(field) => (
									<FormCheckboxSimple field={field} label="Allow Downloads" />
								)}
							</permissionsForm.Field>

							<permissionsForm.Field name="socialPromptEnabled">
								{(field) => (
									<FormCheckboxSimple
										field={field}
										label="Prompt for Social Follow"
									/>
								)}
							</permissionsForm.Field>
						</div>

						{/* social links */}
						<Show when={socialPromptEnabled()}>
							<div class="pt-4 border-t border-stone-800 space-y-3">
								<Label class="text-sm opacity-70">Social Links</Label>

								<permissionsForm.Field name="instagram">
									{(field) => (
										<FormField
											field={field}
											label="Instagram"
											placeholder="Instagram username"
										/>
									)}
								</permissionsForm.Field>

								<permissionsForm.Field name="soundcloud">
									{(field) => (
										<FormField
											field={field}
											label="SoundCloud"
											placeholder="SoundCloud URL"
										/>
									)}
								</permissionsForm.Field>

								<permissionsForm.Field name="tiktok">
									{(field) => (
										<FormField
											field={field}
											label="TikTok"
											placeholder="TikTok username"
										/>
									)}
								</permissionsForm.Field>
							</div>
						</Show>

						<permissionsForm.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{(state) => (
								<Button
									type="submit"
									disabled={!state().canSubmit || state().isSubmitting}
									class="w-full"
								>
									{state().isSubmitting ? "Saving..." : "Save Permissions"}
								</Button>
							)}
						</permissionsForm.Subscribe>
					</form>
				</div>
			</div>

			{/* danger zone */}
			<div class="mt-8 bg-red-950/20 border border-red-900/50 rounded-xl p-6">
				<h2 class="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
				<p class="text-sm mb-4 opacity-70">
					Deleting this track will remove all versions, plays, and comments.
					This cannot be undone.
				</p>
				<Button
					variant="destructive"
					disabled={deleteTrackMutation.isPending}
					onClick={async () => {
						if (
							!confirm(
								"Are you sure you want to delete this track? This cannot be undone.",
							)
						) {
							return;
						}

						try {
							await deleteTrackMutation.mutateAsync({
								trackId: data().track.id,
							});
							toast.success("Track deleted");
							navigate({ to: "/my-tracks" });
						} catch (err) {
							toast.error(
								err instanceof Error ? err.message : "Failed to delete track",
							);
						}
					}}
				>
					<Trash2 class="w-4 h-4 mr-2" />
					{deleteTrackMutation.isPending ? "Deleting..." : "Delete Track"}
				</Button>
			</div>
		</>
	);
}
