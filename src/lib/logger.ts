// isomorphic logger utility for detailed logging and error tracking

import { createIsomorphicFn } from "@tanstack/solid-start";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

// structured logger with environment-specific behavior
export const logger = createIsomorphicFn()
	.server((level: LogLevel, message: string, context?: LogContext) => {
		const timestamp = new Date().toISOString();
		const logEntry = {
			timestamp,
			level,
			message,
			context,
			environment: "server",
			service: "laptou-sound",
		};

		if (process.env.NODE_ENV === "development") {
			// development: detailed console logging with colors
			const levelColors = {
				debug: "\x1b[36m", // cyan
				info: "\x1b[32m", // green
				warn: "\x1b[33m", // yellow
				error: "\x1b[31m", // red
			};
			const reset = "\x1b[0m";
			const color = levelColors[level] || reset;

			console[level === "debug" ? "log" : level](
				`${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`,
				context || "",
			);
		} else {
			// production: structured json logging
			console.log(JSON.stringify(logEntry));
		}
	})
	.client((level: LogLevel, message: string, context?: LogContext) => {
		const timestamp = new Date().toISOString();
		const logEntry = {
			timestamp,
			level,
			message,
			context,
			environment: "client",
			service: "laptou-sound",
			url: typeof window !== "undefined" ? window.location.href : undefined,
			userAgent:
				typeof navigator !== "undefined" ? navigator.userAgent : undefined,
		};

		if (import.meta.env.DEV) {
			// development: detailed console logging
			console[level === "debug" ? "log" : level](
				`[CLIENT] [${timestamp}] [${level.toUpperCase()}] ${message}`,
				context || "",
			);
		} else {
			// production: structured logging (could send to analytics)
			console[level === "debug" ? "log" : level](
				JSON.stringify(logEntry),
			);
			// TODO: integrate with analytics service if needed
			// analytics.track('client_log', logEntry)
		}
	});

// convenience methods
export const logDebug = (message: string, context?: LogContext) =>
	logger("debug", message, context);
export const logInfo = (message: string, context?: LogContext) =>
	logger("info", message, context);
export const logWarn = (message: string, context?: LogContext) =>
	logger("warn", message, context);
export const logError = (message: string, context?: LogContext) =>
	logger("error", message, context);

// error reporting with stack traces
export const reportError = createIsomorphicFn()
	.server((error: Error, context?: LogContext) => {
		const errorContext = {
			name: error.name,
			message: error.message,
			stack: error.stack,
			...context,
		};

		logger("error", `Error: ${error.message}`, errorContext);

		// TODO: integrate with error tracking service (e.g., Sentry)
		// Sentry.captureException(error, { extra: context })
	})
	.client((error: Error, context?: LogContext) => {
		const errorContext = {
			name: error.name,
			message: error.message,
			stack: error.stack,
			url: window.location.href,
			userAgent: navigator.userAgent,
			...context,
		};

		logger("error", `Client Error: ${error.message}`, errorContext);

		// TODO: integrate with error tracking service (e.g., Sentry)
		// Sentry.captureException(error, { extra: context })
	});

