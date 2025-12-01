// track query and mutation options

import type { MutationOptions } from "@tanstack/solid-query";
import {
	confirmAlbumArtUpload,
	confirmTrackUpload,
	deleteTrack,
	deleteTrackVersion,
	getAlbumArtUploadUrl,
	getTrackUploadUrl,
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

// upload track version mutation
// uses presigned urls in production, indirect upload in development
export const uploadTrackVersionMutationOptions = () =>
	({
		mutationFn: async (variables: { trackId: string; file: File }) => {
			const ext = variables.file.name.split(".").pop() || "mp3";

			// get upload url
			const uploadInfo = await getTrackUploadUrl({
				data: {
					trackId: variables.trackId,
					contentType: variables.file.type,
					fileExtension: ext,
				},
			});

			if (uploadInfo.mode === "presigned") {
				// upload directly to presigned url
				const response = await fetch(uploadInfo.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": variables.file.type },
					body: variables.file,
				});

				if (!response.ok) {
					throw new Error("Upload failed");
				}

				// confirm upload to create version record and trigger processing
				return await confirmTrackUpload({
					data: {
						trackId: uploadInfo.trackId,
						versionId: uploadInfo.versionId,
						versionNumber: uploadInfo.versionNumber,
						originalKey: uploadInfo.originalKey,
					},
				});
			}

			// indirect upload through our api
			const formData = new FormData();
			formData.append("file", variables.file);
			formData.append("trackId", variables.trackId);

			const response = await fetch(uploadInfo.uploadUrl, {
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

// upload album art mutation
// uses presigned urls in production, indirect upload in development
export const uploadAlbumArtMutationOptions = () =>
	({
		mutationFn: async (variables: {
			trackId: string;
			versionId: string;
			file: File;
		}) => {
			const ext = variables.file.name.split(".").pop() || "png";

			// get upload url
			const uploadInfo = await getAlbumArtUploadUrl({
				data: {
					trackId: variables.trackId,
					versionId: variables.versionId,
					contentType: variables.file.type,
					fileExtension: ext,
				},
			});

			if (uploadInfo.mode === "presigned") {
				// upload directly to presigned url
				const response = await fetch(uploadInfo.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": variables.file.type },
					body: variables.file,
				});

				if (!response.ok) {
					throw new Error("Upload failed");
				}

				// confirm upload to trigger processing
				return await confirmAlbumArtUpload({
					data: {
						trackId: uploadInfo.trackId,
						versionId: uploadInfo.versionId,
						tempKey: uploadInfo.tempKey,
					},
				});
			}

			// indirect upload through our api
			const formData = new FormData();
			formData.append("file", variables.file);
			formData.append("trackId", variables.trackId);
			formData.append("versionId", variables.versionId);

			const response = await fetch(uploadInfo.uploadUrl, {
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

// legacy direct upload mutation for backward compatibility
export const uploadAlbumArtDirectMutationOptions = () =>
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
