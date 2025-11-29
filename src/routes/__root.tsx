// root layout with html shell

import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { onMount, Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";

import Header from "../components/Header";
import { initializeTheme } from "../lib/theme";

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
	shellComponent: RootComponent,
});

function RootComponent() {
	onMount(() => {
		initializeTheme();
	});

	return (
		<html class="dark">
			<head>
				<HydrationScript />
			</head>
			<body class="min-h-screen">
				<HeadContent />
				<Suspense>
					<Header />
					<main>
						<Outlet />
					</main>
					<TanStackRouterDevtools position="bottom-right" />
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
