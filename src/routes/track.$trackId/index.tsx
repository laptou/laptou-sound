// track detail page with waveform player, versioning, and download

import { createFileRoute, Link } from "@tanstack/solid-router";
import Download from "lucide-solid/icons/download";
import Music from "lucide-solid/icons/music";
import Pencil from "lucide-solid/icons/pencil";
import { createMemo, createSignal, For, Show } from "solid-js";
import SocialPromptModal from "@/components/SocialPromptModal";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import type { TrackVersion } from "@/db/schema";
import { wrapLoader } from "@/lib/loader-wrapper";
import { getPlayCount, recordPlay } from "@/server/plays";
import { getTrack, getTrackVersions } from "@/server/tracks";

export const Route = createFileRoute("/track/$trackId/")({
	loader: wrapLoader("/track/$trackId", async ({ params, context }) => {
		const [track, versions, playCount] = await Promise.all([
			getTrack({ data: { trackId: params.trackId } }),
			getTrackVersions({ data: { trackId: params.trackId } }),
			getPlayCount({ data: { trackId: params.trackId } }),
		])

		if (!track) {
			throw new Error("Track not found");
		}

		// check if current user can edit
		const session = context.session;
		const canEdit =
			session?.user &&
			(track.ownerId === session.user.id || session.user.role === "admin");

		return { track, versions, playCount: playCount.count, canEdit: !!canEdit };
	}),
	component: TrackDetailPage,
});

function TrackDetailPage() {
	const data = Route.useLoaderData();

	// selected version id defaults to active version
	const [selectedVersionId, setSelectedVersionId] = createSignal<string | null>(
		data().track.activeVersion ?? null,
	)

	// derive selected version from id
	const selectedVersion = createMemo(() => {
		const id = selectedVersionId();
		if (!id) return null;
		return data().versions.find((v) => v.id === id) ?? null;
	})

	// playable version (complete and selected)
	const playableVersion = createMemo(() => {
		const version = selectedVersion();
		if (version && version.processingStatus === "complete") {
			return version;
		}
		return null;
	})

	// check if there are any complete versions available
	const hasCompleteVersion = createMemo(() =>
		data().versions.some((v) => v.processingStatus === "complete"),
	)

	// check if there are any versions still processing
	const hasProcessingVersions = createMemo(() =>
		data().versions.some(
			(v) =>
				v.processingStatus === "pending" || v.processingStatus === "processing",
		),
	)
	const [showSocialPrompt, setShowSocialPrompt] = createSignal(false);

	const socialLinks = createMemo(() => {
		const links = data().track.socialLinks;
		if (!links) return null;
		try {
			return JSON.parse(links) as {
				instagram?: string;
				soundcloud?: string;
				tiktok?: string;
			}
		} catch {
			return null;
		}
	})

	const handlePlay = async () => {
		const version = selectedVersion();
		if (version) {
			await recordPlay({
				data: {
					trackId: data().track.id,
					versionId: version.id,
				},
			})
		}
	}

	const handleDownloadClick = () => {
		const track = data().track;
		if (track.socialPromptEnabled && socialLinks()) {
			setShowSocialPrompt(true);
		} else {
			initiateDownload();
		}
	}

	const initiateDownload = () => {
		const version = selectedVersion();
		if (!version?.originalKey) return;

		const link = document.createElement("a");
		link.href = `/files/${version.originalKey}`;
		link.download = `${data().track.title} v${version.versionNumber}`;
		link.click();
		setShowSocialPrompt(false);
	}

	const getStreamUrl = (version: TrackVersion): string | null => {
		if (!version.streamKey) return null;
		return `/files/${version.streamKey}`;
	}

	const getAlbumArtUrl = (version: TrackVersion): string | null => {
		if (!version.albumArtKey) return null;
		return `/files/${version.albumArtKey}`;
	}

	const formatPlayCount = (count: number) => {
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}

	return (
		<div class="min-h-screen bg-linear-to-b from-stone-900 via-stone-950 to-stone-900 py-12 px-6 relative">
			<div class="absolute inset-0 bg-linear-to-br from-violet-500 via-indigo-500 to-purple-500 mask-radial-at-top mask-circle mask-radial-from-0% mask-contain opacity-30 z-0" />
			<div class="max-w-4xl mx-auto relative z-10">
				{/* track header */}
				<div class="mb-8 flex gap-6">
					{/* album art */}
					<Show when={playableVersion()}>
						{(version) => (
							<Show
								when={getAlbumArtUrl(version())}
								fallback={
									<div class="w-32 h-32 bg-stone-800 rounded-lg flex items-center justify-center shrink-0">
										<Music class="w-12 h-12 text-stone-600" />
									</div>
								}
							>
								{(url) => (
									<img
										src={url()}
										alt="Album art"
										class="w-32 h-32 rounded-lg object-cover shadow-lg shrink-0"
									/>
								)}
							</Show>
						)}
					</Show>

					<div class="min-w-0 flex-1">
						<div class="flex items-start justify-between gap-4">
							<h1 class="text-4xl font-bold text-white mb-2 truncate">
								{data().track.title}
							</h1>
							<Show when={data().canEdit}>
								<Link
									to={`/track/${data().track.id}/edit`}
									class="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-stone-800/80 hover:bg-stone-700/80 text-white/80 rounded-lg text-sm font-medium transition-colors"
								>
									<Pencil class="w-4 h-4" />
									Edit
								</Link>
							</Show>
						</div>
						<Show when={data().track.description}>
							<p class="text-lg mb-4 opacity-70">
								{data().track.description}
							</p>
						</Show>
						<div class="flex items-center gap-4 text-sm opacity-50">
							<span>{formatPlayCount(data().playCount)} plays</span>
							<span>•</span>
							<span>
								{new Date(data().track.createdAt).toLocaleDateString()}
							</span>
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
								<p class="text-lg font-medium opacity-70">
									Track is processing
								</p>
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
							streamUrl={getStreamUrl(version())}
							title={data().track.title}
							artist={version().artist ?? "Artist"}
							duration={version().duration ?? undefined}
							onPlay={handlePlay}
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
						<h3 class="text-white font-medium mb-3">
							Versions{" "}
							{data().versions.length > 1 && `(${data().versions.length})`}
						</h3>
						<div class="flex flex-wrap gap-2">
							<For each={data().versions}>
								{(version) => (
									<button
										type="button"
										onClick={() => {
											if (version.processingStatus === "complete") {
												setSelectedVersionId(version.id)
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

				{/* track info */}
				<div class="mt-8 grid grid-cols-2 gap-4 text-sm">
					<div class="bg-stone-900/50 rounded-lg p-4">
						<span class="opacity-50">Uploaded</span>
						<p class="text-white">
							{new Date(data().track.createdAt).toLocaleDateString()}
						</p>
					</div>
					<div class="bg-stone-900/50 rounded-lg p-4">
						<span class="opacity-50">Versions</span>
						<p class="text-white">{data().versions.length}</p>
					</div>
				</div>

				{/* debug info */}
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
			</div>

			{/* social prompt modal */}
			<SocialPromptModal
				isOpen={showSocialPrompt()}
				onClose={() => setShowSocialPrompt(false)}
				onDownload={initiateDownload}
				artistName="the artist"
				socialLinks={socialLinks()}
			/>
		</div>
	)
}
