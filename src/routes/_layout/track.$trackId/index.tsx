// track detail page with waveform player, versioning, comments, and download

import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import Download from "lucide-solid/icons/download";
import EyeOff from "lucide-solid/icons/eye-off";
import Eye from "lucide-solid/icons/eye";
import MessageCircle from "lucide-solid/icons/message-circle";
import Music from "lucide-solid/icons/music";
import Pencil from "lucide-solid/icons/pencil";
import Send from "lucide-solid/icons/send";
import Trash2 from "lucide-solid/icons/trash-2";
import { createMemo, createSignal, For, Show } from "solid-js";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import type { TrackVersion } from "@/db/schema";
import { wrapLoader } from "@/lib/loader-wrapper";
import { formatSmartDate } from "@/lib/utils";
import {
	type CommentInfo,
	createComment,
	deleteComment,
	getTrackComments,
	hideComment,
	unhideComment,
} from "@/server/comments";
import { getPlayCount, recordPlay } from "@/server/plays";
import {
	getStreamPresignedUrl,
	getTrack,
	getTrackVersions,
} from "@/server/tracks";
import { getUserInfo } from "@/server/users";

export const Route = createFileRoute("/_layout/track/$trackId/")({
	loader: wrapLoader("/track/$trackId", async ({ params, context }) => {
		const [track, versions, playCount] = await Promise.all([
			getTrack({ data: { trackId: params.trackId } }),
			getTrackVersions({ data: { trackId: params.trackId } }),
			getPlayCount({ data: { trackId: params.trackId } }),
		]);

		if (!track) {
			throw new Error("Track not found");
		}

		// check if current user can edit
		const session = context.session;
		const canEdit =
			session?.user &&
			(track.ownerId === session.user.id || session.user.role === "admin");
		const isAdmin = session?.user?.role === "admin";
		const isLoggedIn = !!session?.user;

		return {
			track,
			versions,
			playCount: playCount.count,
			canEdit: !!canEdit,
			isAdmin: !!isAdmin,
			isLoggedIn,
		};
	}),
	component: TrackDetailPage,
});

function TrackDetailPage() {
	const data = Route.useLoaderData();
	const queryClient = useQueryClient();

	// fetch owner info using tanstack query
	const ownerQuery = useQuery(() => ({
		queryKey: ["user", data().track.ownerId],
		queryFn: () => getUserInfo({ data: { userId: data().track.ownerId } }),
		staleTime: 1000 * 60 * 5, // cache for 5 min
	}));

	// fetch comments
	const commentsQuery = useQuery(() => ({
		queryKey: ["comments", data().track.id],
		queryFn: () => getTrackComments({ data: { trackId: data().track.id } }),
		staleTime: 1000 * 60, // cache for 1 min
	}));

	// comment form state
	const [newComment, setNewComment] = createSignal("");

	// comment mutations
	const createCommentMutation = useMutation(() => ({
		mutationFn: async (content: string) => {
			return createComment({ data: { trackId: data().track.id, content } });
		},
		onSuccess: () => {
			setNewComment("");
			queryClient.invalidateQueries({ queryKey: ["comments", data().track.id] });
		},
	}));

	const hideCommentMutation = useMutation(() => ({
		mutationFn: async (commentId: string) => {
			return hideComment({ data: { commentId } });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["comments", data().track.id] });
		},
	}));

	const unhideCommentMutation = useMutation(() => ({
		mutationFn: async (commentId: string) => {
			return unhideComment({ data: { commentId } });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["comments", data().track.id] });
		},
	}));

	const deleteCommentMutation = useMutation(() => ({
		mutationFn: async (commentId: string) => {
			return deleteComment({ data: { commentId } });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["comments", data().track.id] });
		},
	}));

	const handleSubmitComment = async (e: Event) => {
		e.preventDefault();
		const content = newComment().trim();
		if (!content) return;
		await createCommentMutation.mutateAsync(content);
	};

	// selected version id defaults to active version
	const [selectedVersionId, setSelectedVersionId] = createSignal<string | null>(
		data().track.activeVersion ?? null,
	);

	// derive selected version from id
	const selectedVersion = createMemo(() => {
		const id = selectedVersionId();
		if (!id) return null;
		return data().versions.find((v) => v.id === id) ?? null;
	});

	// playable version (complete and selected)
	const playableVersion = createMemo(() => {
		const version = selectedVersion();
		if (version && version.processingStatus === "complete") {
			return version;
		}
		return null;
	});

	// check if there are any complete versions available
	const hasCompleteVersion = createMemo(() =>
		data().versions.some((v) => v.processingStatus === "complete"),
	);

	// check if there are any versions still processing
	const hasProcessingVersions = createMemo(() =>
		data().versions.some(
			(v) =>
				v.processingStatus === "pending" || v.processingStatus === "processing",
		),
	);
	const [_showSocialPrompt, setShowSocialPrompt] = createSignal(false);

	const socialLinks = createMemo(() => {
		const links = data().track.socialLinks;
		if (!links) return null;
		try {
			return JSON.parse(links) as {
				instagram?: string;
				soundcloud?: string;
				tiktok?: string;
			};
		} catch {
			return null;
		}
	});

	const handlePlay = async () => {
		const version = selectedVersion();
		if (version) {
			await recordPlay({
				data: {
					trackId: data().track.id,
					versionId: version.id,
				},
			});
		}
	};

	const handleDownloadClick = () => {
		const track = data().track;
		if (track.socialPromptEnabled && socialLinks()) {
			setShowSocialPrompt(true);
		} else {
			initiateDownload();
		}
	};

	const initiateDownload = () => {
		const version = selectedVersion();
		if (!version?.originalKey) return;

		const link = document.createElement("a");
		link.href = `/files/${version.originalKey}`;
		link.download = `${data().track.title} v${version.versionNumber}`;
		link.click();
		setShowSocialPrompt(false);
	};

	// get presigned stream url for the selected version
	const streamUrlQuery = useQuery(() => {
		const version = selectedVersion();
		if (
			!version ||
			!version.streamKey ||
			version.processingStatus !== "complete"
		) {
			return {
				queryKey: ["stream-url", data().track.id, null],
				queryFn: async () => null,
				enabled: false,
			};
		}
		return {
			queryKey: ["stream-url", data().track.id, version.id],
			queryFn: async () => {
				if (import.meta.env.DEV) {
					return `/files/${version.streamKey}`;
				}

				const result = await getStreamPresignedUrl({
					data: {
						trackId: data().track.id,
						versionId: version.id,
					},
				});
				return result.url;
			},
			staleTime: 1000 * 60 * 50, // refresh 10 minutes before expiry (urls valid for 1 hour)
			gcTime: 1000 * 60 * 60, // cache for 1 hour
		};
	});

	const getStreamUrl = (version: TrackVersion): string | null => {
		// only return url if this is the selected version and query has data
		if (version.id !== selectedVersionId()) return null;
		return streamUrlQuery.data ?? null;
	};

	const getAlbumArtUrl = (version: TrackVersion): string | null => {
		if (!version.albumArtKey) return null;
		return `/files/${version.albumArtKey}`;
	};

	const formatPlayCount = (count: number) => {
		const formatter = new Intl.NumberFormat();
		const pluralRules = new Intl.PluralRules("en", { type: "cardinal" });
		let displayCount: string;

		if (count >= 1000000) {
			displayCount = `${(count / 1000000).toFixed(1)}M`;
		} else if (count >= 1000) {
			displayCount = `${(count / 1000).toFixed(1)}K`;
		} else {
			displayCount = formatter.format(count);
		}

		const plural = pluralRules.select(count);
		const playWord = plural === "one" ? "play" : "plays";

		return `${displayCount} ${playWord}`;
	};

	return (
		<>
			<div class="mb-8 flex flex-row items-center gap-6">
				{/* album art */}
				<Show when={playableVersion()}>
					{(version) => (
						<Show
							when={getAlbumArtUrl(version())}
							fallback={
								<div class="w-32 h-32 bg-stone-800 rounded-md flex items-center justify-center shrink-0 vt-track-album-art">
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
					<div class="flex items-start justify-between gap-4">
						<h1 class="text-4xl font-bold text-white mb-2 truncate vt-track-name w-fit">
							{data().track.title}
						</h1>
					</div>
					<Show when={data().track.description}>
						<p class="text-lg mb-4 opacity-70">{data().track.description}</p>
					</Show>
					<div class="text-sm vt-track-metadata">
						<span class="opacity-50">uploaded by </span>
						<span class="opacity-70">{ownerQuery.data?.name ?? "Unknown"}</span>
						<span class="opacity-50">&nbsp;&bull;&nbsp;</span>
						<span class="opacity-70">
							{formatSmartDate(data().track.createdAt)}
						</span>
						<span class="opacity-50">&nbsp;&bull;&nbsp;</span>
						<span class="opacity-50">{formatPlayCount(data().playCount)}</span>
					</div>
					<div>
						<Show when={data().canEdit}>
							<Link
								to={`/track/${data().track.id}/edit`}
								class="shrink-0 inline-flex items-center my-2 gap-2 px-3 py-1.5 bg-stone-800/80 hover:bg-stone-700/80 text-white/80 rounded-lg text-sm font-medium transition-colors"
							>
								<Pencil class="w-4 h-4" />
								Edit
							</Link>
						</Show>
					</div>
				</div>
			</div>

			{/* waveform player */}
			<Show
				when={playableVersion()}
				fallback={
					<div class="bg-stone-900/50 rounded-xl p-8 text-center">
						<Show
							when={hasProcessingVersions()}
							fallback={
								<>
									<p class="text-lg font-medium opacity-70">
										No playable version available
									</p>
									<p class="text-sm mt-2 opacity-50">
										{data().versions.length === 0
											? "No versions have been uploaded yet."
											: "All versions have failed processing or are not yet ready."}
									</p>
								</>
							}
						>
							<p class="text-lg font-medium opacity-70">Track is processing</p>
							<p class="text-sm mt-2 opacity-50">
								The track is being processed and will be available soon.
							</p>
							<Show when={hasCompleteVersion()}>
								<p class="text-xs mt-4 opacity-50">
									Note: You can select a previous version below while waiting.
								</p>
							</Show>
						</Show>
					</div>
				}
			>
				{(version) => (
					<WaveformPlayer
						trackId={data().track.id}
						versionId={version().id}
						streamUrl={getStreamUrl(version())}
						title={data().track.title}
						artist={version().artist ?? "Artist"}
						ownerName={ownerQuery.data?.name ?? null}
						albumArtUrl={getAlbumArtUrl(version())}
						duration={version().duration ?? undefined}
						onPlay={handlePlay}
						hideTitle
					/>
				)}
			</Show>

			{/* actions */}
			<div class="mt-6 flex items-center gap-4">
				<Show
					when={
						data().track.allowDownload &&
						selectedVersion() &&
						selectedVersion()?.processingStatus === "complete" &&
						selectedVersion()?.originalKey
					}
				>
					<button
						type="button"
						onClick={handleDownloadClick}
						class="inline-flex items-center gap-2 px-4 py-2 bg-stone-800/80 hover:bg-stone-700/80 text-white rounded-lg font-medium transition-colors"
					>
						<Download class="w-4 h-4" />
						Download
					</button>
				</Show>
			</div>

			{/* version selector */}
			<Show when={data().versions.length > 0}>
				<div class="mt-6">
					<h3 class="text-white font-medium mb-3">Versions</h3>
					<div class="flex flex-wrap gap-2">
						<For each={data().versions}>
							{(version) => (
								<button
									type="button"
									onClick={() => {
										if (version.processingStatus === "complete") {
											setSelectedVersionId(version.id);
										}
									}}
									disabled={version.processingStatus !== "complete"}
									class={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
										selectedVersionId() === version.id
											? "bg-violet-500 text-white"
											: version.processingStatus === "complete"
												? "bg-stone-800/80 text-white/70 hover:bg-stone-700/80"
												: "bg-stone-900/50 text-white/40 cursor-not-allowed"
									}`}
								>
									v{version.versionNumber}
									<Show when={version.processingStatus !== "complete"}>
										<span class="ml-2 text-xs opacity-70">
											({version.processingStatus})
										</span>
									</Show>
								</button>
							)}
						</For>
					</div>
				</div>
			</Show>

			{/* comments section */}
			<div class="mt-10">
				<div class="flex items-center gap-2 mb-4">
					<MessageCircle class="w-5 h-5 text-white/70" />
					<h3 class="text-white font-medium">
						Comments
						<Show when={commentsQuery.data?.length}>
							<span class="ml-2 text-white/50">
								({commentsQuery.data?.length})
							</span>
						</Show>
					</h3>
				</div>

				{/* add comment form */}
				<Show
					when={data().isLoggedIn}
					fallback={
						<div class="bg-stone-900/30 rounded-lg p-4 text-center text-white/50 text-sm mb-6">
							<Link to="/login" class="text-violet-400 hover:text-violet-300">
								Log in
							</Link>{" "}
							to leave a comment
						</div>
					}
				>
					<form onSubmit={handleSubmitComment} class="mb-6">
						<div class="flex gap-3">
							<textarea
								value={newComment()}
								onInput={(e) => setNewComment(e.currentTarget.value)}
								placeholder="Write a comment..."
								rows={2}
								class="flex-1 bg-stone-900/50 border border-stone-700/50 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
								disabled={createCommentMutation.isPending}
							/>
							<button
								type="submit"
								disabled={
									!newComment().trim() || createCommentMutation.isPending
								}
								class="self-end px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-stone-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
							>
								<Send class="w-4 h-4" />
							</button>
						</div>
						<Show when={createCommentMutation.isError}>
							<p class="mt-2 text-red-400 text-sm">
								{createCommentMutation.error?.message ?? "Failed to post comment"}
							</p>
						</Show>
					</form>
				</Show>

				{/* comments list */}
				<Show
					when={!commentsQuery.isLoading}
					fallback={
						<div class="text-white/50 text-sm">Loading comments...</div>
					}
				>
					<Show
						when={commentsQuery.data && commentsQuery.data.length > 0}
						fallback={
							<div class="text-white/40 text-sm py-4">
								No comments yet. Be the first to comment!
							</div>
						}
					>
						<div class="space-y-4">
							<For each={commentsQuery.data}>
								{(comment) => (
									<CommentCard
										comment={comment}
										isAdmin={data().isAdmin}
										onHide={() => hideCommentMutation.mutate(comment.id)}
										onUnhide={() => unhideCommentMutation.mutate(comment.id)}
										onDelete={() => deleteCommentMutation.mutate(comment.id)}
										isHiding={hideCommentMutation.isPending}
										isUnhiding={unhideCommentMutation.isPending}
										isDeleting={deleteCommentMutation.isPending}
									/>
								)}
							</For>
						</div>
					</Show>
				</Show>
			</div>

			{/* debug info */}
			<Show when={import.meta.env.DEV}>
				<div class="mt-8 bg-stone-900/30 rounded-lg p-4 text-xs">
					<div class="opacity-70 mb-2 font-medium">
						Debug Info (TrackDetailPage)
					</div>
					<div class="space-y-1 opacity-50 font-mono">
						<div>versions.length: {data().versions.length}</div>
						<div>selectedVersionId: {selectedVersionId() ?? "null"}</div>
						<div>selectedVersion: {selectedVersion()?.id ?? "null"}</div>
						<div>activeVersion: {data().track.activeVersion ?? "null"}</div>
						<Show when={selectedVersion()}>
							{(version) => (
								<div class="mt-2 pt-2 border-t border-stone-800">
									<div>streamUrl: {getStreamUrl(version()) ?? "null"}</div>
									<div>streamKey: {version().streamKey ?? "null"}</div>
									<div>artist: {version().artist ?? "null"}</div>
									<div>album: {version().album ?? "null"}</div>
									<div>codec: {version().codec ?? "null"}</div>
								</div>
							)}
						</Show>
					</div>
				</div>
			</Show>
		</>
	);
}

// individual comment card component
function CommentCard(props: {
	comment: CommentInfo;
	isAdmin: boolean;
	onHide: () => void;
	onUnhide: () => void;
	onDelete: () => void;
	isHiding: boolean;
	isUnhiding: boolean;
	isDeleting: boolean;
}) {
	const isHidden = () => props.comment.hidden;
	const canHide = () => props.comment.isOwn || props.isAdmin;
	const canUnhide = () => props.isAdmin;
	const canDelete = () => props.isAdmin;

	return (
		<div
			class={`p-4 rounded-lg transition-all ${
				isHidden()
					? "bg-stone-900/20 border border-stone-800/50"
					: "bg-stone-900/40"
			}`}
		>
			<div class="flex items-start gap-3">
				{/* avatar */}
				<Show
					when={props.comment.userImage}
					fallback={
						<div class="w-9 h-9 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
							<span class="text-sm text-white/60">
								{props.comment.userName.charAt(0).toUpperCase()}
							</span>
						</div>
					}
				>
					{(imageUrl) => (
						<img
							src={imageUrl()}
							alt={props.comment.userName}
							class="w-9 h-9 rounded-full object-cover shrink-0"
						/>
					)}
				</Show>

				<div class="flex-1 min-w-0">
					{/* header */}
					<div class="flex items-center gap-2 flex-wrap">
						<span class="font-medium text-white/90 text-sm">
							{props.comment.userName}
						</span>
						<span class="text-white/40 text-xs">
							{formatSmartDate(props.comment.createdAt)}
						</span>
						<Show when={isHidden()}>
							<span class="text-amber-500/70 text-xs flex items-center gap-1">
								<EyeOff class="w-3 h-3" />
								hidden
							</span>
						</Show>
					</div>

					{/* content */}
					<p
						class={`mt-1 text-sm whitespace-pre-wrap break-words ${
							isHidden() ? "text-white/40 italic" : "text-white/80"
						}`}
					>
						{props.comment.content}
					</p>

					{/* actions */}
					<div class="flex items-center gap-2 mt-2">
						<Show when={canHide() && !isHidden()}>
							<button
								type="button"
								onClick={props.onHide}
								disabled={props.isHiding}
								class="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors disabled:opacity-50"
								title="Hide comment"
							>
								<EyeOff class="w-3.5 h-3.5" />
								Hide
							</button>
						</Show>

						<Show when={canUnhide() && isHidden()}>
							<button
								type="button"
								onClick={props.onUnhide}
								disabled={props.isUnhiding}
								class="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors disabled:opacity-50"
								title="Unhide comment"
							>
								<Eye class="w-3.5 h-3.5" />
								Unhide
							</button>
						</Show>

						<Show when={canDelete()}>
							<button
								type="button"
								onClick={props.onDelete}
								disabled={props.isDeleting}
								class="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 transition-colors disabled:opacity-50"
								title="Delete comment"
							>
								<Trash2 class="w-3.5 h-3.5" />
								Delete
							</button>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
}
