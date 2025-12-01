// signup page

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { toast } from "solid-sonner";
import { FormField } from "@/components/FormField";
import { signupMutationOptions } from "@/lib/auth-queries";

export const Route = createFileRoute("/_layout/signup")({
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
				toast.success("Account created successfully");
				navigate({ to: "/" });
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to create account",
				);
			}
		},
	}));

	const loading = () => signup.isPending;

	return (
		<div class="w-full max-w-md mx-auto">
			<div class="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-8 my-8 shadow-xl">
				<div class="text-center mb-8">
					<h1 class="text-3xl font-bold text-white mb-2">Create account</h1>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						void form.handleSubmit();
					}}
					class="flex flex-col gap-4"
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
								autocomplete="name"
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
								autocomplete="email"
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
								autocomplete="new-password"
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
								autocomplete="new-password"
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
	);
}
