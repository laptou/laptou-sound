// main navigation header

import { Link } from "@tanstack/solid-router";
import Music from "lucide-solid/icons/music";
import Shield from "lucide-solid/icons/shield";
import Upload from "lucide-solid/icons/upload";
import User from "lucide-solid/icons/user";
import { createSignal, onMount, Show } from "solid-js";
import { getSession } from "@/server/auth";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	const [user, setUser] = createSignal<{
		id: string;
		email: string;
		role: string;
	} | null>(null);

	onMount(async () => {
		try {
			const session = await getSession();
			if (session?.user) {
				setUser({
					id: session.user.id,
					email: session.user.email,
					role: session.user.role as string,
				});
			}
		} catch {
			// not logged in
		}
	});

	const isUploader = () => {
		const role = user()?.role;
		return role === "uploader" || role === "admin";
	};

	const isAdmin = () => user()?.role === "admin";

	return (
		<header class="sticky top-0 z-40 backdrop-blur-lg bg-slate-900/80 border-b border-slate-800">
			<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
				{/* logo */}
				<Link
					to="/"
					class="flex items-center gap-3 text-white hover:opacity-90 transition-opacity"
				>
					<div class="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
						<Music class="w-5 h-5 text-white" />
					</div>
					<span class="text-xl font-bold hidden sm:block">
						<span class="text-violet-400">laptou</span>
						<span class="text-gray-300 ml-1">sound</span>
					</span>
				</Link>

				{/* nav */}
				<nav class="flex items-center gap-2">
					<Show when={isUploader()}>
						<Link
							to="/upload"
							class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
							activeProps={{
								class:
									"flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-violet-500/20 rounded-lg",
							}}
						>
							<Upload class="w-4 h-4" />
							<span class="hidden sm:inline">Upload</span>
						</Link>
					</Show>

					<Show when={isUploader()}>
						<Link
							to="/my-tracks"
							class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
							activeProps={{
								class:
									"flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-violet-500/20 rounded-lg",
							}}
						>
							<Music class="w-4 h-4" />
							<span class="hidden sm:inline">My Tracks</span>
						</Link>
					</Show>

					<Show when={isAdmin()}>
						<Link
							to="/admin"
							class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
							activeProps={{
								class:
									"flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-violet-500/20 rounded-lg",
							}}
						>
							<Shield class="w-4 h-4" />
							<span class="hidden sm:inline">Admin</span>
						</Link>
					</Show>

					<ThemeToggle />

					<Show
						when={user()}
						fallback={
							<Link
								to="/login"
								class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-violet-500/25"
							>
								<User class="w-4 h-4" />
								<span>Sign In</span>
							</Link>
						}
					>
						<Link
							to="/account"
							class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
							activeProps={{
								class:
									"flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-violet-500/20 rounded-lg",
							}}
						>
							<User class="w-4 h-4" />
							<span class="hidden sm:inline truncate max-w-[100px]">
								{user()?.email}
							</span>
						</Link>
					</Show>
				</nav>
			</div>
		</header>
	);
}
