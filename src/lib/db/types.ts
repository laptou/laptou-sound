// database types for laptou sound

export type UserRole = "commenter" | "uploader" | "admin";
export type ProcessingStatus = "pending" | "processing" | "complete" | "failed";

// better auth managed tables
export interface User {
	id: string;
	email: string;
	name: string | null;
	email_verified: number; // sqlite boolean
	image: string | null;
	created_at: string;
	updated_at: string;
}

export interface Session {
	id: string;
	user_id: string;
	token: string;
	expires_at: string;
	ip_address: string | null;
	user_agent: string | null;
	created_at: string;
	updated_at: string;
}

// application tables
export interface UserRoleRecord {
	id: string;
	user_id: string;
	role: UserRole;
	created_at: string;
	updated_at: string;
}

export interface InviteCode {
	id: string;
	code: string;
	role: "uploader" | "admin";
	created_by: string;
	used_by: string | null;
	used_at: string | null;
	expires_at: string | null;
	created_at: string;
}

export interface Track {
	id: string;
	uploader_id: string;
	title: string;
	description: string | null;
	cover_key: string | null;
	is_downloadable: number; // sqlite boolean
	social_prompt: string | null; // json string
	created_at: string;
	updated_at: string;
}

export interface TrackVersion {
	id: string;
	track_id: string;
	version_number: number;
	original_key: string;
	playback_key: string | null;
	waveform_key: string | null;
	duration: number | null; // seconds
	processing_status: ProcessingStatus;
	created_at: string;
}

export interface PlayCount {
	id: string;
	track_version_id: string;
	session_id: string | null;
	user_id: string | null;
	played_at: string;
}

export interface Comment {
	id: string;
	track_id: string;
	user_id: string;
	content: string;
	timestamp_seconds: number | null;
	created_at: string;
	updated_at: string;
}

// social prompt structure
export interface SocialPrompt {
	instagram?: string;
	soundcloud?: string;
	tiktok?: string;
}

// joined types for queries
export interface TrackWithUploader extends Track {
	uploader_name: string | null;
	uploader_image: string | null;
}

export interface TrackWithLatestVersion extends Track {
	latest_version_id: string | null;
	playback_key: string | null;
	waveform_key: string | null;
	duration: number | null;
	processing_status: ProcessingStatus | null;
}

export interface CommentWithUser extends Comment {
	user_name: string | null;
	user_image: string | null;
}
