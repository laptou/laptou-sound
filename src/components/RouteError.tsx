// route-level error component for tanstack router
// handles both anticipated errors (friendly messages) and unanticipated errors (generic messages)

import type { ErrorComponentProps } from "@tanstack/solid-router";
import { Link } from "@tanstack/solid-router";
import { AlertCircle, Home } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { isAnticipatedError } from "@/lib/errors";
import { logError, reportError } from "@/lib/logger";

export function RouteError(props: ErrorComponentProps) {
	const [showDetails, setShowDetails] = createSignal(false);
	const isAnticipated = isAnticipatedError(props.error);

	// only log and report unanticipated errors
	if (!isAnticipated) {
		const errorContext = {
			route: props.error,
			info: props.info,
			location:
				typeof window !== "undefined" ? window.location.href : undefined,
		};

		logError(`Route error in ${props.routeId}`, errorContext);
		reportError(props.error, errorContext);
	}

	return (
		<div
			role="alert"
			class="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4"
		>
			<div class="max-w-md w-full bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6 border border-slate-700">
				<div class="flex items-center mb-4">
					<div class="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mr-3">
						<AlertCircle class="w-6 h-6 text-red-400" />
					</div>
					<h2 class="text-xl font-semibold text-white">
						{isAnticipated
							? props.error.title || "Error"
							: "Something went wrong"}
					</h2>
				</div>

				<p class="text-gray-300 mb-6">
					{isAnticipated
						? props.error.message
						: "An unexpected error occurred. Please try again or go back."}
				</p>

				{/* show error details in dev mode for unanticipated errors */}
				<Show when={!isAnticipated && import.meta.env.DEV}>
					<button
						type="button"
						onClick={() => setShowDetails(!showDetails())}
						class="text-sm text-violet-400 hover:text-violet-300 hover:underline mb-4"
					>
						{showDetails() ? "Hide" : "Show"} error details
					</button>

					<Show when={showDetails()}>
						<div class="mb-4 p-3 bg-red-900/20 rounded border border-red-800">
							<p class="text-sm mb-2 text-gray-400">
								<strong>Route:</strong> {props.routeId}
							</p>
							<p class="text-sm font-mono text-red-300 break-all">
								<strong>{props.error.name}:</strong> {props.error.message}
							</p>
							<Show when={props.error.stack}>
								<pre class="text-xs text-red-400 mt-2 overflow-auto max-h-40">
									{props.error.stack}
								</pre>
							</Show>
						</div>
					</Show>
				</Show>

				<div class="flex gap-3">
					<Show
						when={!isAnticipated}
						fallback={
							<Link
								href="/"
								class="flex-1 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white text-center font-medium rounded-lg transition-all shadow-lg shadow-violet-500/25"
							>
								<Home class="w-4 h-4 inline mr-2" />
								Go Home
							</Link>
						}
					>
						<button
							type="button"
							onClick={() => props.reset()}
							class="flex-1 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-violet-500/25"
						>
							Try again
						</button>
					</Show>
					<button
						type="button"
						onClick={() => window.history.back()}
						class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 font-medium rounded-lg transition-colors"
					>
						Go back
					</button>
				</div>
			</div>
		</div>
	);
}
