// admin user management page
import { createFileRoute, Link, redirect } from "@tanstack/solid-router";
import {
	ArrowLeft,
	MessageCircle,
	MoreVertical,
	Shield,
	Upload,
	User,
} from "lucide-solid";
import { createResource, createSignal, For, Show } from "solid-js";
import type { UserRole } from "../../lib/db/types";
import { fetchUsers, updateUserRole } from "../../lib/server/admin";
import { getSession } from "../../lib/server/auth";

export const Route = createFileRoute("/admin/users")({
	head: () => ({
		meta: [{ title: "User Management - Admin - laptou sound" }],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		if (!session?.user || session.role !== "admin") {
			throw redirect({ to: "/" });
		}
		return { session };
	},
	component: UserManagementPage,
});

function UserManagementPage() {
	const context = Route.useRouteContext();
	const [users, { refetch }] = createResource(() =>
		fetchUsers({ data: { limit: 100 } }),
	);
	const [updatingId, setUpdatingId] = createSignal<string | null>(null);
	const [openMenuId, setOpenMenuId] = createSignal<string | null>(null);

	const currentUserId = () => (context as any).session?.user?.id;

	const handleRoleChange = async (userId: string, newRole: UserRole) => {
		setUpdatingId(userId);
		setOpenMenuId(null);

		try {
			await updateUserRole({ data: { userId, role: newRole } });
			refetch();
		} catch (e: any) {
			console.error("Failed to update role:", e);
			alert(e.message || "Failed to update role");
		} finally {
			setUpdatingId(null);
		}
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const roleIcon = (role: UserRole) => {
		switch (role) {
			case "admin":
				return <Shield class="w-4 h-4" />;
			case "uploader":
				return <Upload class="w-4 h-4" />;
			default:
				return <MessageCircle class="w-4 h-4" />;
		}
	};

	const roleBadgeClass = (role: UserRole) => {
		switch (role) {
			case "admin":
				return "badge-error";
			case "uploader":
				return "badge-accent";
			default:
				return "badge-success";
		}
	};

	return (
		<div class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
			<div class="animate-fade-in">
				{/* header */}
				<div class="flex items-center gap-4 mb-8">
					<Link href="/admin" class="btn-icon btn-ghost">
						<ArrowLeft class="w-5 h-5" />
					</Link>
					<div class="flex-1">
						<h1 class="text-title">User Management</h1>
						<p class="text-small">View and manage user roles</p>
					</div>
				</div>

				{/* users list */}
				<div class="space-y-4">
					<Show
						when={users() && users()?.length > 0}
						fallback={
							<div class="card p-8 text-center text-small">No users found.</div>
						}
					>
						<For each={users()}>
							{(user, index) => (
								<div
									class={`card p-4 animate-fade-in stagger-${Math.min(
										index() + 1,
										8,
									)}`}
								>
									<div class="flex items-center gap-4">
										{/* avatar */}
										<div class="w-12 h-12 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0">
											<Show
												when={user.image}
												fallback={<User class="w-6 h-6 text-surface-500" />}
											>
												<img
													src={user.image!}
													alt={user.name || "User"}
													class="w-12 h-12 rounded-full"
												/>
											</Show>
										</div>

										{/* user info */}
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<span class="font-medium truncate">
													{user.name || "Unnamed User"}
												</span>
												<Show when={user.id === currentUserId()}>
													<span class="text-xs text-surface-400">(you)</span>
												</Show>
											</div>
											<p class="text-small truncate">{user.email}</p>
										</div>

										{/* role badge */}
										<span
											class={`badge ${roleBadgeClass(user.role)} flex items-center gap-1`}
										>
											{roleIcon(user.role)}
											{user.role}
										</span>

										{/* joined date */}
										<span class="text-small hidden sm:block">
											Joined {formatDate(user.created_at)}
										</span>

										{/* role menu */}
										<div class="relative">
											<button
												onClick={() =>
													setOpenMenuId(
														openMenuId() === user.id ? null : user.id,
													)
												}
												class="btn-icon btn-ghost"
												disabled={
													user.id === currentUserId() ||
													updatingId() === user.id
												}
											>
												<MoreVertical class="w-4 h-4" />
											</button>

											<Show when={openMenuId() === user.id}>
												{/* backdrop */}
												<div
													class="fixed inset-0 z-40"
													onClick={() => setOpenMenuId(null)}
												/>

												{/* menu */}
												<div class="absolute right-0 mt-2 w-48 card p-2 z-50 animate-scale-in origin-top-right">
													<p class="text-xs text-surface-500 px-3 py-1">
														Change role to:
													</p>
													<button
														onClick={() =>
															handleRoleChange(user.id, "commenter")
														}
														class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800 ${
															user.role === "commenter" ? "text-accent-500" : ""
														}`}
													>
														<MessageCircle class="w-4 h-4" />
														Commenter
													</button>
													<button
														onClick={() =>
															handleRoleChange(user.id, "uploader")
														}
														class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800 ${
															user.role === "uploader" ? "text-accent-500" : ""
														}`}
													>
														<Upload class="w-4 h-4" />
														Uploader
													</button>
													<button
														onClick={() => handleRoleChange(user.id, "admin")}
														class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-800 ${
															user.role === "admin" ? "text-accent-500" : ""
														}`}
													>
														<Shield class="w-4 h-4" />
														Admin
													</button>
												</div>
											</Show>
										</div>
									</div>
								</div>
							)}
						</For>
					</Show>
				</div>
			</div>
		</div>
	);
}
