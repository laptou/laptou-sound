// home page - displays recent tracks

import { createFileRoute, Link } from "@tanstack/solid-router";
import Music from "lucide-solid/icons/music";
import Upload from "lucide-solid/icons/upload";
import User from "lucide-solid/icons/user";
import { For, Show } from "solid-js";
import TrackCard from "@/components/TrackCard";
import { useSession } from "@/lib/auth-client";
import { wrapLoader } from "@/lib/loader-wrapper";
import { getPublicTracks } from "@/server/tracks";

export const Route = createFileRoute("/")({
	loader: wrapLoader("/", async () => {
		const tracks = await getPublicTracks();
		console.log("tracks", tracks);
		return { tracks };
	}),
	component: HomePage,
});

function HomePage() {
	const data = Route.useLoaderData();
	const sessionState = useSession();

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
			{/* hero section */}
			<section class="relative py-20 px-6 text-center overflow-hidden">
				<div class="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10" />
				<div class="relative max-w-4xl mx-auto">
					<div class="flex items-center justify-center gap-4 mb-6">
						<div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
							<Music class="w-8 h-8 text-white" />
						</div>
					</div>
					<h1 class="text-5xl md:text-6xl font-black text-white mb-4">
						<span class="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
							laptou
						</span>{" "}
						<span class="text-gray-300">sound</span>
					</h1>
					<p class="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
						Share your music with the community. Upload tracks, get feedback,
						and discover new sounds.
					</p>
					<div class="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Show
							when={sessionState?.data?.user}
							fallback={
								<>
									<Link
										to="/upload"
										class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25"
									>
										<Upload class="w-5 h-5" />
										Upload Track
									</Link>
									<Link
										to="/login"
										class="inline-flex items-center gap-2 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
									>
										Sign In
									</Link>
								</>
							}
						>
							<Link
								to="/upload"
								class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25"
							>
								<Upload class="w-5 h-5" />
								Upload Track
							</Link>
							<Link
								to="/my-tracks"
								class="inline-flex items-center gap-2 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
							>
								<User class="w-5 h-5" />
								My Tracks
							</Link>
						</Show>
					</div>
				</div>
			</section>

			{/* recent tracks */}
			<section class="py-16 px-6 max-w-7xl mx-auto">
				<div class="flex items-center justify-between mb-8">
					<h2 class="text-2xl font-bold text-white">Recent Tracks</h2>
					<span class="text-gray-500 text-sm">
						{data().tracks.length} tracks
					</span>
				</div>

				<Show
					when={data().tracks.length > 0}
					fallback={
						<div class="text-center py-16">
							<div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
								<Music class="w-10 h-10 text-gray-600" />
							</div>
							<p class="text-gray-400 text-lg">No tracks yet</p>
							<p class="text-gray-500 mt-1">
								Be the first to upload something!
							</p>
						</div>
					}
				>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						<For each={data().tracks}>
							{(track) => <TrackCard track={track} />}
						</For>
					</div>
				</Show>
			</section>
		</div>
	);
}
