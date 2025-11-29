// root layout - wraps all pages
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { HydrationScript } from "solid-js/web";
import { Suspense } from "solid-js";

import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";

import styleCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#3b82f6" },
    ],
    links: [
      { rel: "stylesheet", href: styleCss },
      { rel: "icon", href: "/favicon.ico" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
    ],
  }),
  shellComponent: RootShell,
});

function RootShell() {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
      </head>
      <body class="min-h-screen bg-gradient-subtle">
        <HeadContent />
        <Suspense
          fallback={
            <div class="min-h-screen flex items-center justify-center">
              <LoadingSpinner size="lg" text="Loading..." />
            </div>
          }
        >
          <div class="flex flex-col min-h-screen">
            <Header />
            <main class="flex-1">
              <Outlet />
            </main>
            <Footer />
          </div>
          <TanStackRouterDevtools position="bottom-right" />
        </Suspense>
        <Scripts />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer class="border-t border-surface-200 dark:border-surface-800 py-8 mt-auto">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <p class="text-small">
            © {new Date().getFullYear()} laptou sound. All rights reserved.
          </p>
          <div class="flex items-center gap-6 text-small">
            <a href="/about" class="hover:text-accent-500 transition-colors">
              About
            </a>
            <a href="/privacy" class="hover:text-accent-500 transition-colors">
              Privacy
            </a>
            <a href="/terms" class="hover:text-accent-500 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
