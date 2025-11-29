// wrapper utility for adding error handling and logging to server functions

import { createServerFn } from "@tanstack/solid-start";
import { logInfo, logError, reportError } from "./logger";
import { trackError } from "./error-reporter";

// wrap a server function handler with error handling and logging
export function wrapServerFn<T extends (...args: any[]) => Promise<any>>(
	fnName: string,
	handler: T,
): T {
	return (async (...args: Parameters<T>) => {
		const startTime = Date.now();
		logInfo(`Server function called: ${fnName}`, {
			function: fnName,
			args: args.length > 0 ? "provided" : "none",
		});

		try {
			const result = await handler(...args);
			const duration = Date.now() - startTime;

			logInfo(`Server function completed: ${fnName}`, {
				function: fnName,
				duration: `${duration}ms`,
			});

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error instanceof Error ? error : new Error(String(error));

			logError(`Server function error: ${fnName}`, {
				function: fnName,
				duration: `${duration}ms`,
				error: err.message,
				stack: err.stack,
			});

			trackError(err, {
				function: fnName,
				duration: `${duration}ms`,
			});

			reportError(err, {
				function: fnName,
				duration: `${duration}ms`,
			});

			throw error;
		}
	}) as T;
}

// helper to create a server function with automatic error handling
export function createLoggedServerFn<T extends (...args: any[]) => Promise<any>>(
	fnName: string,
	handler: T,
) {
	return createServerFn().handler(wrapServerFn(fnName, handler));
}

