// track query and mutation options

import type { MutationOptions } from "@tanstack/solid-query";
import {
	deleteTrack,
	deleteTrackVersion,
	setActiveVersion,
	updateTrack,
	updateVersionMetadata,
	uploadAlbumArt,
} from "@/server/tracks";

// update track metadata mutation
export const updateTrackMutationOptions = () =>
	({
		mutationFn: async (variables: {
			trackId: string;
			title?: string;
			description?: string;
			isPublic?: boolean;
			allowDownload?: boolean;
			socialPromptEnabled?: boolean;
			socialLinks?: {
				instagram?: string;
				soundcloud?: string;
				tiktok?: string;
			};
		}) => await updateTrack({ data: variables }),
	}) satisfies MutationOptions;

// set active version mutation
export const setActiveVersionMutationOptions = () =>
	({
		mutationFn: async (variables: { trackId: string; versionId: string }) =>
			await setActiveVersion({ data: variables }),
	}) satisfies MutationOptions;

// delete track version mutation
export const deleteTrackVersionMutationOptions = () =>
	({
		mutationFn: async (variables: { trackId: string; versionId: string }) =>
			await deleteTrackVersion({ data: variables }),
	}) satisfies MutationOptions;

// update version metadata mutation
export const updateVersionMetadataMutationOptions = () =>
	({
		mutationFn: async (variables: {
			trackId: string;
			versionId: string;
			artist?: string | null;
			album?: string | null;
			genre?: string | null;
			year?: number | null;
		}) => await updateVersionMetadata({ data: variables }),
	}) satisfies MutationOptions;

// upload track version mutation (uses api route for formdata)
export const uploadTrackVersionMutationOptions = () =>
	({
		mutationFn: async (variables: { trackId: string; file: File }) => {
			const formData = new FormData();
			formData.append("file", variables.file);
			formData.append("trackId", variables.trackId);

			const response = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const error = (await response.json().catch(() => ({
					error: "Upload failed",
				}))) as { error?: string };
				throw new Error(error.error || "Upload failed");
			}

			return await response.json();
		},
	}) satisfies MutationOptions;

// delete track mutation
export const deleteTrackMutationOptions = () =>
	({
		mutationFn: async (variables: { trackId: string }) =>
			await deleteTrack({ data: variables }),
	}) satisfies MutationOptions;

// upload album art mutation - calls server function with FormData
export const uploadAlbumArtMutationOptions = () =>
	({
		mutationFn: async (variables: {
			trackId: string;
			versionId: string;
			file: File;
		}) => {
			const formData = new FormData();
			formData.append("file", variables.file);
			formData.append("trackId", variables.trackId);
			formData.append("versionId", variables.versionId);

			return await uploadAlbumArt({ data: formData });
		},
	}) satisfies MutationOptions;
