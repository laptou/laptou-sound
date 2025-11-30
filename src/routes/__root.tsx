// root layout with html shell

import { SolidQueryDevtools } from "@tanstack/solid-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { onMount, Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import { getSession } from "@/lib/auth";
import { initializeTheme } from "@/lib/theme";
import styleCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{
				name: "description",
				content:
					"Share your music with the community. Upload tracks, get feedback, and discover new sounds.",
			},
		],
		links: [
			{ rel: "stylesheet", href: styleCss },
			{ rel: "icon", href: "/favicon.ico" },
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossorigin: "",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap",
			},
		],
		title: "laptou sound",
	}),
	beforeLoad: async () => {
		const session = await getSession();
		console.log("root session", session);
		return { session };
	},
	shellComponent: RootDocument,
	// errorComponent: (props) => {
	// 	return (
	// 		<RootDocument>
	// 			<ErrorBoundary {...props} />
	// 		</RootDocument>
	// 	);
	// },
});

function RootDocument() {
	onMount(() => {
		initializeTheme();
	});

	return (
		<html>
			<head>
				<HydrationScript />
			</head>
			<body class="min-h-screen">
				<HeadContent />
				<Suspense>
					<Outlet />
					<TanStackRouterDevtools position="bottom-right" />
					<SolidQueryDevtools buttonPosition="bottom-left" />
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
