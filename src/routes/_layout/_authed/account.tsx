// account settings page - manage profile, email, and password

import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
} from "@ui/text-field";
import Camera from "lucide-solid/icons/camera";
import Key from "lucide-solid/icons/key";
import LogOut from "lucide-solid/icons/log-out";
import User from "lucide-solid/icons/user";
import { Show } from "solid-js";
import { toast } from "solid-sonner";
import { signOut, useSession } from "@/lib/auth-client";
import {
	changeEmailMutationOptions,
	changePasswordMutationOptions,
	redeemInviteCodeMutationOptions,
	updateProfileMutationOptions,
} from "@/lib/auth-queries";
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
	const queryClient = useQueryClient();

	// mutations
	const updateProfileMutation = useMutation(() =>
		updateProfileMutationOptions(),
	);
	const changeEmailMutation = useMutation(() => changeEmailMutationOptions());
	const changePasswordMutation = useMutation(() =>
		changePasswordMutationOptions(),
	);
	const redeemInviteCodeMutation = useMutation(() =>
		redeemInviteCodeMutationOptions(),
	);

	// profile form
	const profileForm = createForm(() => ({
		defaultValues: {
			name: data().user?.name ?? "",
			image: data().user?.image ?? "",
		},
		onSubmit: async ({ value }) => {
			try {
				await updateProfileMutation.mutateAsync({
					name: value.name,
					image: value.image || null,
				});
				toast.success("Profile updated successfully");
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to update profile",
				);
				throw err;
			}
		},
	}));

	// email form
	const emailForm = createForm(() => ({
		defaultValues: {
			newEmail: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await changeEmailMutation.mutateAsync({
					newEmail: value.newEmail,
				});
				toast.success("Verification email sent! Check your inbox.", {
					duration: Number.POSITIVE_INFINITY,
				});
				emailForm.reset();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to change email",
				);
				throw err;
			}
		},
	}));

	// password form
	const passwordForm = createForm(() => ({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await changePasswordMutation.mutateAsync({
					currentPassword: value.currentPassword,
					newPassword: value.newPassword,
				});
				toast.success("Password changed successfully");
				passwordForm.reset();
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to change password",
				);
				throw err;
			}
		},
		validators: {
			onSubmit: ({ value }) => {
				if (value.newPassword.length < 8) {
					return {
						fields: {
							newPassword: "Password must be at least 8 characters",
						},
					};
				}
				if (value.newPassword !== value.confirmPassword) {
					return {
						fields: {
							confirmPassword: "Passwords don't match",
						},
					};
				}
				return undefined;
			},
		},
	}));

	// invite code form
	const inviteCodeForm = createForm(() => ({
		defaultValues: {
			code: "",
		},
		onSubmit: async ({ value }) => {
			try {
				const result = await redeemInviteCodeMutation.mutateAsync({
					code: value.code,
				});
				toast.success(`Role upgraded to ${result.newRole}!`, {
					duration: 5000,
				});
				inviteCodeForm.reset();
				// invalidate session to refresh user data
				queryClient.invalidateQueries({ queryKey: ["session"] });
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to redeem invite code",
				);
				throw err;
			}
		},
	}));

	const handleSignOut = async () => {
		try {
			await signOut(queryClient);
			navigate({ to: "/" });
		} catch (err) {
			console.error("Sign out failed:", err);
		}
	};

	const currentUser = () => session.data?.user ?? data().user;

	// track whether avatar input is expanded
	const showAvatarInput = profileForm.useStore(
		(state) => state.values.image !== (data().user?.image ?? ""),
	);

	return (
		<div class="max-w-2xl mx-auto">
			<h1 class="text-3xl font-bold text-white mb-8">Account Settings</h1>

			{/* profile section */}
			<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
				<h2 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
					<User class="w-5 h-5 text-violet-400" />
					Profile
				</h2>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						profileForm.handleSubmit();
					}}
					class="space-y-6"
				>
					{/* avatar */}
					<div class="flex items-start gap-6">
						<div class="relative shrink-0">
							<profileForm.Field name="image">
								{(field) => (
									<div class="w-24 h-24 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center overflow-hidden">
										<Show
											when={field().state.value}
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
								)}
							</profileForm.Field>
							<button
								type="button"
								onClick={() => {
									// toggle showing the avatar input by clearing or setting a placeholder
									const currentImage = profileForm.getFieldValue("image");
									if (currentImage === (data().user?.image ?? "")) {
										// expand the input
										profileForm.setFieldValue("image", currentImage || " ");
									}
								}}
								class="absolute bottom-0 right-0 w-8 h-8 bg-violet-500 hover:bg-violet-600 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg"
							>
								<Camera class="w-4 h-4 text-white" />
							</button>
						</div>
						<div class="flex-1">
							<Show
								when={showAvatarInput() || !data().user?.image}
								fallback={
									<div class="text-gray-400 text-sm pt-2">
										<p>Click the camera icon to change your photo</p>
									</div>
								}
							>
								<profileForm.Field name="image">
									{(field) => (
										<TextField
											value={field().state.value?.trim() ?? ""}
											onChange={(v) => field().handleChange(v)}
											validationState={
												field().state.meta.errors.length > 0
													? "invalid"
													: "valid"
											}
										>
											<TextFieldLabel class="text-gray-300">
												Profile Picture URL
											</TextFieldLabel>
											<TextFieldInput
												type="url"
												placeholder="https://example.com/your-photo.jpg"
												onBlur={field().handleBlur}
												class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
											/>
											<TextFieldErrorMessage>
												{field().state.meta.errors[0]}
											</TextFieldErrorMessage>
										</TextField>
									)}
								</profileForm.Field>
								<p class="text-gray-500 text-xs mt-1">
									Enter a URL to an image. Leave empty to remove.
								</p>
							</Show>
						</div>
					</div>

					{/* name */}
					<profileForm.Field
						name="name"
						validators={{
							onChange: ({ value }) =>
								!value?.trim() ? "Name is required" : undefined,
						}}
					>
						{(field) => (
							<TextField
								value={field().state.value}
								onChange={(v) => field().handleChange(v)}
								validationState={
									field().state.meta.errors.length > 0 ? "invalid" : "valid"
								}
							>
								<TextFieldLabel class="text-gray-300">
									Display Name
								</TextFieldLabel>
								<TextFieldInput
									type="text"
									placeholder="Your display name"
									onBlur={field().handleBlur}
									class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
								/>
								<TextFieldErrorMessage>
									{field().state.meta.errors[0]}
								</TextFieldErrorMessage>
							</TextField>
						)}
					</profileForm.Field>

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

					{/* role display (read-only) */}
					<div>
						<label class="text-sm font-medium text-gray-300 block mb-1">
							Account Role
						</label>
						<div class="flex items-center gap-2">
							{(() => {
								const role = (currentUser() as { role?: string })?.role || "commenter";
								const roleDisplay =
									role.charAt(0).toUpperCase() + role.slice(1);
								return (
									<span
										class={`px-3 py-2 rounded-lg text-sm font-medium ${
											role === "admin"
												? "bg-red-500/20 text-red-300 border border-red-500/50"
												: role === "uploader"
													? "bg-violet-500/20 text-violet-300 border border-violet-500/50"
													: "bg-gray-500/20 text-gray-300 border border-gray-500/50"
										}`}
									>
										{roleDisplay}
									</span>
								);
							})()}
						</div>
						<p class="text-gray-500 text-xs mt-1">
							Redeem an invite code below to upgrade your role
						</p>
					</div>

					<profileForm.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{(state) => (
							<Button
								type="submit"
								disabled={!state().canSubmit || state().isSubmitting}
								class="bg-linear-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
							>
								{state().isSubmitting ? "Saving..." : "Save Profile"}
							</Button>
						)}
					</profileForm.Subscribe>
				</form>
			</section>

			{/* email change section */}
			<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
				<h2 class="text-xl font-semibold text-white mb-6">Change Email</h2>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						emailForm.handleSubmit();
					}}
					class="space-y-4"
				>
					<emailForm.Field
						name="newEmail"
						validators={{
							onChange: ({ value }) => {
								if (!value?.trim()) return "Email is required";
								if (!value.includes("@")) return "Invalid email address";
								return undefined;
							},
						}}
					>
						{(field) => (
							<TextField
								value={field().state.value}
								onChange={(v) => field().handleChange(v)}
								validationState={
									field().state.meta.errors.length > 0 ? "invalid" : "valid"
								}
							>
								<TextFieldLabel class="text-gray-300">
									New Email Address
								</TextFieldLabel>
								<TextFieldInput
									type="email"
									placeholder="Enter new email address"
									onBlur={field().handleBlur}
									class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
								/>
								<TextFieldErrorMessage>
									{field().state.meta.errors[0]}
								</TextFieldErrorMessage>
							</TextField>
						)}
					</emailForm.Field>

					<p class="text-gray-500 text-sm">
						A verification link will be sent to your new email address.
					</p>

					<emailForm.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{(state) => (
							<Button
								type="submit"
								disabled={!state().canSubmit || state().isSubmitting}
								variant="outline"
								class="border-slate-600 text-gray-300 hover:bg-slate-700"
							>
								{state().isSubmitting ? "Sending..." : "Change Email"}
							</Button>
						)}
					</emailForm.Subscribe>
				</form>
			</section>

			{/* invite code redemption section */}
			<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
				<h2 class="text-xl font-semibold text-white mb-6 flex items-center gap-2">
					<Key class="w-5 h-5 text-violet-400" />
					Redeem Invite Code
				</h2>

				<p class="text-gray-400 mb-4 text-sm">
					Enter an invite code to upgrade your account role. You can only upgrade
					to a higher role, not downgrade.
				</p>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						inviteCodeForm.handleSubmit();
					}}
					class="space-y-4"
				>
					<inviteCodeForm.Field
						name="code"
						validators={{
							onChange: ({ value }) => {
								if (!value?.trim()) return "Invite code is required";
								if (value.trim().length < 4)
									return "Invite code must be at least 4 characters";
								return undefined;
							},
						}}
					>
						{(field) => (
							<TextField
								value={field().state.value}
								onChange={(v) => field().handleChange(v.toUpperCase())}
								validationState={
									field().state.meta.errors.length > 0 ? "invalid" : "valid"
								}
							>
								<TextFieldLabel class="text-gray-300">
									Invite Code
								</TextFieldLabel>
								<TextFieldInput
									type="text"
									placeholder="Enter invite code"
									onBlur={field().handleBlur}
									class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500 font-mono"
									maxLength={20}
								/>
								<TextFieldErrorMessage>
									{field().state.meta.errors[0]}
								</TextFieldErrorMessage>
							</TextField>
						)}
					</inviteCodeForm.Field>

					<inviteCodeForm.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{(state) => (
							<Button
								type="submit"
								disabled={!state().canSubmit || state().isSubmitting}
								variant="outline"
								class="border-violet-600 text-violet-300 hover:bg-violet-500/10"
							>
								{state().isSubmitting ? "Redeeming..." : "Redeem Code"}
							</Button>
						)}
					</inviteCodeForm.Subscribe>
				</form>
			</section>

			{/* password change section */}
			<section class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
				<h2 class="text-xl font-semibold text-white mb-6">Change Password</h2>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						passwordForm.handleSubmit();
					}}
					class="space-y-4"
				>
					<passwordForm.Field
						name="currentPassword"
						validators={{
							onChange: ({ value }) =>
								!value ? "Current password is required" : undefined,
						}}
					>
						{(field) => (
							<TextField
								value={field().state.value}
								onChange={(v) => field().handleChange(v)}
								validationState={
									field().state.meta.errors.length > 0 ? "invalid" : "valid"
								}
							>
								<TextFieldLabel class="text-gray-300">
									Current Password
								</TextFieldLabel>
								<TextFieldInput
									type="password"
									placeholder="Enter current password"
									onBlur={field().handleBlur}
									class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
								/>
								<TextFieldErrorMessage>
									{field().state.meta.errors[0]}
								</TextFieldErrorMessage>
							</TextField>
						)}
					</passwordForm.Field>

					<passwordForm.Field
						name="newPassword"
						validators={{
							onChange: ({ value }) => {
								if (!value) return "New password is required";
								if (value.length < 8)
									return "Password must be at least 8 characters";
								return undefined;
							},
						}}
					>
						{(field) => (
							<TextField
								value={field().state.value}
								onChange={(v) => field().handleChange(v)}
								validationState={
									field().state.meta.errors.length > 0 ? "invalid" : "valid"
								}
							>
								<TextFieldLabel class="text-gray-300">
									New Password
								</TextFieldLabel>
								<TextFieldInput
									type="password"
									placeholder="Enter new password"
									onBlur={field().handleBlur}
									class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
								/>
								<TextFieldErrorMessage>
									{field().state.meta.errors[0]}
								</TextFieldErrorMessage>
							</TextField>
						)}
					</passwordForm.Field>

					<passwordForm.Field
						name="confirmPassword"
						validators={{
							onChangeListenTo: ["newPassword"],
							onChange: ({ value, fieldApi }) => {
								const newPassword = fieldApi.form.getFieldValue("newPassword");
								if (!value) return "Please confirm your password";
								if (value !== newPassword) return "Passwords don't match";
								return undefined;
							},
						}}
					>
						{(field) => (
							<TextField
								value={field().state.value}
								onChange={(v) => field().handleChange(v)}
								validationState={
									field().state.meta.errors.length > 0 ? "invalid" : "valid"
								}
							>
								<TextFieldLabel class="text-gray-300">
									Confirm New Password
								</TextFieldLabel>
								<TextFieldInput
									type="password"
									placeholder="Confirm new password"
									onBlur={field().handleBlur}
									class="bg-slate-900/50 border-slate-600 text-white placeholder:text-gray-500"
								/>
								<TextFieldErrorMessage>
									{field().state.meta.errors[0]}
								</TextFieldErrorMessage>
							</TextField>
						)}
					</passwordForm.Field>

					<passwordForm.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{(state) => (
							<Button
								type="submit"
								disabled={!state().canSubmit || state().isSubmitting}
								variant="outline"
								class="border-slate-600 text-gray-300 hover:bg-slate-700"
							>
								{state().isSubmitting ? "Changing..." : "Change Password"}
							</Button>
						)}
					</passwordForm.Subscribe>
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
	);
}
