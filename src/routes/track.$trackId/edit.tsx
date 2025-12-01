// track edit page with version management

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
import { createSignal, For, Show } from "solid-js";
import type { TrackVersion } from "@/db/schema";
import { AccessDeniedError } from "@/lib/errors";
import { wrapLoader } from "@/lib/loader-wrapper";
import {
	deleteTrackVersion,
	getTrack,
	getTrackVersions,
	setActiveVersion,
	updateTrack,
	updateVersionMetadata,
} from "@/server/tracks";

export const Route = createFileRoute("/track/$trackId/edit")({
	loader: wrapLoader("/track/$trackId/edit", async ({ params, context }) => {
		const [track, versions] = await Promise.all([
			getTrack({ data: { trackId: params.trackId } }),
			getTrackVersions({ data: { trackId: params.trackId } }),
		])

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
			throw new AccessDeniedError("You do not have permission to edit this track");
		}

		return { track, versions };
	}),
	component: TrackEditPage,
});

function TrackEditPage() {
	const navigate = useNavigate();
	const data = Route.useLoaderData();

	// track metadata form state
	const [title, setTitle] = createSignal(data().track.title);
	const [description, setDescription] = createSignal(data().track.description ?? "");
	const [isPublic, setIsPublic] = createSignal(data().track.isPublic);
	const [allowDownload, setAllowDownload] = createSignal(data().track.allowDownload);
	const [socialPromptEnabled, setSocialPromptEnabled] = createSignal(
		data().track.socialPromptEnabled,
	)

	// parse social links
	const parsedSocialLinks = () => {
		const links = data().track.socialLinks;
		if (!links) return { instagram: "", soundcloud: "", tiktok: "" };
		try {
			const parsed = JSON.parse(links) as {
				instagram?: string;
				soundcloud?: string;
				tiktok?: string;
			}
			return {
				instagram: parsed.instagram ?? "",
				soundcloud: parsed.soundcloud ?? "",
				tiktok: parsed.tiktok ?? "",
			}
		} catch {
			return { instagram: "", soundcloud: "", tiktok: "" };
		}
	}

	const [instagram, setInstagram] = createSignal(parsedSocialLinks().instagram);
	const [soundcloud, setSoundcloud] = createSignal(parsedSocialLinks().soundcloud);
	const [tiktok, setTiktok] = createSignal(parsedSocialLinks().tiktok);

	// ui state
	const [error, setError] = createSignal<string | null>(null);
	const [success, setSuccess] = createSignal<string | null>(null);
	const [isSaving, setIsSaving] = createSignal(false);
	const [editingVersion, setEditingVersion] = createSignal<string | null>(null);
	const [showUpload, setShowUpload] = createSignal(false);
	const [uploadFile, setUploadFile] = createSignal<File | null>(null);
	const [isUploading, setIsUploading] = createSignal(false);

	// version metadata editing state
	const [versionArtist, setVersionArtist] = createSignal("");
	const [versionAlbum, setVersionAlbum] = createSignal("");
	const [versionGenre, setVersionGenre] = createSignal("");
	const [versionYear, setVersionYear] = createSignal("");

	const handleSaveTrack = async () => {
		setError(null);
		setSuccess(null);
		setIsSaving(true);

		try {
			await updateTrack({
				data: {
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
				},
			})

			setSuccess("Track saved successfully");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save track");
		} finally {
			setIsSaving(false);
		}
	}

	const handleSetActiveVersion = async (versionId: string) => {
		setError(null);
		setSuccess(null);

		try {
			await setActiveVersion({
				data: { trackId: data().track.id, versionId },
			})
			setSuccess("Active version updated");
			// reload page to refresh data
			window.location.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to set active version");
		}
	}

	const handleDeleteVersion = async (versionId: string) => {
		if (!confirm("Are you sure you want to delete this version? This cannot be undone.")) {
			return
		}

		setError(null);
		setSuccess(null);

		try {
			await deleteTrackVersion({
				data: { trackId: data().track.id, versionId },
			})
			setSuccess("Version deleted");
			window.location.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete version");
		}
	}

	const startEditingVersion = (version: TrackVersion) => {
		setEditingVersion(version.id);
		setVersionArtist(version.artist ?? "");
		setVersionAlbum(version.album ?? "");
		setVersionGenre(version.genre ?? "");
		setVersionYear(version.year?.toString() ?? "");
	}

	const cancelEditingVersion = () => {
		setEditingVersion(null);
	}

	const handleSaveVersionMetadata = async (versionId: string) => {
		setError(null);

		try {
			await updateVersionMetadata({
				data: {
					trackId: data().track.id,
					versionId,
					artist: versionArtist() || null,
					album: versionAlbum() || null,
					genre: versionGenre() || null,
					year: versionYear() ? parseInt(versionYear(), 10) : null,
				},
			})
			setSuccess("Version metadata saved");
			setEditingVersion(null);
			window.location.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save metadata");
		}
	}

	const copyMetadataFromVersion = (version: TrackVersion) => {
		setVersionArtist(version.artist ?? "");
		setVersionAlbum(version.album ?? "");
		setVersionGenre(version.genre ?? "");
		setVersionYear(version.year?.toString() ?? "");
	}

	const handleFileSelect = (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			if (!file.type.startsWith("audio/")) {
				setError("Please select an audio file");
				return
			}
			if (file.size > 100 * 1024 * 1024) {
				setError("File size must be less than 100MB");
				return
			}
			setUploadFile(file);
			setError(null);
		}
	}

	const handleUploadVersion = async () => {
		const file = uploadFile();
		if (!file) return;

		setIsUploading(true);
		setError(null);

		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("trackId", data().track.id);

			const response = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			})

			if (!response.ok) {
				throw new Error("Upload failed");
			}

			setSuccess("New version uploaded successfully");
			setShowUpload(false);
			setUploadFile(null);
			window.location.reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	}

	const getAlbumArtUrl = (version: TrackVersion): string | null => {
		if (!version.albumArtKey) return null;
		return `/files/${version.albumArtKey}`;
	}

	const formatDuration = (seconds: number | null) => {
		if (!seconds) return "--:--";
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	const formatBitrate = (bitrate: number | null) => {
		if (!bitrate) return "N/A";
		return `${Math.round(bitrate / 1000)} kbps`;
	}

	return (
		<div class="min-h-screen bg-linear-to-b from-stone-900 via-stone-950 to-stone-900 py-12 px-6 relative">
			<div class="absolute inset-0 bg-linear-to-br from-violet-500 via-indigo-500 to-purple-500 mask-radial-at-top mask-circle mask-radial-from-0% mask-contain opacity-30 z-0" />
			<div class="max-w-4xl mx-auto relative z-10">
				{/* header */}
				<div class="flex items-center gap-4 mb-8">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => navigate({ to: `/track/${data().track.id}` })}
					>
						<ChevronLeft class="w-5 h-5" />
					</Button>
					<div>
						<h1 class="text-2xl font-bold text-white">Edit Track</h1>
						<p class="text-sm opacity-70">{data().track.title}</p>
					</div>
				</div>

				{/* messages */}
				<Show when={error()}>
					{(err) => (
						<Callout variant="error" class="mb-6">
							<CalloutContent>
								<p>{err()}</p>
							</CalloutContent>
						</Callout>
					)}
				</Show>

				<Show when={success()}>
					{(msg) => (
						<Callout variant="success" class="mb-6">
							<CalloutContent>
								<p>{msg()}</p>
							</CalloutContent>
						</Callout>
					)}
				</Show>

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* track metadata section */}
					<div class="bg-stone-900/50 rounded-xl p-6">
						<h2 class="text-lg font-semibold text-white mb-4">Track Details</h2>

						<div class="space-y-4">
							<TextField value={title()} onChange={setTitle}>
								<TextFieldLabel>Title</TextFieldLabel>
								<TextFieldInput type="text" placeholder="Track title" />
							</TextField>

							<TextField value={description()} onChange={setDescription}>
								<TextFieldLabel>Description</TextFieldLabel>
								<TextFieldTextArea
									rows={3}
									placeholder="Track description"
									class="resize-none"
								/>
							</TextField>

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
										onChange={(e) => setSocialPromptEnabled(e.currentTarget.checked)}
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
										<TextFieldInput type="text" placeholder="Instagram username" />
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
								disabled={isSaving()}
								class="w-full"
							>
								{isSaving() ? "Saving..." : "Save Track Details"}
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
											setShowUpload(false)
											setUploadFile(null)
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
													disabled={isUploading()}
												>
													{isUploading() ? "Uploading..." : "Upload"}
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
																{new Date(version.createdAt).toLocaleDateString()}
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
																	onClick={() => handleSetActiveVersion(version.id)}
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
																	title={"Copy from v${otherVersion.versionNumber}"}
																	onClick={() =>
																		copyMetadataFromVersion(otherVersion)
																	}
																>
																	<Copy class="w-3 h-3 mr-1" />
																	v{otherVersion.versionNumber}
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
														onClick={() =>
															handleSaveVersionMetadata(version.id)
														}
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
						onClick={async () => {
							if (
								!confirm(
									"Are you sure you want to delete this track? This cannot be undone.",
								)
							) {
								return
							}

							try {
								const { deleteTrack } = await import("@/server/tracks");
								await deleteTrack({ data: { trackId: data().track.id } });
								navigate({ to: "/my-tracks" });
							} catch (err) {
								setError(
									err instanceof Error ? err.message : "Failed to delete track",
								)
							}
						}}
					>
						<Trash2 class="w-4 h-4 mr-2" />
						Delete Track
					</Button>
				</div>
			</div>
		</div>
	)
}

