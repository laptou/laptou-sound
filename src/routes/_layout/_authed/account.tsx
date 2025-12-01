// account settings page - manage profile, email, and password

import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "@ui/text-field";
import Camera from "lucide-solid/icons/camera";
import LogOut from "lucide-solid/icons/log-out";
import User from "lucide-solid/icons/user";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import {
	changeEmail,
	changePassword,
	signOut,
	updateUser,
	useSession,
} from "@/lib/auth-client";
import { getSession } from "@/server/auth";

export const Route = createFileRoute("/_layout/_authed/account")({
	loader: async () => {
		const session = await getSession();
		return { user: session?.user };
	},
	component: AccountPage,
});

function AccountPage() {
	const data = Route.useLoaderData();
	const navigate = useNavigate();
	const session = useSession();

	// profile section state
	const [name, setName] = createSignal(data().user?.name ?? "");
	const [profileSaving, setProfileSaving] = createSignal(false);

	// avatar state
	const [avatarUrl, setAvatarUrl] = createSignal(data().user?.image ?? "");
	const [showAvatarInput, setShowAvatarInput] = createSignal(false);

	// email section state
	const [newEmail, setNewEmail] = createSignal("");
	const [emailSaving, setEmailSaving] = createSignal(false);

	// password section state
	const [currentPassword, setCurrentPassword] = createSignal("");
	const [newPassword, setNewPassword] = createSignal("");
	const [confirmPassword, setConfirmPassword] = createSignal("");
	const [passwordSaving, setPasswordSaving] = createSignal(false);

	const handleProfileSave = async (e: Event) => {
		e.preventDefault();
		setProfileSaving(true);

		try {
			await updateUser({
				name: name(),
				image: avatarUrl() || null,
			})

			toast.success("Profile updated successfully");
			setShowAvatarInput(false);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to update profile",
			)
		} finally {
			setProfileSaving(false);
		}
	}

	const handleEmailChange = async (e: Event) => {
		e.preventDefault();

		if (!newEmail().trim()) {
			toast.error("Please enter a new email address");
			return
		}

		setEmailSaving(true);

		try {
			await changeEmail({ newEmail: newEmail() });
			toast.success("Verification email sent! Check your inbox.", {
				duration: Infinity, // don't auto-dismiss - user needs to check email
			});
			setNewEmail("");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to change email",
			)
		} finally {
			setEmailSaving(false);
		}
	}

	const handlePasswordChange = async (e: Event) => {
		e.preventDefault();

		if (!currentPassword()) {
			toast.error("Please enter your current password");
			return
		}

		if (!newPassword()) {
			toast.error("Please enter a new password");
			return
		}

		if (newPassword().length < 8) {
			toast.error("New password must be at least 8 characters");
			return
		}

		if (newPassword() !== confirmPassword()) {
			toast.error("Passwords don't match");
			return
		}

		setPasswordSaving(true);

		try {
			await changePassword({
				currentPassword: currentPassword(),
				newPassword: newPassword(),
			})
			toast.success("Password changed successfully");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to change password",
			)
		} finally {
			setPasswordSaving(false);
		}
	}

	const handleSignOut = async () => {
		try {
			await signOut();
			navigate({ to: "/" });
		} catch (err) {
			console.error("Sign out failed:", err);
		}
	}

	const currentUser = () => session.data?.user ?? data().user;

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div class="max-w-2xl mx-auto">
				<h1 class="text-3xl font-bold text-white mb-8">Account Settings</h1>

				{/* profile section */}
				<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
					<h2 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
						<User class="w-5 h-5 text-violet-400" />
						Profile
					</h2>

					<form onSubmit={handleProfileSave} class="space-y-6">
						{/* avatar */}
						<div class="flex items-start gap-6">
							<div class="relative shrink-0">
								<div class="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center overflow-hidden">
									<Show
										when={avatarUrl()}
										fallback={
											<span class="text-3xl font-bold text-white">
												{currentUser()?.name?.charAt(0).toUpperCase() ?? "?"}
											</span>
										}
									>
										{(src) => (
											<img
												src={src()}
												alt="Avatar"
												class="w-full h-full object-cover"
											/>
										)}
									</Show>
								</div>
								<button
									type="button"
									onClick={() => setShowAvatarInput(!showAvatarInput())}
									class="absolute bottom-0 right-0 w-8 h-8 bg-violet-500 hover:bg-violet-600 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg"
								>
									<Camera class="w-4 h-4 text-white" />
								</button>
							</div>
							<div class="flex-1">
								<Show
									when={showAvatarInput()}
									fallback={
										<div class="text-gray-400 text-sm pt-2">
											<p>Click the camera icon to change your photo</p>
										</div>
									}
								>
									<TextField value={avatarUrl()} onChange={setAvatarUrl}>
										<TextFieldLabel class="text-gray-300">
											Profile Picture URL
										</TextFieldLabel>
										<TextFieldInput
											type="url"
											placeholder="https://example.com/your-photo.jpg"
											class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
										/>
									</TextField>
									<p class="text-gray-500 text-xs mt-1">
										Enter a URL to an image. Leave empty to remove.
									</p>
								</Show>
							</div>
						</div>

						{/* name */}
						<TextField value={name()} onChange={setName}>
							<TextFieldLabel class="text-gray-300">Display Name</TextFieldLabel>
							<TextFieldInput
								type="text"
								placeholder="Your display name"
								class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
							/>
						</TextField>

						{/* email display (read-only) */}
						<div>
							<label class="text-sm font-medium text-gray-300 block mb-1">
								Email Address
							</label>
							<p class="text-gray-400 bg-slate-900/50 px-3 py-2 rounded-md border border-slate-600">
								{currentUser()?.email}
							</p>
							<p class="text-gray-500 text-xs mt-1">
								Change your email in the section below
							</p>
						</div>

						<Button
							type="submit"
							disabled={profileSaving()}
							class="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
						>
							{profileSaving() ? "Saving..." : "Save Profile"}
						</Button>
					</form>
				</section>

				{/* email change section */}
				<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
					<h2 class="text-xl font-semibold text-white mb-6">Change Email</h2>

					<form onSubmit={handleEmailChange} class="space-y-4">
						<TextField value={newEmail()} onChange={setNewEmail}>
							<TextFieldLabel class="text-gray-300">New Email Address</TextFieldLabel>
							<TextFieldInput
								type="email"
								placeholder="Enter new email address"
								class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
							/>
						</TextField>

						<p class="text-gray-500 text-sm">
							A verification link will be sent to your new email address.
						</p>

						<Button
							type="submit"
							disabled={emailSaving()}
							variant="outline"
							class="border-slate-600 text-gray-300 hover:bg-slate-700"
						>
							{emailSaving() ? "Sending..." : "Change Email"}
						</Button>
					</form>
				</section>

				{/* password change section */}
				<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
					<h2 class="text-xl font-semibold text-white mb-6">Change Password</h2>

					<form onSubmit={handlePasswordChange} class="space-y-4">
						<TextField value={currentPassword()} onChange={setCurrentPassword}>
							<TextFieldLabel class="text-gray-300">Current Password</TextFieldLabel>
							<TextFieldInput
								type="password"
								placeholder="Enter current password"
								class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
							/>
						</TextField>

						<TextField value={newPassword()} onChange={setNewPassword}>
							<TextFieldLabel class="text-gray-300">New Password</TextFieldLabel>
							<TextFieldInput
								type="password"
								placeholder="Enter new password"
								class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
							/>
						</TextField>

						<TextField value={confirmPassword()} onChange={setConfirmPassword}>
							<TextFieldLabel class="text-gray-300">Confirm New Password</TextFieldLabel>
							<TextFieldInput
								type="password"
								placeholder="Confirm new password"
								class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
							/>
						</TextField>

						<Button
							type="submit"
							disabled={passwordSaving()}
							variant="outline"
							class="border-slate-600 text-gray-300 hover:bg-slate-700"
						>
							{passwordSaving() ? "Changing..." : "Change Password"}
						</Button>
					</form>
				</section>

				{/* sign out section */}
				<section class="bg-slate-800/50 backdrop-blur-sm border border-red-900/30 rounded-xl p-6">
					<h2 class="text-xl font-semibold text-white mb-4">Sign Out</h2>
					<p class="text-gray-400 mb-4">
						Sign out of your account on this device.
					</p>
					<Button
						type="button"
						onClick={handleSignOut}
						variant="destructive"
						class="bg-red-600 hover:bg-red-700"
					>
						<LogOut class="w-4 h-4 mr-2" />
						Sign Out
					</Button>
				</section>
			</div>
		</div>
	)
}
