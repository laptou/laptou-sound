import { createStart } from "@tanstack/solid-start";
import { commonMiddleware } from "./lib/middleware";

export const startInstance = createStart(() => {
	return {
		requestMiddleware: commonMiddleware,
	};
});
