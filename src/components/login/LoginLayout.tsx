// shared layout component for login page

import type { JSX } from "solid-js";

type LoginLayoutProps = {
	children: JSX.Element;
};

export function LoginLayout(props: LoginLayoutProps) {
	return (
		<div class="w-full max-w-md mx-auto">
			<div class="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-8 my-8 shadow-xl">
				<div class="text-center mb-8">
					<h1 class="text-3xl font-bold text-white mb-2">Welcome back</h1>
					<p class="text-gray-400">Sign in to your account</p>
				</div>

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
	);
}
