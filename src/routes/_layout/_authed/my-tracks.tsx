// my tracks page - manage user's own tracks

import { createFileRoute, Link } from "@tanstack/solid-router";
import Edit2 from "lucide-solid/icons/edit-2";
import Music from "lucide-solid/icons/music";
import Plus from "lucide-solid/icons/plus";
import Trash2 from "lucide-solid/icons/trash-2";
import { createSignal, For, Show } from "solid-js";
import type { Track } from "@/db/schema";
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

	const handleDelete = async (track: Track) => {
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

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div class="max-w-4xl mx-auto">
				<div class="flex items-center justify-between mb-8">
					<h1 class="text-3xl font-bold text-white">My Tracks</h1>
					<Link
						to="/upload"
						class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25"
					>
						<Plus class="w-4 h-4" />
						Upload New
					</Link>
				</div>

				<Show
					when={data().tracks.length > 0}
					fallback={
						<div class="text-center py-16">
							<div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
								<Music class="w-10 h-10 text-gray-600" />
							</div>
							<p class="text-gray-400 text-lg mb-2">No tracks yet</p>
							<p class="text-gray-500 mb-6">
								Upload your first track to get started!
							</p>
							<Link
								to="/upload"
								class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25"
							>
								<Plus class="w-5 h-5" />
								Upload Track
							</Link>
						</div>
					}
				>
					<div class="space-y-4">
						<For each={data().tracks}>
							{(track) => (
								<div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 hover:border-violet-500/30 transition-all duration-300">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-4">
											<Link
												to="/track/$trackId"
												params={{ trackId: track.id }}
												class="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center hover:scale-105 transition-transform"
											>
												<Music class="w-6 h-6 text-white" />
											</Link>
											<div>
												<Link
													to="/track/$trackId"
													params={{ trackId: track.id }}
													class="text-white font-medium hover:text-violet-300 transition-colors"
												>
													{track.title}
												</Link>
												<div class="flex items-center gap-3 text-sm text-gray-400">
													<span>
														{new Date(track.createdAt).toLocaleDateString()}
													</span>
													<span
														class={
															track.isPublic
																? "text-green-400"
																: "text-gray-500"
														}
													>
														{track.isPublic ? "Public" : "Private"}
													</span>
												</div>
											</div>
										</div>

										<div class="flex items-center gap-2">
											<Link
												to="/track/$trackId/edit"
												params={{ trackId: track.id }}
												class="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
											>
												<Edit2 class="w-4 h-4" />
											</Link>
											<button
												type="button"
												onClick={() => handleDelete(track)}
												disabled={deletingId() === track.id}
												class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
											>
												<Trash2 class="w-4 h-4" />
											</button>
										</div>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
}
