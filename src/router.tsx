import { createRouter } from "@tanstack/solid-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import { RouteError } from "./components/RouteError";

// Create a new router instance with error handling
export const getRouter = () => {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		// default error component for all routes
		defaultErrorComponent: RouteError,
	});
	return router;
};
