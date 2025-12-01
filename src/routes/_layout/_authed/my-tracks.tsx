// my tracks page - manage user's own tracks

import { createFileRoute, Link } from "@tanstack/solid-router";
import Edit2 from "lucide-solid/icons/edit-2";
import Music from "lucide-solid/icons/music";
import Plus from "lucide-solid/icons/plus";
import Trash2 from "lucide-solid/icons/trash-2";
import { createSignal, For, Show } from "solid-js";
import { formatSmartDate } from "@/lib/utils";
import type { MyTrackInfo } from "@/server/tracks";
import { deleteTrack, getMyTracks } from "@/server/tracks";

export const Route = createFileRoute("/_layout/_authed/my-tracks")({
	loader: async () => {
		const tracks = await getMyTracks();
		return { tracks };
	},
	component: MyTracksPage,
});

function MyTracksPage() {
	const data = Route.useLoaderData();
	const [deletingId, setDeletingId] = createSignal<string | null>(null);

	const handleDelete = async (track: MyTrackInfo) => {
		if (!confirm(`Are you sure you want to delete "${track.title}"?`)) {
			return;
		}

		setDeletingId(track.id);
		try {
			await deleteTrack({ data: { trackId: track.id } });
			// reload the page to refresh data
			window.location.reload();
		} catch (error) {
			console.error("Failed to delete track:", error);
			alert("Failed to delete track");
		} finally {
			setDeletingId(null);
		}
	};

	const albumArtUrl = (track: MyTrackInfo) =>
		track.albumArtKey ? `/files/${track.albumArtKey}` : null;

	return (
		<div class="max-w-7xl mx-auto relative z-10">
			<div class="flex items-center justify-between mb-8">
				<h1 class="text-3xl font-bold text-white">My Tracks</h1>
				<Link
					to="/upload"
					class="inline-flex items-center gap-2 px-4 py-2 bg-stone-900/50 hover:bg-stone-900/80 text-white font-medium rounded-sm transition-colors"
				>
					<Plus class="w-4 h-4" />
					Upload New
				</Link>
			</div>

			<Show
				when={data().tracks.length > 0}
				fallback={
					<div class="text-center py-16">
						<div class="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
							<Music class="w-10 h-10 text-stone-600" />
						</div>
						<p class="text-gray-400 text-lg mb-2">No tracks yet</p>
						<p class="text-gray-500 mb-6">
							Upload your first track to get started!
						</p>
						<Link
							to="/upload"
							class="inline-flex items-center gap-2 px-6 py-3 bg-stone-900/50 hover:bg-stone-900/80 text-white font-semibold rounded-sm transition-colors"
						>
							<Plus class="w-5 h-5" />
							Upload Track
						</Link>
					</div>
				}
			>
				<div class="flex flex-col gap-4">
					<For each={data().tracks}>
						{(track) => {
							const artUrl = albumArtUrl(track);
							return (
								<div class="group flex bg-stone-900/50 hover:bg-stone-900/80 transition-colors rounded-sm overflow-clip">
									{/* album art */}
									<Link
										to="/track/$trackId"
										params={{ trackId: track.id }}
										class="relative w-40 h-40 shrink-0 bg-stone-800"
									>
										<Show
											when={artUrl}
											fallback={
												<div class="absolute inset-0 flex items-center justify-center">
													<Music class="w-8 h-8 text-stone-600" />
												</div>
											}
										>
											{(url) => (
												<img
													src={url()}
													alt=""
													class="w-full h-full object-cover"
												/>
											)}
										</Show>
									</Link>

									{/* track info */}
									<div class="flex-1 min-w-0 px-8 py-3 flex flex-col justify-center">
										<Link
											to="/track/$trackId"
											params={{ trackId: track.id }}
											class="font-bold text-2xl transition-colors w-fit hover:opacity-80"
										>
											{track.title}
										</Link>
										<Show when={track.description}>
											{(desc) => (
												<p class="text-sm opacity-70 mt-1 line-clamp-2">
													{desc()}
												</p>
											)}
										</Show>
										<div class="flex items-center gap-3 mt-0.5">
											<span class="text-sm opacity-50">
												{formatSmartDate(track.createdAt)}
											</span>
											<span
												class={
													track.isPublic
														? "text-sm text-green-400 opacity-70"
														: "text-sm text-gray-500 opacity-50"
												}
											>
												{track.isPublic ? "Public" : "Private"}
											</span>
										</div>
									</div>

									{/* actions */}
									<div class="flex items-center gap-2 px-4">
										<Link
											to="/track/$trackId/edit"
											params={{ trackId: track.id }}
											class="p-2 text-gray-400 hover:text-white hover:bg-stone-800 rounded-sm transition-colors"
										>
											<Edit2 class="w-4 h-4" />
										</Link>
										<button
											type="button"
											onClick={() => handleDelete(track)}
											disabled={deletingId() === track.id}
											class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-colors disabled:opacity-50"
										>
											<Trash2 class="w-4 h-4" />
										</button>
									</div>
								</div>
							);
						}}
					</For>
				</div>
			</Show>
		</div>
	);
}
