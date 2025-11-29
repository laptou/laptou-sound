import { QueryClient } from "@tanstack/solid-query";
import { createRouter } from "@tanstack/solid-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/solid-router-ssr-query";
import { RouteError } from "./components/RouteError";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance with error handling
export const getRouter = () => {
	const queryClient = new QueryClient();

	const router = createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		// default error component for all routes
		defaultErrorComponent: RouteError,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
};
