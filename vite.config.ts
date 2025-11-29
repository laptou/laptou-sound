import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		devtools(),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart(),
		solid({ ssr: true }),
	],
	build: {
		rollupOptions: {
			// externalize cloudflare-specific modules from client bundle
			external: ["cloudflare:workers"],
		},
	},
});
