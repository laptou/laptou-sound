// signup page

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { Callout, CalloutContent } from "@ui/callout";
import { Show } from "solid-js";
import { FormField } from "@/components/FormField";
import { signupMutationOptions } from "@/lib/auth-queries";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

function SignupPage() {
	const navigate = useNavigate();

	const signup = useMutation(() => signupMutationOptions());

	const form = createForm(() => ({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
			inviteCode: "",
		},
		validators: {
			onSubmit: ({ value }) => {
				if (value.password !== value.confirmPassword) {
					return {
						fields: {
							confirmPassword: "Passwords do not match",
						},
					};
				}
				return undefined;
			},
		},
		onSubmit: async ({ value }) => {
			try {
				await signup.mutateAsync({
					email: value.email,
					password: value.password,
					name: value.name,
				});
				navigate({ to: "/" });
			} catch {
				// error is handled by mutation state
			}
		},
	}));

	const error = () => signup.error?.message || null;
	const loading = () => signup.isPending;

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
			<div class="w-full max-w-md">
				<div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-xl">
					<div class="text-center mb-8">
						<h1 class="text-3xl font-bold text-white mb-2">Create account</h1>
						<p class="text-gray-400">Join the community</p>
					</div>

					<Show when={error()}>
						<Callout variant="error" class="mb-6">
							<CalloutContent>
								<p class="text-center">{error()}</p>
							</CalloutContent>
						</Callout>
					</Show>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							void form.handleSubmit();
						}}
						class="space-y-4"
					>
						<form.Field
							name="name"
							validators={{
								onChange: ({ value }) =>
									!value || value.trim().length === 0
										? "Name is required"
										: undefined,
							}}
						>
							{(field) => (
								<FormField
									field={field}
									label="Name"
									type="text"
									placeholder="Your name"
								/>
							)}
						</form.Field>

						<form.Field
							name="email"
							validators={{
								onChange: ({ value }) =>
									!value || !value.includes("@")
										? "Please enter a valid email"
										: undefined,
							}}
						>
							{(field) => (
								<FormField
									field={field}
									label="Email"
									type="email"
									placeholder="you@example.com"
								/>
							)}
						</form.Field>

						<form.Field
							name="password"
							validators={{
								onChange: ({ value }) =>
									!value || value.length < 8
										? "Password must be at least 8 characters"
										: undefined,
							}}
						>
							{(field) => (
								<FormField
									field={field}
									label="Password"
									type="password"
									placeholder="••••••••"
								/>
							)}
						</form.Field>

						<form.Field name="confirmPassword">
							{(field) => (
								<FormField
									field={field}
									label="Confirm Password"
									type="password"
									placeholder="••••••••"
								/>
							)}
						</form.Field>

						<form.Field name="inviteCode">
							{(field) => (
								<FormField
									field={field}
									label="Invite Code (optional)"
									type="text"
									placeholder="Enter invite code for uploader access"
									required={false}
								/>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{(state) => (
								<Button
									type="submit"
									disabled={!state().canSubmit || loading()}
									class="w-full"
								>
									{loading() || state().isSubmitting
										? "Creating account..."
										: "Create Account"}
								</Button>
							)}
						</form.Subscribe>
					</form>

					<div class="mt-6 text-center">
						<p class="text-gray-400">
							Already have an account?{" "}
							<a
								href="/login"
								class="text-violet-400 hover:text-violet-300 font-medium transition-colors"
							>
								Sign in
							</a>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
