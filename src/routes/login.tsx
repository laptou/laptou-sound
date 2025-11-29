// login page

import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { signIn } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [useMagicLink, setUseMagicLink] = createSignal(false);
	const [magicLinkSent, setMagicLinkSent] = createSignal(false);

	const handleEmailPasswordLogin = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const result = await signIn.email({
				email: email(),
				password: password(),
			});

			if (result.error) {
				setError(result.error.message || "Login failed");
			} else {
				navigate({ to: "/" });
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	const handleMagicLinkLogin = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const result = await signIn.magicLink({
				email: email(),
			});

			if (result.error) {
				setError(result.error.message || "Failed to send magic link");
			} else {
				setMagicLinkSent(true);
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
			<div class="w-full max-w-md">
				<div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-xl">
					<div class="text-center mb-8">
						<h1 class="text-3xl font-bold text-white mb-2">Welcome back</h1>
						<p class="text-gray-400">Sign in to your account</p>
					</div>

					<Show when={magicLinkSent()}>
						<div class="bg-violet-500/20 border border-violet-500/50 rounded-lg p-4 mb-6">
							<p class="text-violet-300 text-center">
								Check your email for a magic link to sign in.
							</p>
						</div>
					</Show>

					<Show when={error()}>
						<div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
							<p class="text-red-300 text-center">{error()}</p>
						</div>
					</Show>

					{/* toggle between methods */}
					<div class="flex mb-6 bg-slate-700/50 rounded-lg p-1">
						<button
							type="button"
							onClick={() => setUseMagicLink(false)}
							class={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
								!useMagicLink()
									? "bg-violet-500 text-white"
									: "text-gray-400 hover:text-white"
							}`}
						>
							Password
						</button>
						<button
							type="button"
							onClick={() => setUseMagicLink(true)}
							class={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
								useMagicLink()
									? "bg-violet-500 text-white"
									: "text-gray-400 hover:text-white"
							}`}
						>
							Magic Link
						</button>
					</div>

					<form
						onSubmit={
							useMagicLink() ? handleMagicLinkLogin : handleEmailPasswordLogin
						}
						class="space-y-4"
					>
						<div>
							<label
								for="email"
								class="block text-sm font-medium text-gray-300 mb-2"
							>
								Email
							</label>
							<input
								id="email"
								type="email"
								value={email()}
								onInput={(e) => setEmail(e.currentTarget.value)}
								required
								class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
								placeholder="you@example.com"
							/>
						</div>

						<Show when={!useMagicLink()}>
							<div>
								<label
									for="password"
									class="block text-sm font-medium text-gray-300 mb-2"
								>
									Password
								</label>
								<input
									id="password"
									type="password"
									value={password()}
									onInput={(e) => setPassword(e.currentTarget.value)}
									required={!useMagicLink()}
									class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
									placeholder="••••••••"
								/>
							</div>
						</Show>

						<button
							type="submit"
							disabled={loading()}
							class="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading()
								? "Please wait..."
								: useMagicLink()
									? "Send Magic Link"
									: "Sign In"}
						</button>
					</form>

					<div class="mt-6 text-center">
						<p class="text-gray-400">
							Don't have an account?{" "}
							<a
								href="/signup"
								class="text-violet-400 hover:text-violet-300 font-medium transition-colors"
							>
								Sign up
							</a>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
