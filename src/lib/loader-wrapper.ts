// wrapper utility for adding error handling and logging to route loaders

import { logError, logTrace, logWarn } from "./logger";

// wrap a loader function with error handling and logging
export function wrapLoader<T extends (...args: any[]) => Promise<any>>(
	routeId: string,
	loader: T,
): T {
	return (async (...args: Parameters<T>) => {
		const startTime = Date.now();
		const isServer = typeof window === "undefined";

		try {
			const result = await loader(...args);
			const duration = Date.now() - startTime;

			logTrace(`[loader] completed`, {
				route: routeId,
				environment: isServer ? "server" : "client",
				duration: `${duration}ms`,
			});

			// warn on slow loaders
			if (duration > 1000) {
				logWarn(`[loader] slow`, {
					route: routeId,
					duration: `${duration}ms`,
				});
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error instanceof Error ? error : new Error(String(error));

			logError(`[loader] failed`, {
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
