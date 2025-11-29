// error reporting and tracking utility

import type { LogContext } from "./logger";
import { reportError } from "./logger";

// error store for tracking errors (in-memory, server-side)
const errorStore = new Map<
	string,
	{ count: number; lastSeen: Date; firstSeen: Date; error: Error; context?: LogContext }
>();

export interface ErrorReport {
	id: string;
	count: number;
	lastSeen: Date;
	firstSeen: Date;
	error: {
		name: string;
		message: string;
		stack?: string;
	};
	context?: LogContext;
}

// report and track errors
export function trackError(error: Error, context?: LogContext): string {
	const errorKey = `${error.name}:${error.message}`;
	const existing = errorStore.get(errorKey);

	if (existing) {
		existing.count++;
		existing.lastSeen = new Date();
		existing.context = { ...existing.context, ...context };
	} else {
		errorStore.set(errorKey, {
			count: 1,
			lastSeen: new Date(),
			firstSeen: new Date(),
			error,
			context,
		});
	}

	// report to logger
	reportError(error, context);

	return errorKey;
}

// get all tracked errors
export function getTrackedErrors(): ErrorReport[] {
	return Array.from(errorStore.entries()).map(([id, data]) => ({
		id,
		count: data.count,
		lastSeen: data.lastSeen,
		firstSeen: data.firstSeen,
		error: {
			name: data.error.name,
			message: data.error.message,
			stack: data.error.stack,
		},
		context: data.context,
	}));
}

// clear error store
export function clearErrorStore() {
	errorStore.clear();
}

