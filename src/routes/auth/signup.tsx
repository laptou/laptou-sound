// signup page with optional invite code
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/solid-router";
import {
	AlertCircle,
	CheckCircle2,
	Lock,
	Mail,
	Ticket,
	User,
	UserPlus,
} from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { signUp } from "../../lib/auth-client";
import { applyInviteCode } from "../../lib/server/auth";

export const Route = createFileRoute("/auth/signup")({
	head: () => ({
		meta: [{ title: "Sign up - laptou sound" }],
	}),
	validateSearch: (search: Record<string, unknown>) => ({
		invite: (search.invite as string) || undefined,
	}),
	component: SignupPage,
});

function SignupPage() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/auth/signup" });

	const [name, setName] = createSignal("");
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [inviteCode, setInviteCode] = createSignal(search.invite || "");
	const [error, setError] = createSignal<string | null>(null);
	const [loading, setLoading] = createSignal(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			// first create the account
			const result = await signUp.email({
				email: email(),
				password: password(),
				name: name(),
			});

			if (result.error) {
				setError(result.error.message || "Failed to create account");
				setLoading(false);
				return;
			}

			// if invite code provided, apply it
			if (inviteCode().trim()) {
				try {
					await applyInviteCode({
						data: {
							code: inviteCode().trim(),
							userId: result.data?.user.id,
						},
					});
				} catch (err: any) {
					// still let them continue, just without upgraded role
					console.warn("Invite code failed:", err.message);
				}
			}

			navigate({ to: "/" });
		} catch (_err) {
			setError("An unexpected error occurred");
			setLoading(false);
		}
	};

	return (
		<div class="min-h-[calc(100vh-12rem)] flex items-center justify-center px-4 py-12">
			<div class="w-full max-w-md animate-fade-in-up">
				<div class="card p-8">
					{/* header */}
					<div class="text-center mb-8">
						<h1 class="text-title mb-2">Create an account</h1>
						<p class="text-small">Join the community and start listening</p>
					</div>

					{/* info about invite codes */}
					<Show when={inviteCode()}>
						<div class="flex items-center gap-2 p-3 bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-400 rounded-xl mb-6 animate-scale-in">
							<CheckCircle2 class="w-5 h-5 flex-shrink-0" />
							<p class="text-sm">
								Invite code applied! You'll get special access.
							</p>
						</div>
					</Show>

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
								for="name"
								class="block text-sm font-medium mb-1.5 text-surface-700 dark:text-surface-300"
							>
								Name
							</label>
							<div class="relative">
								<User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
								<input
									id="name"
									type="text"
									value={name()}
									onInput={(e) => setName(e.currentTarget.value)}
									class="input pl-11"
									placeholder="Your name"
									required
									autocomplete="name"
								/>
							</div>
						</div>

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
									minLength={8}
									autocomplete="new-password"
								/>
							</div>
							<p class="text-xs text-surface-500 mt-1">At least 8 characters</p>
						</div>

						<div>
							<label
								for="invite"
								class="block text-sm font-medium mb-1.5 text-surface-700 dark:text-surface-300"
							>
								Invite code{" "}
								<span class="text-surface-400 font-normal">(optional)</span>
							</label>
							<div class="relative">
								<Ticket class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
								<input
									id="invite"
									type="text"
									value={inviteCode()}
									onInput={(e) =>
										setInviteCode(e.currentTarget.value.toUpperCase())
									}
									class="input pl-11 uppercase tracking-wider"
									placeholder="ABCD1234"
									maxLength={8}
								/>
							</div>
							<p class="text-xs text-surface-500 mt-1">
								Have a code? Enter it to unlock upload access
							</p>
						</div>

						<button
							type="submit"
							class="btn-primary w-full"
							disabled={loading()}
						>
							<Show
								when={!loading()}
								fallback={<span>Creating account...</span>}
							>
								<UserPlus class="w-4 h-4" />
								Create account
							</Show>
						</button>
					</form>

					{/* footer */}
					<div class="mt-6 text-center text-small">
						Already have an account?{" "}
						<Link href="/auth/login" class="font-medium">
							Log in
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
