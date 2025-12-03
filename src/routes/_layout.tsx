import { createFileRoute, Link, Outlet } from "@tanstack/solid-router";
import Music from "lucide-solid/icons/music";
import Shield from "lucide-solid/icons/shield";
import Upload from "lucide-solid/icons/upload";
import User from "lucide-solid/icons/user";
import { Show } from "solid-js";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_layout")({
	component: RouteComponent,
});

function RouteComponent() {
	const sessionState = useSession();

	// check if user is uploader or higher
	const isUploaderOrHigher = () => {
		if (!sessionState?.data?.user) return false;
		const user = sessionState.data.user as {
			role?: string;
		} & typeof sessionState.data.user;
		const role = user.role;
		return role === "uploader" || role === "admin";
	};

	return (
		<div class="min-h-screen bg-linear-to-b from-stone-900 via-stone-950 to-stone-900 pb-24 py-12 px-6 relative">
			<div class="absolute inset-0 bg-linear-to-br from-violet-500 via-indigo-500 to-purple-500 mask-radial-at-top mask-circle mask-radial-from-0% mask-contain opacity-30 z-0" />
			<div class="max-w-7xl mx-auto z-10 relative">
				{/* header */}
				<div class="grid grid-cols-3 items-center gap-4 mb-8">
					<Link to="/">
						<h1
							class="text-3xl font-bold text-white mb-4 font-heading"
							style={{ "view-transition-name": "logo" }}
						>
							<span class="bg-linear-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
								laptou
							</span>{" "}
							<span class="text-gray-300">sound</span>
						</h1>
					</Link>
					<div class="col-start-3 justify-self-end self-center flex flex-row items-end gap-4">
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
							<Show when={isUploaderOrHigher()}>
								<Link to="/my-tracks">
									<Button variant="secondary">
										<Music class="w-5 h-5" />
										My Tracks
									</Button>
								</Link>
							</Show>
							<Link to="/upload">
								<Button variant="default">
									<Upload class="w-5 h-5" />
									Upload Track
								</Button>
							</Link>
							<Show
								when={
									sessionState?.data?.user &&
									(
										sessionState.data.user as {
											role?: string;
										} & typeof sessionState.data.user
									).role === "admin"
								}
							>
								<Link to="/admin">
									<Button variant="secondary">
										<Shield class="w-5 h-5" />
										Admin
									</Button>
								</Link>
							</Show>
							<Link to="/account">
								<Button variant="secondary">
									<User class="w-5 h-5" />
									My Account
								</Button>
							</Link>
						</Show>
					</div>
				</div>

				<Outlet />
			</div>
		</div>
	);
}
