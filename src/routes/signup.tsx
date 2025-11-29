// signup page

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Show } from "solid-js";
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
						<div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
							<p class="text-red-300 text-center">{error()}</p>
						</div>
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
								<div>
									<label
										for={field().name}
										class="block text-sm font-medium text-gray-300 mb-2"
									>
										Name
									</label>
									<input
										id={field().name}
										name={field().name}
										type="text"
										value={field().state.value}
										onInput={(e) => field().handleChange(e.currentTarget.value)}
										onBlur={field().handleBlur}
										required
										class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
										placeholder="Your name"
									/>
									<Show when={field().state.meta.errors.length > 0}>
										<p class="mt-1 text-sm text-red-400">
											{field().state.meta.errors[0]}
										</p>
									</Show>
								</div>
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
								<div>
									<label
										for={field().name}
										class="block text-sm font-medium text-gray-300 mb-2"
									>
										Email
									</label>
									<input
										id={field().name}
										name={field().name}
										type="email"
										value={field().state.value}
										onInput={(e) => field().handleChange(e.currentTarget.value)}
										onBlur={field().handleBlur}
										required
										class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
										placeholder="you@example.com"
									/>
									<Show when={field().state.meta.errors.length > 0}>
										<p class="mt-1 text-sm text-red-400">
											{field().state.meta.errors[0]}
										</p>
									</Show>
								</div>
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
								<div>
									<label
										for={field().name}
										class="block text-sm font-medium text-gray-300 mb-2"
									>
										Password
									</label>
									<input
										id={field().name}
										name={field().name}
										type="password"
										value={field().state.value}
										onInput={(e) => field().handleChange(e.currentTarget.value)}
										onBlur={field().handleBlur}
										required
										minLength={8}
										class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
										placeholder="••••••••"
									/>
									<Show when={field().state.meta.errors.length > 0}>
										<p class="mt-1 text-sm text-red-400">
											{field().state.meta.errors[0]}
										</p>
									</Show>
								</div>
							)}
						</form.Field>

						<form.Field name="confirmPassword">
							{(field) => (
								<div>
									<label
										for={field().name}
										class="block text-sm font-medium text-gray-300 mb-2"
									>
										Confirm Password
									</label>
									<input
										id={field().name}
										name={field().name}
										type="password"
										value={field().state.value}
										onInput={(e) => field().handleChange(e.currentTarget.value)}
										onBlur={field().handleBlur}
										required
										class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
										placeholder="••••••••"
									/>
									<Show when={field().state.meta.errors.length > 0}>
										<p class="mt-1 text-sm text-red-400">
											{field().state.meta.errors[0]}
										</p>
									</Show>
								</div>
							)}
						</form.Field>

						<form.Field name="inviteCode">
							{(field) => (
								<div>
									<label
										for={field().name}
										class="block text-sm font-medium text-gray-300 mb-2"
									>
										Invite Code{" "}
										<span class="text-gray-500 font-normal">(optional)</span>
									</label>
									<input
										id={field().name}
										name={field().name}
										type="text"
										value={field().state.value}
										onInput={(e) => field().handleChange(e.currentTarget.value)}
										onBlur={field().handleBlur}
										class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
										placeholder="Enter invite code for uploader access"
									/>
									<p class="mt-1 text-xs text-gray-500">
										Without an invite code, you'll be able to comment but not
										upload.
									</p>
								</div>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{(state) => (
								<button
									type="submit"
									disabled={!state().canSubmit || loading()}
									class="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{loading() || state().isSubmitting
										? "Creating account..."
										: "Create Account"}
								</button>
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
