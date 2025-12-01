// queue job type definitions

export interface AudioProcessingJob {
	type: "process_audio";
	trackId: string;
	versionId: string;
	originalKey: string;
}

export interface DeleteTrackJob {
	type: "delete_track";
	trackId: string;
}

// job to regenerate the download file with updated metadata/album art
export interface UpdateMetadataJob {
	type: "update_metadata";
	trackId: string;
	versionId: string;
}

// job to process uploaded profile photo (resize to standard size/format)
export interface ProcessProfilePhotoJob {
	type: "process_profile_photo";
	userId: string;
	tempKey: string; // temp upload location
}

// job to process uploaded album art (resize to standard size/format)
export interface ProcessAlbumArtJob {
	type: "process_album_art";
	trackId: string;
	versionId: string;
	tempKey: string; // temp upload location
}

export type QueueMessage =
	| AudioProcessingJob
	| DeleteTrackJob
	| UpdateMetadataJob
	| ProcessProfilePhotoJob
	| ProcessAlbumArtJob;

