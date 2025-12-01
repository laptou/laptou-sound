// version metadata editor component with its own form instance

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { useRouter } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import { For } from "solid-js";
import { toast } from "solid-sonner";
import type { TrackVersion } from "@/db/schema";
import { updateVersionMetadataMutationOptions } from "@/lib/track-queries";
import { FormField } from "./FormField";

type VersionEditorProps = {
	trackId: string;
	version: TrackVersion;
	otherVersions: TrackVersion[];
	onClose: () => void;
};

export function VersionEditor(props: VersionEditorProps) {
	const router = useRouter();
	const updateMutation = useMutation(() => updateVersionMetadataMutationOptions());

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
