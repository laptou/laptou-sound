// custom error classes for distinguishing anticipated vs unanticipated errors

// base class for anticipated errors - these are expected errors that should show friendly messages
export class AnticipatedError extends Error {
	constructor(
		message: string,
		public readonly title?: string,
		public readonly statusCode?: number,
	) {
		super(message);
		this.name = "AnticipatedError";
		// maintain proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AnticipatedError);
		}
	}
}

// specific anticipated error types
export class AccessDeniedError extends AnticipatedError {
	constructor(
		message: string = "You don't have permission to access this resource",
	) {
		super(message, "Access Denied", 403);
		this.name = "AccessDeniedError";
	}
}

export class NotFoundError extends AnticipatedError {
	constructor(message: string = "The requested resource was not found") {
		super(message, "Not Found", 404);
		this.name = "NotFoundError";
	}
}

export class ValidationError extends AnticipatedError {
	constructor(message: string = "Invalid input provided") {
		super(message, "Validation Error", 400);
		this.name = "ValidationError";
	}
}

// type guard to check if an error is anticipated
export function isAnticipatedError(error: unknown): error is AnticipatedError {
	return error instanceof AnticipatedError;
}
