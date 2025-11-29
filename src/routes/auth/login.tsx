// login page
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { AlertCircle, Lock, LogIn, Mail } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { signIn } from "../../lib/auth-client";

export const Route = createFileRoute("/auth/login")({
	head: () => ({
		meta: [{ title: "Log in - laptou sound" }],
	}),
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const result = await signIn.email({
				email: email(),
				password: password(),
			});

			if (result.error) {
				setError(result.error.message || "Failed to log in");
			} else {
				navigate({ to: "/" });
			}
		} catch (_err) {
			setError("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-12">
			<div class="w-full max-w-md animate-fade-in-up">
				<div class="card p-8">
					{/* header */}
					<div class="text-center mb-8">
						<h1 class="text-title mb-2">Welcome back</h1>
						<p class="text-small">Log in to your account to continue</p>
					</div>

					{/* error message */}
					<Show when={error()}>
						<div class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl mb-6 animate-scale-in">
							<AlertCircle class="w-5 h-5 flex-shrink-0" />
							<p class="text-sm">{error()}</p>
						</div>
					</Show>

					{/* form */}
					<form onSubmit={handleSubmit} class="space-y-4">
						<div>
							<label
								for="email"
								class="block text-sm font-medium mb-1.5 text-surface-700 dark:text-surface-300"
							>
								Email
							</label>
							<div class="relative">
								<Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
								<input
									id="email"
									type="email"
									value={email()}
									onInput={(e) => setEmail(e.currentTarget.value)}
									class="input pl-11"
									placeholder="you@example.com"
									required
									autocomplete="email"
								/>
							</div>
						</div>

						<div>
							<label
								for="password"
								class="block text-sm font-medium mb-1.5 text-surface-700 dark:text-surface-300"
							>
								Password
							</label>
							<div class="relative">
								<Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
								<input
									id="password"
									type="password"
									value={password()}
									onInput={(e) => setPassword(e.currentTarget.value)}
									class="input pl-11"
									placeholder="••••••••"
									required
									autocomplete="current-password"
								/>
							</div>
						</div>

						<button
							type="submit"
							class="btn-primary w-full"
							disabled={loading()}
						>
							<Show when={!loading()} fallback={<span>Logging in...</span>}>
								<LogIn class="w-4 h-4" />
								Log in
							</Show>
						</button>
					</form>

					{/* footer */}
					<div class="mt-6 text-center text-small">
						Don't have an account?{" "}
						<Link href="/auth/signup" class="font-medium">
							Sign up
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
