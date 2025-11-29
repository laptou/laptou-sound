// signup page

import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { signUp } from "@/lib/auth-client";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
});

function SignupPage() {
	const navigate = useNavigate();
	const [name, setName] = createSignal("");
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [confirmPassword, setConfirmPassword] = createSignal("");
	const [inviteCode, setInviteCode] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);

	const handleSignup = async (e: Event) => {
		e.preventDefault();
		setError(null);

		if (password() !== confirmPassword()) {
			setError("Passwords do not match");
			return;
		}

		if (password().length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setLoading(true);

		try {
			const result = await signUp.email({
				email: email(),
				password: password(),
				name: name(),
				// invite code will be handled by server-side logic
			});

			if (result.error) {
				setError(result.error.message || "Signup failed");
			} else {
				navigate({ to: "/" });
			}
		} catch {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

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

					<form onSubmit={handleSignup} class="space-y-4">
						<div>
							<label
								for="name"
								class="block text-sm font-medium text-gray-300 mb-2"
							>
								Name
							</label>
							<input
								id="name"
								type="text"
								value={name()}
								onInput={(e) => setName(e.currentTarget.value)}
								required
								class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
								placeholder="Your name"
							/>
						</div>

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
								required
								minLength={8}
								class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
								placeholder="••••••••"
							/>
						</div>

						<div>
							<label
								for="confirmPassword"
								class="block text-sm font-medium text-gray-300 mb-2"
							>
								Confirm Password
							</label>
							<input
								id="confirmPassword"
								type="password"
								value={confirmPassword()}
								onInput={(e) => setConfirmPassword(e.currentTarget.value)}
								required
								class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
								placeholder="••••••••"
							/>
						</div>

						<div>
							<label
								for="inviteCode"
								class="block text-sm font-medium text-gray-300 mb-2"
							>
								Invite Code{" "}
								<span class="text-gray-500 font-normal">(optional)</span>
							</label>
							<input
								id="inviteCode"
								type="text"
								value={inviteCode()}
								onInput={(e) => setInviteCode(e.currentTarget.value)}
								class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
								placeholder="Enter invite code for uploader access"
							/>
							<p class="mt-1 text-xs text-gray-500">
								Without an invite code, you'll be able to comment but not
								upload.
							</p>
						</div>

						<button
							type="submit"
							disabled={loading()}
							class="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading() ? "Creating account..." : "Create Account"}
						</button>
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
