// shared layout component for login page

import { Show, type JSX } from "solid-js";

type LoginLayoutProps = {
	error?: () => string | null;
	magicLinkSent?: () => boolean;
	children: JSX.Element;
};

export function LoginLayout(props: LoginLayoutProps) {
	return (
		<div class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
			<div class="w-full max-w-md">
				<div class="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-xl">
					<div class="text-center mb-8">
						<h1 class="text-3xl font-bold text-white mb-2">Welcome back</h1>
						<p class="text-gray-400">Sign in to your account</p>
					</div>

					<Show when={props.magicLinkSent?.()}>
						<div class="bg-violet-500/20 border border-violet-500/50 rounded-lg p-4 mb-6">
							<p class="text-violet-300 text-center">
								Check your email for a magic link to sign in.
							</p>
						</div>
					</Show>

					<Show when={props.error?.()}>
						<div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
							<p class="text-red-300 text-center">{props.error?.()}</p>
						</div>
					</Show>

					{props.children}

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

