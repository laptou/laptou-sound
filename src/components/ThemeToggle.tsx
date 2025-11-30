// theme toggle button component

import Monitor from "lucide-solid/icons/monitor";
import Moon from "lucide-solid/icons/moon";
import Sun from "lucide-solid/icons/sun";
import { type Component, onMount, Show } from "solid-js";
import { initializeTheme, useTheme } from "@/lib/theme";

export const ThemeToggle: Component = () => {
	const { theme, resolvedTheme, setTheme } = useTheme();

	onMount(() => {
		initializeTheme();
	});

	const cycleTheme = () => {
		const current = theme();
		if (current === "system") {
			setTheme("light");
		} else if (current === "light") {
			setTheme("dark");
		} else {
			setTheme("system");
		}
	};

	return (
		<button
			type="button"
			onClick={cycleTheme}
			class="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
			title={`Current: ${theme()} (${resolvedTheme()})`}
		>
			<Show
				when={theme() === "system"}
				fallback={
					<Show
						when={resolvedTheme() === "dark"}
						fallback={<Sun class="w-5 h-5" />}
					>
						<Moon class="w-5 h-5" />
					</Show>
				}
			>
				<Monitor class="w-5 h-5" />
			</Show>
		</button>
	);
};

export default ThemeToggle;
