// wrapper utility for adding error handling and logging to route loaders

import { logInfo, logError, reportError } from "./logger";
import { trackError } from "./error-reporter";

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

			logInfo(`Loader completed: ${routeId}`, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
			});

			// warn on slow loaders
			if (duration > 1000) {
				logError(`Slow loader detected: ${routeId}`, {
					route: routeId,
					duration: `${duration}ms`,
				});
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error instanceof Error ? error : new Error(String(error));

			logError(`Loader error: ${routeId}`, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
				error: err.message,
				stack: err.stack,
			});

			trackError(err, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
			});

			reportError(err, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
			});

			throw error;
		}
	}) as T;
}

