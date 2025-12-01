// track edit page with version management

import { createFileRoute, useNavigate, useRouter } from "@tanstack/solid-router";
import { useMutation } from "@tanstack/solid-query";
import { Button } from "@ui/button";
import { Label } from "@ui/label";
import {
	TextField,
	TextFieldInput,
	TextFieldTextArea,
} from "@ui/text-field";
import Check from "lucide-solid/icons/check";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import Copy from "lucide-solid/icons/copy";
import Music from "lucide-solid/icons/music";
import Pencil from "lucide-solid/icons/pencil";
import Plus from "lucide-solid/icons/plus";
import Star from "lucide-solid/icons/star";
import Trash2 from "lucide-solid/icons/trash-2";
import Upload from "lucide-solid/icons/upload";
import X from "lucide-solid/icons/x";
import { createMemo, createSignal, For, Show } from "solid-js";
import { toast } from "solid-sonner";
import type { TrackVersion } from "@/db/schema";
import { AccessDeniedError } from "@/lib/errors";
import { wrapLoader } from "@/lib/loader-wrapper";
import {
	deleteTrackMutationOptions,
	deleteTrackVersionMutationOptions,
	setActiveVersionMutationOptions,
	updateTrackMutationOptions,
	updateVersionMetadataMutationOptions,
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

		// check if user can edit this track (session comes from root context)
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
	const updateVersionMetadataMutation = useMutation(() =>
		updateVersionMetadataMutationOptions(),
	);
	const uploadVersionMutation = useMutation(() =>
		uploadTrackVersionMutationOptions(),
	);
	const deleteTrackMutation = useMutation(() => deleteTrackMutationOptions());

	// track metadata form state
	const [title, setTitle] = createSignal(data().track.title);
	const [description, setDescription] = createSignal(
		data().track.description ?? "",
	);
	const [isPublic, setIsPublic] = createSignal(data().track.isPublic);
	const [allowDownload, setAllowDownload] = createSignal(
		data().track.allowDownload,
	);
	const [socialPromptEnabled, setSocialPromptEnabled] = createSignal(
		data().track.socialPromptEnabled,
	);

	// parse social links
	const parsedSocialLinks = () => {
		const links = data().track.socialLinks;
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
	};

	const [instagram, setInstagram] = createSignal(parsedSocialLinks().instagram);
	const [soundcloud, setSoundcloud] = createSignal(
		parsedSocialLinks().soundcloud,
	);
	const [tiktok, setTiktok] = createSignal(parsedSocialLinks().tiktok);

	// ui state
	const [editingVersion, setEditingVersion] = createSignal<string | null>(null);
	const [showUpload, setShowUpload] = createSignal(false);
	const [uploadFile, setUploadFile] = createSignal<File | null>(null);

	// get active version for album art
	const activeVersion = createMemo(() => {
		const activeId = data().track.activeVersion;
		if (!activeId) return null;
		return data().versions.find((v) => v.id === activeId) ?? null;
	});

	// version metadata editing state
	const [versionArtist, setVersionArtist] = createSignal("");
	const [versionAlbum, setVersionAlbum] = createSignal("");
	const [versionGenre, setVersionGenre] = createSignal("");
	const [versionYear, setVersionYear] = createSignal("");

	// reload route data after mutations
	const reloadData = () => {
		router.load();
	};

	const handleSaveTrack = async () => {
		try {
			await updateTrackMutation.mutateAsync({
				trackId: data().track.id,
				title: title(),
				description: description() || undefined,
				isPublic: isPublic(),
				allowDownload: allowDownload(),
				socialPromptEnabled: socialPromptEnabled(),
				socialLinks: {
					instagram: instagram() || undefined,
					soundcloud: soundcloud() || undefined,
					tiktok: tiktok() || undefined,
				},
			});
			toast.success("Track saved successfully");
			reloadData();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save track",
			);
		}
	};

	const handleSetActiveVersion = async (versionId: string) => {
		try {
			await setActiveVersionMutation.mutateAsync({
				trackId: data().track.id,
				versionId,
			});
			toast.success("Active version updated");
			reloadData();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to set active version",
			);
		}
	};

	const handleDeleteVersion = async (versionId: string) => {
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
			reloadData();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to delete version",
			);
		}
	};

	const startEditingVersion = (version: TrackVersion) => {
		setEditingVersion(version.id);
		setVersionArtist(version.artist ?? "");
		setVersionAlbum(version.album ?? "");
		setVersionGenre(version.genre ?? "");
		setVersionYear(version.year?.toString() ?? "");
	};

	const cancelEditingVersion = () => {
		setEditingVersion(null);
	};

	const handleSaveVersionMetadata = async (versionId: string) => {
		try {
			await updateVersionMetadataMutation.mutateAsync({
				trackId: data().track.id,
				versionId,
				artist: versionArtist() || null,
				album: versionAlbum() || null,
				genre: versionGenre() || null,
				year: versionYear() ? parseInt(versionYear(), 10) : null,
			});
			toast.success("Version metadata saved");
			setEditingVersion(null);
			reloadData();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save metadata",
			);
		}
	};

	const copyMetadataFromVersion = (version: TrackVersion) => {
		setVersionArtist(version.artist ?? "");
		setVersionAlbum(version.album ?? "");
		setVersionGenre(version.genre ?? "");
		setVersionYear(version.year?.toString() ?? "");
	};

	const handleFileSelect = (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			if (!file.type.startsWith("audio/")) {
				toast.error("Please select an audio file");
				return;
			}
			if (file.size > 100 * 1024 * 1024) {
				toast.error("File size must be less than 100MB");
				return;
			}
			setUploadFile(file);
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
			reloadData();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload failed");
		}
	};

	const getAlbumArtUrl = (version: TrackVersion): string | null => {
		if (!version.albumArtKey) return null;
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

	return (
		<>
			<div class="mb-8 flex flex-row items-center gap-6">
				{/* album art */}
				<Show when={activeVersion()}>
					{(version) => (
						<Show
							when={getAlbumArtUrl(version())}
							fallback={
								<div class="w-32 h-32 bg-stone-800 rounded-md flex items-center justify-center shrink-0">
									<Music class="w-12 h-12 text-stone-600" />
								</div>
							}
						>
							{(url) => (
								<img
									src={url()}
									alt="Album art"
									class="w-32 h-32 rounded-md object-cover shadow-lg shrink-0"
								/>
							)}
						</Show>
					)}
				</Show>

				<div class="min-w-0 flex-1">
					{/* back button */}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: `/track/${data().track.id}` })}
						class="mb-2"
					>
						<ChevronLeft class="w-4 h-4 mr-1" />
						Back
					</Button>

					{/* title field */}
					<div class="flex items-start justify-between gap-4">
						<TextField value={title()} onChange={setTitle} class="flex-1">
							<TextFieldInput
								type="text"
								placeholder="Track title"
								class="text-4xl py-4 font-bold text-white vt-track-name"
							/>
						</TextField>
					</div>

					{/* description field */}
					<TextField value={description()} onChange={setDescription} class="mt-2">
						<TextFieldTextArea
							rows={2}
							placeholder="Track description"
							class="text-lg opacity-70"
						/>
					</TextField>
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* track metadata section */}
				<div class="bg-stone-900/50 rounded-xl p-6">
					<h2 class="text-lg font-semibold text-white mb-4">Permissions</h2>

					<div class="space-y-4">

						<div class="space-y-3">
							<label class="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={isPublic()}
									onChange={(e) => setIsPublic(e.currentTarget.checked)}
									class="w-4 h-4 rounded border-stone-600 bg-stone-800 text-violet-500"
								/>
								<span class="text-white/80">Public</span>
							</label>

							<label class="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={allowDownload()}
									onChange={(e) => setAllowDownload(e.currentTarget.checked)}
									class="w-4 h-4 rounded border-stone-600 bg-stone-800 text-violet-500"
								/>
								<span class="text-white/80">Allow Downloads</span>
							</label>

							<label class="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={socialPromptEnabled()}
									onChange={(e) =>
										setSocialPromptEnabled(e.currentTarget.checked)
									}
									class="w-4 h-4 rounded border-stone-600 bg-stone-800 text-violet-500"
								/>
								<span class="text-white/80">Prompt for Social Follow</span>
							</label>
						</div>

						{/* social links */}
						<Show when={socialPromptEnabled()}>
							<div class="pt-4 border-t border-stone-800 space-y-3">
								<Label class="text-sm opacity-70">Social Links</Label>
								<TextField value={instagram()} onChange={setInstagram}>
									<TextFieldInput
										type="text"
										placeholder="Instagram username"
									/>
								</TextField>
								<TextField value={soundcloud()} onChange={setSoundcloud}>
									<TextFieldInput type="text" placeholder="SoundCloud URL" />
								</TextField>
								<TextField value={tiktok()} onChange={setTiktok}>
									<TextFieldInput type="text" placeholder="TikTok username" />
								</TextField>
							</div>
						</Show>

						<Button
							onClick={handleSaveTrack}
							disabled={updateTrackMutation.isPending}
							class="w-full"
						>
							{updateTrackMutation.isPending ? "Saving..." : "Save Track Details"}
						</Button>
					</div>
				</div>

				{/* versions section */}
				<div class="bg-stone-900/50 rounded-xl p-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-lg font-semibold text-white">Versions</h2>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowUpload(!showUpload())}
						>
							<Plus class="w-4 h-4 mr-1" />
							Add Version
						</Button>
					</div>

					{/* upload new version */}
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

							<Show
								when={uploadFile()}
								fallback={
									<div class="relative border-2 border-dashed border-stone-700 rounded-lg p-6 text-center">
										<Upload class="w-8 h-8 mx-auto mb-2 opacity-70" />
										<p class="text-sm opacity-70">
											Drop audio file or click to browse
										</p>
										<input
											type="file"
											accept="audio/*"
											onChange={handleFileSelect}
											class="absolute inset-0 opacity-0 cursor-pointer"
										/>
									</div>
								}
							>
								{(file) => (
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<Music class="w-5 h-5 text-violet-400/80" />
											<div>
												<p class="text-white text-sm">{file().name}</p>
												<p class="text-xs opacity-50">
													{(file().size / (1024 * 1024)).toFixed(2)} MB
												</p>
											</div>
										</div>
										<div class="flex gap-2">
											<Button
												size="sm"
												onClick={handleUploadVersion}
												disabled={uploadVersionMutation.isPending}
											>
												{uploadVersionMutation.isPending ? "Uploading..." : "Upload"}
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => setUploadFile(null)}
											>
												<X class="w-4 h-4" />
											</Button>
										</div>
									</div>
								)}
							</Show>
						</div>
					</Show>

					{/* versions list */}
					<div class="space-y-3">
						<For each={data().versions}>
							{(version) => (
								<div
									class={`p-4 rounded-lg transition-colors ${
										data().track.activeVersion === version.id
											? "bg-violet-500/10 ring-1 ring-violet-500/50"
											: "bg-stone-800/50"
									}`}
								>
									<Show
										when={editingVersion() === version.id}
										fallback={
											<>
												{/* version header */}
												<div class="flex items-start justify-between mb-3">
													<div class="flex items-center gap-3">
														{/* album art thumbnail */}
														<Show
															when={getAlbumArtUrl(version)}
															fallback={
																<div class="w-12 h-12 bg-stone-700 rounded flex items-center justify-center">
																	<Music class="w-6 h-6 opacity-50" />
																</div>
															}
														>
															{(url) => (
																<img
																	src={url()}
																	alt="Album art"
																	class="w-12 h-12 rounded object-cover"
																/>
															)}
														</Show>
														<div>
															<div class="flex items-center gap-2">
																<span class="text-white font-medium">
																	v{version.versionNumber}
																</span>
																<Show
																	when={
																		data().track.activeVersion === version.id
																	}
																>
																	<span class="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded">
																		Active
																	</span>
																</Show>
																<span
																	class={`px-2 py-0.5 text-xs rounded ${
																		version.processingStatus === "complete"
																			? "bg-green-500/20 text-green-300"
																			: version.processingStatus === "failed"
																				? "bg-red-500/20 text-red-300"
																				: "bg-yellow-500/20 text-yellow-300"
																	}`}
																>
																	{version.processingStatus}
																</span>
															</div>
															<p class="text-xs opacity-50">
																{new Date(
																	version.createdAt,
																).toLocaleDateString()}
															</p>
														</div>
													</div>

													{/* version actions */}
													<div class="flex gap-1">
														<Show
															when={
																version.processingStatus === "complete" &&
																data().track.activeVersion !== version.id
															}
														>
															<Button
																variant="ghost"
																size="icon"
																title="Set as active"
																onClick={() =>
																	handleSetActiveVersion(version.id)
																}
															>
																<Star class="w-4 h-4" />
															</Button>
														</Show>
														<Button
															variant="ghost"
															size="icon"
															title="Edit metadata"
															onClick={() => startEditingVersion(version)}
														>
															<Pencil class="w-4 h-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															title="Delete version"
															onClick={() => handleDeleteVersion(version.id)}
														>
															<Trash2 class="w-4 h-4 text-red-400" />
														</Button>
													</div>
												</div>

												{/* version metadata */}
												<div class="grid grid-cols-2 gap-2 text-xs">
													<div>
														<span class="opacity-50">Duration:</span>{" "}
														<span class="opacity-70">
															{formatDuration(version.duration)}
														</span>
													</div>
													<div>
														<span class="opacity-50">Bitrate:</span>{" "}
														<span class="opacity-70">
															{formatBitrate(version.bitrate)}
														</span>
													</div>
													<Show when={version.artist}>
														<div>
															<span class="opacity-50">Artist:</span>{" "}
															<span class="opacity-70">{version.artist}</span>
														</div>
													</Show>
													<Show when={version.album}>
														<div>
															<span class="opacity-50">Album:</span>{" "}
															<span class="opacity-70">{version.album}</span>
														</div>
													</Show>
													<Show when={version.genre}>
														<div>
															<span class="opacity-50">Genre:</span>{" "}
															<span class="opacity-70">{version.genre}</span>
														</div>
													</Show>
													<Show when={version.year}>
														<div>
															<span class="opacity-50">Year:</span>{" "}
															<span class="opacity-70">{version.year}</span>
														</div>
													</Show>
												</div>
											</>
										}
									>
										{/* editing mode */}
										<div class="space-y-3">
											<div class="flex items-center justify-between">
												<span class="text-white font-medium">
													Edit v{version.versionNumber} Metadata
												</span>
												<div class="flex gap-1">
													{/* copy from other versions */}
													<For
														each={data().versions.filter(
															(v) => v.id !== version.id,
														)}
													>
														{(otherVersion) => (
															<Button
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
											</div>

											<TextField
												value={versionArtist()}
												onChange={setVersionArtist}
											>
												<TextFieldInput
													type="text"
													placeholder="Artist"
													class="text-sm"
												/>
											</TextField>

											<TextField
												value={versionAlbum()}
												onChange={setVersionAlbum}
											>
												<TextFieldInput
													type="text"
													placeholder="Album"
													class="text-sm"
												/>
											</TextField>

											<div class="grid grid-cols-2 gap-2">
												<TextField
													value={versionGenre()}
													onChange={setVersionGenre}
												>
													<TextFieldInput
														type="text"
														placeholder="Genre"
														class="text-sm"
													/>
												</TextField>

												<TextField
													value={versionYear()}
													onChange={setVersionYear}
												>
													<TextFieldInput
														type="text"
														placeholder="Year"
														class="text-sm"
													/>
												</TextField>
											</div>

											<div class="flex gap-2">
												<Button
													size="sm"
													onClick={() => handleSaveVersionMetadata(version.id)}
												>
													<Check class="w-4 h-4 mr-1" />
													Save
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={cancelEditingVersion}
												>
													Cancel
												</Button>
											</div>
										</div>
									</Show>
								</div>
							)}
						</For>

						<Show when={data().versions.length === 0}>
							<div class="text-center py-8 opacity-70">
								<Music class="w-12 h-12 mx-auto mb-2 opacity-50" />
								<p>No versions yet</p>
							</div>
						</Show>
					</div>
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
