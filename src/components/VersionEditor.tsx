// version metadata editor component with its own form instance

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { useRouter } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import ImagePlus from "lucide-solid/icons/image-plus";
import Music from "lucide-solid/icons/music";
import { createSignal, For, Show } from "solid-js";
import { toast } from "solid-sonner";
import type { TrackVersion } from "@/db/schema";
import {
	updateVersionMetadataMutationOptions,
	uploadAlbumArtMutationOptions,
} from "@/lib/track-queries";
import { FormField } from "./FormField";

type VersionEditorProps = {
	trackId: string;
	version: TrackVersion;
	otherVersions: TrackVersion[];
	onClose: () => void;
};

export function VersionEditor(props: VersionEditorProps) {
	const router = useRouter();
	const updateMutation = useMutation(() =>
		updateVersionMetadataMutationOptions(),
	);
	const uploadAlbumArtMutation = useMutation(() =>
		uploadAlbumArtMutationOptions(),
	);

	// album art preview state
	const [albumArtPreview, setAlbumArtPreview] = createSignal<string | null>(
		null,
	);

	const form = createForm(() => ({
		defaultValues: {
			artist: props.version.artist ?? "",
			album: props.version.album ?? "",
			genre: props.version.genre ?? "",
			year: props.version.year?.toString() ?? "",
		},
		onSubmit: async ({ value }) => {
			try {
				await updateMutation.mutateAsync({
					trackId: props.trackId,
					versionId: props.version.id,
					artist: value.artist || null,
					album: value.album || null,
					genre: value.genre || null,
					year: value.year ? parseInt(value.year, 10) : null,
				});
				toast.success("Version metadata saved");
				props.onClose();
				router.load();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to save metadata",
				);
				throw err;
			}
		},
	}));

	const copyMetadataFromVersion = (source: TrackVersion) => {
		form.setFieldValue("artist", source.artist ?? "");
		form.setFieldValue("album", source.album ?? "");
		form.setFieldValue("genre", source.genre ?? "");
		form.setFieldValue("year", source.year?.toString() ?? "");
	};

	const getAlbumArtUrl = (): string | null => {
		// use preview if we have one (newly selected file)
		if (albumArtPreview()) return albumArtPreview();
		// otherwise use existing album art
		if (props.version.albumArtKey) return `/files/${props.version.albumArtKey}`;
		return null;
	};

	const handleAlbumArtSelect = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

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
				trackId: props.trackId,
				versionId: props.version.id,
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

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			class="space-y-3"
		>
			<div class="flex items-center justify-between">
				<span class="text-white font-medium">
					Edit v{props.version.versionNumber} Metadata
				</span>
				<div class="flex gap-1">
					<For each={props.otherVersions}>
						{(otherVersion) => (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								title={`Copy from v${otherVersion.versionNumber}`}
								onClick={() => copyMetadataFromVersion(otherVersion)}
							>
								<Copy class="w-3 h-3 mr-1" />v{otherVersion.versionNumber}
							</Button>
						)}
					</For>
				</div>
			</div>

			{/* album art section */}
			<div class="flex gap-4">
				<div class="shrink-0">
					<div class="relative group">
						<Show
							when={getAlbumArtUrl()}
							fallback={
								<div class="w-20 h-20 bg-stone-700 rounded flex items-center justify-center">
									<Music class="w-8 h-8 opacity-50" />
								</div>
							}
						>
							{(url) => (
								<img
									src={url()}
									alt="Album art"
									class="w-20 h-20 rounded object-cover"
								/>
							)}
						</Show>
						{/* upload overlay */}
						<label class="absolute inset-0 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
							<Show
								when={!uploadAlbumArtMutation.isPending}
								fallback={<div class="text-white text-xs">Uploading...</div>}
							>
								<div class="flex flex-col items-center text-white">
									<ImagePlus class="w-5 h-5 mb-1" />
									<span class="text-xs">Change</span>
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
					<p class="text-xs text-center mt-1 opacity-50">Album Art</p>
				</div>

				<div class="flex-1 space-y-2">
					<form.Field name="artist">
						{(field) => (
							<FormField
								field={field}
								label="Artist"
								placeholder="Artist name"
								inputClass="text-sm"
							/>
						)}
					</form.Field>

					<form.Field name="album">
						{(field) => (
							<FormField
								field={field}
								label="Album"
								placeholder="Album name"
								inputClass="text-sm"
							/>
						)}
					</form.Field>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<form.Field name="genre">
					{(field) => (
						<FormField
							field={field}
							label="Genre"
							placeholder="Genre"
							inputClass="text-sm"
						/>
					)}
				</form.Field>

				<form.Field name="year">
					{(field) => (
						<FormField
							field={field}
							label="Year"
							placeholder="Year"
							inputClass="text-sm"
						/>
					)}
				</form.Field>
			</div>

			<div class="flex gap-2">
				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => (
						<Button
							type="submit"
							size="sm"
							disabled={!state().canSubmit || state().isSubmitting}
						>
							<Check class="w-4 h-4 mr-1" />
							{state().isSubmitting ? "Saving..." : "Save"}
						</Button>
					)}
				</form.Subscribe>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={props.onClose}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
