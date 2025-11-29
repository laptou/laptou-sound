// admin dashboard page

import { createFileRoute } from "@tanstack/solid-router";
import { Key, Music, Plus, Shield, Trash2, Users } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import type { InviteCode, Track, User } from "@/db/schema";
import {
	createInviteCode,
	deleteInviteCode,
	getInviteCodes,
	getUsers,
	updateUserRole,
} from "@/server/admin";
import { hasRole } from "@/server/auth";
import { deleteTrack, getPublicTracks } from "@/server/tracks";

export const Route = createFileRoute("/_authed/admin")({
	beforeLoad: async ({ context }) => {
		if (!hasRole(context.user?.role as string, "admin")) {
			throw new Error("Admin access required");
		}
	},
	loader: async () => {
		const [inviteCodes, users, tracks] = await Promise.all([
			getInviteCodes(),
			getUsers(),
			getPublicTracks(),
		]);
		return { inviteCodes, users, tracks };
	},
	component: AdminDashboard,
});

function AdminDashboard() {
	const data = Route.useLoaderData();
	const [activeTab, setActiveTab] = createSignal<"codes" | "users" | "tracks">(
		"codes",
	);
	const [newCodeRole, setNewCodeRole] = createSignal<
		"commenter" | "uploader" | "admin"
	>("uploader");
	const [isCreating, setIsCreating] = createSignal(false);

	const handleCreateCode = async () => {
		setIsCreating(true);
		try {
			await createInviteCode({ data: { role: newCodeRole() } });
			window.location.reload();
		} catch (_error) {
			alert("Failed to create invite code");
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteCode = async (code: InviteCode) => {
		if (!confirm("Delete this invite code?")) return;
		try {
			await deleteInviteCode({ data: { codeId: code.id } });
			window.location.reload();
		} catch (_error) {
			alert("Failed to delete invite code");
		}
	};

	const handleUpdateRole = async (
		user: User,
		role: "commenter" | "uploader" | "admin",
	) => {
		try {
			await updateUserRole({ data: { userId: user.id, role } });
			window.location.reload();
		} catch (_error) {
			alert("Failed to update role");
		}
	};

	const handleDeleteTrack = async (track: Track) => {
		if (!confirm(`Delete "${track.title}"?`)) return;
		try {
			await deleteTrack({ data: { trackId: track.id } });
			window.location.reload();
		} catch (_error) {
			alert("Failed to delete track");
		}
	};

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div class="max-w-6xl mx-auto">
				<div class="flex items-center gap-4 mb-8">
					<div class="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
						<Shield class="w-6 h-6 text-white" />
					</div>
					<h1 class="text-3xl font-bold text-white">Admin Dashboard</h1>
				</div>

				{/* tabs */}
				<div class="flex gap-2 mb-8">
					<button
						type="button"
						onClick={() => setActiveTab("codes")}
						class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
							activeTab() === "codes"
								? "bg-violet-500 text-white"
								: "bg-slate-700/50 text-gray-300 hover:bg-slate-700"
						}`}
					>
						<Key class="w-4 h-4" />
						Invite Codes
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("users")}
						class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
							activeTab() === "users"
								? "bg-violet-500 text-white"
								: "bg-slate-700/50 text-gray-300 hover:bg-slate-700"
						}`}
					>
						<Users class="w-4 h-4" />
						Users
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("tracks")}
						class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
							activeTab() === "tracks"
								? "bg-violet-500 text-white"
								: "bg-slate-700/50 text-gray-300 hover:bg-slate-700"
						}`}
					>
						<Music class="w-4 h-4" />
						Tracks
					</button>
				</div>

				{/* invite codes tab */}
				<Show when={activeTab() === "codes"}>
					<div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
						<div class="flex items-center justify-between mb-6">
							<h2 class="text-xl font-semibold text-white">Invite Codes</h2>
							<div class="flex items-center gap-3">
								<select
									value={newCodeRole()}
									onChange={(e) =>
										setNewCodeRole(
											e.currentTarget.value as
												| "commenter"
												| "uploader"
												| "admin",
										)
									}
									class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
								>
									<option value="commenter">Commenter</option>
									<option value="uploader">Uploader</option>
									<option value="admin">Admin</option>
								</select>
								<button
									type="button"
									onClick={handleCreateCode}
									disabled={isCreating()}
									class="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
								>
									<Plus class="w-4 h-4" />
									Create Code
								</button>
							</div>
						</div>

						<Show
							when={data().inviteCodes.length > 0}
							fallback={
								<p class="text-gray-400 text-center py-8">
									No invite codes yet
								</p>
							}
						>
							<div class="space-y-3">
								<For each={data().inviteCodes}>
									{(code) => (
										<div class="flex items-center justify-between bg-slate-700/50 rounded-lg p-4">
											<div class="flex items-center gap-4">
												<code class="font-mono text-lg text-white bg-slate-600 px-3 py-1 rounded">
													{code.code}
												</code>
												<span
													class={`text-xs px-2 py-1 rounded ${
														code.role === "admin"
															? "bg-red-500/20 text-red-300"
															: code.role === "uploader"
																? "bg-violet-500/20 text-violet-300"
																: "bg-gray-500/20 text-gray-300"
													}`}
												>
													{code.role}
												</span>
												<Show when={code.usedBy}>
													<span class="text-green-400 text-sm">Used</span>
												</Show>
											</div>
											<Show when={!code.usedBy}>
												<button
													type="button"
													onClick={() => handleDeleteCode(code)}
													class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
												>
													<Trash2 class="w-4 h-4" />
												</button>
											</Show>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</Show>

				{/* users tab */}
				<Show when={activeTab() === "users"}>
					<div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
						<h2 class="text-xl font-semibold text-white mb-6">Users</h2>
						<div class="space-y-3">
							<For each={data().users}>
								{(user) => (
									<div class="flex items-center justify-between bg-slate-700/50 rounded-lg p-4">
										<div>
											<p class="text-white font-medium">{user.email}</p>
											<p class="text-gray-400 text-sm">
												Joined {new Date(user.createdAt).toLocaleDateString()}
											</p>
										</div>
										<select
											value={user.role}
											onChange={(e) =>
												handleUpdateRole(
													user,
													e.currentTarget.value as
														| "commenter"
														| "uploader"
														| "admin",
												)
											}
											class={`px-3 py-2 rounded-lg text-sm font-medium ${
												user.role === "admin"
													? "bg-red-500/20 text-red-300 border border-red-500/50"
													: user.role === "uploader"
														? "bg-violet-500/20 text-violet-300 border border-violet-500/50"
														: "bg-gray-500/20 text-gray-300 border border-gray-500/50"
											}`}
										>
											<option value="commenter">Commenter</option>
											<option value="uploader">Uploader</option>
											<option value="admin">Admin</option>
										</select>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* tracks tab */}
				<Show when={activeTab() === "tracks"}>
					<div class="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
						<h2 class="text-xl font-semibold text-white mb-6">All Tracks</h2>
						<Show
							when={data().tracks.length > 0}
							fallback={
								<p class="text-gray-400 text-center py-8">No tracks yet</p>
							}
						>
							<div class="space-y-3">
								<For each={data().tracks}>
									{(track) => (
										<div class="flex items-center justify-between bg-slate-700/50 rounded-lg p-4">
											<div>
												<a
													href={`/track/${track.id}`}
													class="text-white font-medium hover:text-violet-300 transition-colors"
												>
													{track.title}
												</a>
												<p class="text-gray-400 text-sm">
													{new Date(track.createdAt).toLocaleDateString()}
												</p>
											</div>
											<button
												type="button"
												onClick={() => handleDeleteTrack(track)}
												class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
											>
												<Trash2 class="w-4 h-4" />
											</button>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</Show>
			</div>
		</div>
	);
}
