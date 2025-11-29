// user settings page
import { createFileRoute, redirect } from "@tanstack/solid-router";
import { LogOut, Mail, Shield, User } from "lucide-solid";
import { Show } from "solid-js";
import { signOut } from "../lib/auth-client";
import { getSession } from "../lib/server/auth";

export const Route = createFileRoute("/settings")({
	head: () => ({
		meta: [{ title: "Settings - laptou sound" }],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		if (!session?.user) {
			throw redirect({ to: "/auth/login" });
		}
		return { session };
	},
	component: SettingsPage,
});

function SettingsPage() {
	const context = Route.useRouteContext();
	const session = () => (context as any).session;

	const handleSignOut = async () => {
		await signOut();
		window.location.href = "/";
	};

	const roleLabel = (role: string) => {
		switch (role) {
			case "admin":
				return "Administrator";
			case "uploader":
				return "Uploader";
			default:
				return "Commenter";
		}
	};

	const roleDescription = (role: string) => {
		switch (role) {
			case "admin":
				return "Full access to all features including user management and invite codes";
			case "uploader":
				return "Can upload and manage your own tracks";
			default:
				return "Can listen to tracks and leave comments";
		}
	};

	return (
		<div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
			<div class="animate-fade-in-up">
				<h1 class="text-title mb-2">Settings</h1>
				<p class="text-small mb-8">Manage your account</p>

				{/* profile section */}
				<section class="card p-6 mb-6">
					<h2 class="text-subtitle mb-4 flex items-center gap-2">
						<User class="w-5 h-5 text-accent-500" />
						Profile
					</h2>

					<div class="flex items-center gap-4 mb-6">
						<div class="w-16 h-16 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
							<Show
								when={session()?.user?.image}
								fallback={<User class="w-8 h-8 text-surface-500" />}
							>
								<img
									src={session()?.user?.image!}
									alt={session()?.user?.name || "User"}
									class="w-16 h-16 rounded-full"
								/>
							</Show>
						</div>
						<div>
							<p class="font-semibold text-lg">
								{session()?.user?.name || "Unnamed User"}
							</p>
							<p class="text-small flex items-center gap-1">
								<Mail class="w-4 h-4" />
								{session()?.user?.email}
							</p>
						</div>
					</div>
				</section>

				{/* role section */}
				<section class="card p-6 mb-6">
					<h2 class="text-subtitle mb-4 flex items-center gap-2">
						<Shield class="w-5 h-5 text-accent-500" />
						Your Role
					</h2>

					<div class="flex items-center gap-3 mb-2">
						<span
							class={`badge ${
								session()?.role === "admin"
									? "badge-error"
									: session()?.role === "uploader"
										? "badge-accent"
										: "badge-success"
							}`}
						>
							{roleLabel(session()?.role || "commenter")}
						</span>
					</div>
					<p class="text-small">
						{roleDescription(session()?.role || "commenter")}
					</p>
				</section>

				{/* sign out */}
				<section class="card p-6">
					<h2 class="text-subtitle mb-4 flex items-center gap-2">
						<LogOut class="w-5 h-5 text-red-500" />
						Sign Out
					</h2>
					<p class="text-small mb-4">
						Sign out of your account on this device.
					</p>
					<button
						onClick={handleSignOut}
						class="btn bg-red-500 text-white hover:bg-red-600"
					>
						<LogOut class="w-4 h-4" />
						Sign out
					</button>
				</section>
			</div>
		</div>
	);
}
