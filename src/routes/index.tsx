// home page - displays recent tracks

import { createFileRoute, Link } from "@tanstack/solid-router";
import Music from "lucide-solid/icons/music";
import Upload from "lucide-solid/icons/upload";
import User from "lucide-solid/icons/user";
import { For, Show } from "solid-js";
import TrackCard from "@/components/TrackCard";
import { Button } from "@/components/ui/button";
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
		<div class="min-h-screen bg-linear-to-b from-stone-900 via-stone-950 to-stone-900 relative pb-24">
			<div class="absolute inset-0 bg-linear-to-br from-violet-500 via-indigo-500 to-purple-500 mask-radial-at-top mask-circle mask-radial-from-0% mask-contain opacity-50 z-0" />

			{/* hero section */}
			<section class="relative py-20 px-6 text-center overflow-hidden z-10">
				<div class="relative max-w-7xl mx-auto grid grid-cols-3">
					<h1 class="text-5xl md:text-6xl font-bold text-white mb-4 font-heading col-start-2 vt-logo">
						<span class="bg-linear-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
							laptou
						</span>{" "}
						<span class="text-gray-300">sound</span>
					</h1>

					<div class="col-start-3 justify-self-end self-center flex flex-col items-end gap-4">
						<Show
							when={sessionState?.data?.user}
							fallback={
								<Link to="/login">
									<Button variant="secondary">
										<User class="w-5 h-5" />
										Sign In
									</Button>
								</Link>
							}
						>
							<Link to="/upload">
								<Button variant="default">
									<Upload class="w-5 h-5" />
									Upload Track
								</Button>
							</Link>
							<Link to="/account">
								<Button variant="secondary">
									<User class="w-5 h-5" />
									My Account
								</Button>
							</Link>
						</Show>
					</div>
				</div>
			</section>

			{/* recent tracks */}
			<section class="py-16 px-6 max-w-7xl mx-auto relative z-10">
				<Show
					when={data().tracks.length > 0}
					fallback={
						<div class="text-center py-16">
							<div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
								<Music class="w-10 h-10 text-gray-600" />
							</div>
							<p class="text-gray-400 text-lg">No tracks yet</p>
							<p class="text-gray-500 mt-1">Come back later.</p>
						</div>
					}
				>
					<div class="flex flex-col">
						<For each={data().tracks}>
							{(track) => (
								<TrackCard
									track={track}
									ownerName={track.ownerName}
									ownerImage={track.ownerImage}
								/>
							)}
						</For>
					</div>
				</Show>
			</section>
		</div>
	);
}
