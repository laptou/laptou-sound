// client entry point with error boundary

import { hydrate } from "solid-js/web";
import { StartClient, hydrateStart } from "@tanstack/solid-start/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logInfo } from "./lib/logger";

// initialize client-side logging
logInfo("Client entry point initializing", {
	url: window.location.href,
	userAgent: navigator.userAgent,
});

hydrateStart()
	.then((router) => {
		logInfo("Router hydrated, starting client", {
			routeCount: router.routeTree?.routes?.length || 0,
		});

		hydrate(
			() => (
				<ErrorBoundary>
					<StartClient router={router} />
				</ErrorBoundary>
			),
			document,
		);
	})
	.catch((error) => {
		console.error("[CLIENT] Failed to initialize router:", error);
		// fallback: try to render without router
		hydrate(
			() => (
				<ErrorBoundary>
					<div class="min-h-screen flex items-center justify-center">
						<div class="text-center">
							<h1 class="text-2xl font-bold mb-4">Initialization Error</h1>
							<p class="text-gray-600 dark:text-gray-400">
								Failed to initialize the application. Please refresh the page.
							</p>
							<button
								type="button"
								onClick={() => window.location.reload()}
								class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
							>
								Refresh Page
							</button>
						</div>
					</div>
				</ErrorBoundary>
			),
			document,
		);
	});

