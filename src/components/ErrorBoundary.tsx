// client-side error boundary component for wrapping the app
// note: tanstack router handles route-level errors via errorComponent
// this is for catching errors outside of routes

import { createSignal, ErrorBoundary, Show } from "solid-js";

interface AppErrorBoundaryProps {
	children: import("solid-js").JSX.Element;
	fallback?: (
		error: Error,
		reset: () => void,
	) => import("solid-js").JSX.Element;
}

// simple error boundary using solid-js error handling
export function AppErrorBoundary(props: AppErrorBoundaryProps) {
	return (
		<ErrorBoundary
			fallback={(error, reset) => (
				<AppErrorFallback error={error} reset={reset} />
			)}
		>
			{props.children}
		</ErrorBoundary>
	);
}

interface AppErrorFallbackProps {
	error: Error;
	reset: () => void;
}

function AppErrorFallback(props: AppErrorFallbackProps) {
	const [showDetails, setShowDetails] = createSignal(false);

	return (
		<div
			role="alert"
			class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4"
		>
			<div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
				<div class="flex items-center mb-4">
					<svg
						class="w-8 h-8 text-red-500 mr-3"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
						Something went wrong
					</h2>
				</div>

				<p class="text-gray-600 dark:text-gray-300 mb-4">
					An unexpected error occurred. Please try again or refresh the page.
				</p>

				<Show when={import.meta.env.DEV}>
					<button
						type="button"
						onClick={() => setShowDetails(!showDetails())}
						class="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
					>
						{showDetails() ? "Hide" : "Show"} error details
					</button>

					<Show when={showDetails()}>
						<div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
							<p class="text-sm font-mono text-red-800 dark:text-red-200 break-all">
								<strong>{props.error.name}:</strong> {props.error.message}
							</p>
							<Show when={props.error.stack}>
								<pre class="text-xs text-red-700 dark:text-red-300 mt-2 overflow-auto max-h-40">
									{props.error.stack}
								</pre>
							</Show>
						</div>
					</Show>
				</Show>

				<div class="flex gap-3">
					<button
						type="button"
						onClick={props.reset}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
					>
						Try again
					</button>
					<button
						type="button"
						onClick={() => window.location.reload()}
						class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
					>
						Refresh page
					</button>
				</div>
			</div>
		</div>
	);
}
