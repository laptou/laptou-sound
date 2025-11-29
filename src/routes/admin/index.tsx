// admin dashboard - overview and stats
import { createFileRoute, Link, redirect } from "@tanstack/solid-router";
import {
	ChevronRight,
	MessageCircle,
	Music,
	Play,
	Ticket,
	Users,
} from "lucide-solid";
import { Show } from "solid-js";
import { fetchAdminStats } from "../../lib/server/admin";
import { getSession } from "../../lib/server/auth";

export const Route = createFileRoute("/admin/")({
	head: () => ({
		meta: [{ title: "Admin Dashboard - laptou sound" }],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		if (!session?.user || session.role !== "admin") {
			throw redirect({ to: "/" });
		}
		return { session };
	},
	loader: async () => {
		return fetchAdminStats();
	},
	component: AdminDashboard,
});

function AdminDashboard() {
	const stats = Route.useLoaderData();

	const statCards = () => [
		{
			label: "Total Users",
			value: stats()?.totalUsers ?? 0,
			icon: <Users class="w-6 h-6" />,
			color: "accent",
		},
		{
			label: "Total Tracks",
			value: stats()?.totalTracks ?? 0,
			icon: <Music class="w-6 h-6" />,
			color: "green",
		},
		{
			label: "Total Plays",
			value: stats()?.totalPlays ?? 0,
			icon: <Play class="w-6 h-6" />,
			color: "purple",
		},
		{
			label: "Total Comments",
			value: stats()?.totalComments ?? 0,
			icon: <MessageCircle class="w-6 h-6" />,
			color: "amber",
		},
	];

	const formatNumber = (num: number) => {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	};

	return (
		<div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
			<div class="animate-fade-in">
				<h1 class="text-display mb-2">Admin Dashboard</h1>
				<p class="text-small mb-8">Manage your laptou sound instance</p>

				{/* stats grid */}
				<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					{statCards().map((stat, i) => (
						<div class={`card p-6 animate-fade-in stagger-${i + 1}`}>
							<div class="flex items-center justify-between mb-4">
								<div
									class={`w-12 h-12 rounded-xl flex items-center justify-center ${
										stat.color === "accent"
											? "bg-accent-100 dark:bg-accent-900 text-accent-600 dark:text-accent-400"
											: stat.color === "green"
												? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
												: stat.color === "purple"
													? "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
													: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400"
									}`}
								>
									{stat.icon}
								</div>
							</div>
							<p class="text-3xl font-bold mb-1">{formatNumber(stat.value)}</p>
							<p class="text-small">{stat.label}</p>
						</div>
					))}
				</div>

				{/* role distribution */}
				<Show when={stats()?.roleDistribution?.length}>
					<div class="card p-6 mb-8">
						<h2 class="text-subtitle mb-4">User Roles</h2>
						<div class="flex flex-wrap gap-4">
							{stats()?.roleDistribution?.map((item) => (
								<div class="flex items-center gap-2">
									<span
										class={`badge ${
											item.role === "admin"
												? "badge-error"
												: item.role === "uploader"
													? "badge-accent"
													: "badge-success"
										}`}
									>
										{item.role}
									</span>
									<span class="font-medium">{item.count}</span>
								</div>
							))}
						</div>
					</div>
				</Show>

				{/* quick links */}
				<div class="grid md:grid-cols-2 gap-4">
					<Link
						href="/admin/invites"
						class="card-hover p-6 flex items-center gap-4"
					>
						<div class="w-12 h-12 rounded-xl bg-accent-100 dark:bg-accent-900 flex items-center justify-center">
							<Ticket class="w-6 h-6 text-accent-600 dark:text-accent-400" />
						</div>
						<div class="flex-1">
							<h3 class="font-semibold">Invite Codes</h3>
							<p class="text-small">Generate and manage invite codes</p>
						</div>
						<ChevronRight class="w-5 h-5 text-surface-400" />
					</Link>

					<Link
						href="/admin/users"
						class="card-hover p-6 flex items-center gap-4"
					>
						<div class="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center">
							<Users class="w-6 h-6 text-green-600 dark:text-green-400" />
						</div>
						<div class="flex-1">
							<h3 class="font-semibold">User Management</h3>
							<p class="text-small">View and manage users</p>
						</div>
						<ChevronRight class="w-5 h-5 text-surface-400" />
					</Link>
				</div>
			</div>
		</div>
	);
}
