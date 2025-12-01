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
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldTextArea,
} from "@ui/text-field";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import Music from "lucide-solid/icons/music";
import Pencil from "lucide-solid/icons/pencil";
import Plus from "lucide-solid/icons/plus";
import Star from "lucide-solid/icons/star";
import Trash2 from "lucide-solid/icons/trash-2";
import X from "lucide-solid/icons/x";
import { createMemo, createSignal, For, Show } from "solid-js";
import { toast } from "solid-sonner";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FormCheckboxSimple, FormField } from "@/components/FormField";
import { VersionEditor } from "@/components/VersionEditor";
import type { TrackVersion } from "@/db/schema";
import { AccessDeniedError } from "@/lib/errors";
import { wrapLoader } from "@/lib/loader-wrapper";
import {
	deleteTrackMutationOptions,
	deleteTrackVersionMutationOptions,
	setActiveVersionMutationOptions,
	updateTrackMutationOptions,
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

	// track metadata form
	const trackForm = createForm(() => {
		const track = data().track;
		const socialLinks = parseSocialLinks(track.socialLinks);

		return {
			defaultValues: {
				title: track.title,
				description: track.description ?? "",
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
						title: value.title,
						description: value.description || undefined,
						isPublic: value.isPublic,
						allowDownload: value.allowDownload,
						socialPromptEnabled: value.socialPromptEnabled,
						socialLinks: {
							instagram: value.instagram || undefined,
							soundcloud: value.soundcloud || undefined,
							tiktok: value.tiktok || undefined,
						},
					});
					toast.success("Track saved successfully");
					router.load();
				} catch (err) {
					toast.error(
						err instanceof Error ? err.message : "Failed to save track",
					);
					throw err;
				}
			},
		};
	});

	// ui state
	const [editingVersionId, setEditingVersionId] = createSignal<string | null>(
		null,
	);
	const [showUpload, setShowUpload] = createSignal(false);
	const [uploadFile, setUploadFile] = createSignal<File | null>(null);

	// get active version for album art
	const activeVersion = createMemo(() => {
		const activeId = data().track.activeVersion;
		if (!activeId) return null;
		return data().versions.find((v) => v.id === activeId) ?? null;
	});

	const handleSetActiveVersion = async (versionId: string) => {
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

	// watch social prompt toggle to show/hide social links
	const socialPromptEnabled = trackForm.useStore(
		(state) => state.values.socialPromptEnabled,
	);

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
									class="w-32 h-32 rounded-md object-cover shadow-lg shrink-0 vt-track-album-art"
								/>
							)}
						</Show>
					)}
				</Show>

				<div class="min-w-0 flex-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: `/track/${data().track.id}` })}
						class="mb-2"
					>
						<ChevronLeft class="w-4 h-4 mr-1" />
						Back
					</Button>

					{/* title field - custom styling so not using FormField */}
					<div class="flex items-start justify-between gap-4">
						<trackForm.Field
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
									class="flex-1"
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
						</trackForm.Field>
					</div>

					{/* description field - custom styling */}
					<trackForm.Field name="description">
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
					</trackForm.Field>
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* track metadata section */}
				<div class="bg-stone-900/50 rounded-xl p-6">
					<h2 class="text-lg font-semibold text-white mb-4">Permissions</h2>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							trackForm.handleSubmit();
						}}
						class="space-y-4"
					>
						<div class="space-y-3">
							<trackForm.Field name="isPublic">
								{(field) => <FormCheckboxSimple field={field} label="Public" />}
							</trackForm.Field>

							<trackForm.Field name="allowDownload">
								{(field) => (
									<FormCheckboxSimple field={field} label="Allow Downloads" />
								)}
							</trackForm.Field>

							<trackForm.Field name="socialPromptEnabled">
								{(field) => (
									<FormCheckboxSimple
										field={field}
										label="Prompt for Social Follow"
									/>
								)}
							</trackForm.Field>
						</div>

						{/* social links */}
						<Show when={socialPromptEnabled()}>
							<div class="pt-4 border-t border-stone-800 space-y-3">
								<Label class="text-sm opacity-70">Social Links</Label>

								<trackForm.Field name="instagram">
									{(field) => (
										<FormField
											field={field}
											label="Instagram"
											placeholder="Instagram username"
										/>
									)}
								</trackForm.Field>

								<trackForm.Field name="soundcloud">
									{(field) => (
										<FormField
											field={field}
											label="SoundCloud"
											placeholder="SoundCloud URL"
										/>
									)}
								</trackForm.Field>

								<trackForm.Field name="tiktok">
									{(field) => (
										<FormField
											field={field}
											label="TikTok"
											placeholder="TikTok username"
										/>
									)}
								</trackForm.Field>
							</div>
						</Show>

						<trackForm.Subscribe
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
						</trackForm.Subscribe>
					</form>
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
										when={editingVersionId() === version.id}
										fallback={
											<VersionDisplay
												version={version}
												isActive={data().track.activeVersion === version.id}
												getAlbumArtUrl={getAlbumArtUrl}
												formatDuration={formatDuration}
												formatBitrate={formatBitrate}
												onSetActive={() => handleSetActiveVersion(version.id)}
												onEdit={() => setEditingVersionId(version.id)}
												onDelete={() => handleDeleteVersion(version.id)}
											/>
										}
									>
										<VersionEditor
											trackId={data().track.id}
											version={version}
											otherVersions={data().versions.filter(
												(v) => v.id !== version.id,
											)}
											onClose={() => setEditingVersionId(null)}
										/>
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

// version display component (read-only view)
type VersionDisplayProps = {
	version: TrackVersion;
	isActive: boolean;
	getAlbumArtUrl: (v: TrackVersion) => string | null;
	formatDuration: (s: number | null) => string;
	formatBitrate: (b: number | null) => string;
	onSetActive: () => void;
	onEdit: () => void;
	onDelete: () => void;
};

function VersionDisplay(props: VersionDisplayProps) {
	return (
		<>
			<div class="flex items-start justify-between mb-3">
				<div class="flex items-center gap-3">
					<Show
						when={props.getAlbumArtUrl(props.version)}
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
								v{props.version.versionNumber}
							</span>
							<Show when={props.isActive}>
								<span class="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded">
									Active
								</span>
							</Show>
							<span
								class={`px-2 py-0.5 text-xs rounded ${
									props.version.processingStatus === "complete"
										? "bg-green-500/20 text-green-300"
										: props.version.processingStatus === "failed"
											? "bg-red-500/20 text-red-300"
											: "bg-yellow-500/20 text-yellow-300"
								}`}
							>
								{props.version.processingStatus}
							</span>
						</div>
						<p class="text-xs opacity-50">
							{new Date(props.version.createdAt).toLocaleDateString()}
						</p>
					</div>
				</div>

				<div class="flex gap-1">
					<Show
						when={
							props.version.processingStatus === "complete" && !props.isActive
						}
					>
						<Button
							variant="ghost"
							size="icon"
							title="Set as active"
							onClick={props.onSetActive}
						>
							<Star class="w-4 h-4" />
						</Button>
					</Show>
					<Button
						variant="ghost"
						size="icon"
						title="Edit metadata"
						onClick={props.onEdit}
					>
						<Pencil class="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						title="Delete version"
						onClick={props.onDelete}
					>
						<Trash2 class="w-4 h-4 text-red-400" />
					</Button>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-2 text-xs">
				<div>
					<span class="opacity-50">Duration:</span>{" "}
					<span class="opacity-70">
						{props.formatDuration(props.version.duration)}
					</span>
				</div>
				<div>
					<span class="opacity-50">Bitrate:</span>{" "}
					<span class="opacity-70">
						{props.formatBitrate(props.version.bitrate)}
					</span>
				</div>
				<Show when={props.version.artist}>
					<div>
						<span class="opacity-50">Artist:</span>{" "}
						<span class="opacity-70">{props.version.artist}</span>
					</div>
				</Show>
				<Show when={props.version.album}>
					<div>
						<span class="opacity-50">Album:</span>{" "}
						<span class="opacity-70">{props.version.album}</span>
					</div>
				</Show>
				<Show when={props.version.genre}>
					<div>
						<span class="opacity-50">Genre:</span>{" "}
						<span class="opacity-70">{props.version.genre}</span>
					</div>
				</Show>
				<Show when={props.version.year}>
					<div>
						<span class="opacity-50">Year:</span>{" "}
						<span class="opacity-70">{props.version.year}</span>
					</div>
				</Show>
			</div>
		</>
	);
}
