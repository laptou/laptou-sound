// wrapper utility for adding error handling and logging to route loaders

import { trackError } from "./error-reporter";
import { logError, logInfo, logTrace, logWarn, reportError } from "./logger";

// wrap a loader function with error handling and logging
export function wrapLoader<T extends (...args: any[]) => Promise<any>>(
	routeId: string,
	loader: T,
): T {
	return (async (...args: Parameters<T>) => {
		const startTime = Date.now();
		const isServer = typeof window === "undefined";

		logInfo(`Loader called: ${routeId}`, {
			route: routeId,
			environment: isServer ? "server" : "client",
		});

		try {
			const result = await loader(...args);
			const duration = Date.now() - startTime;

			logTrace(`[loader] completed ${routeId}`, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
			});

			// warn on slow loaders
			if (duration > 1000) {
				logWarn(`[loader] slow: ${routeId}`, {
					route: routeId,
					duration: `${duration}ms`,
				});
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error instanceof Error ? error : new Error(String(error));

			logError(`[loader] failed ${routeId}`, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
				error: err.message,
				stack: err.stack,
			});

			throw error;
		}
	}) as T;
}
