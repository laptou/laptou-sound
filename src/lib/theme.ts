// theme management utilities

import { createSignal } from "solid-js";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "laptou-sound-theme";

// create a reactive theme signal
const [theme, setThemeState] = createSignal<Theme>("system");
const [resolvedTheme, setResolvedTheme] = createSignal<"light" | "dark">(
	"dark",
);

// initialize theme from storage/system
export function initializeTheme() {
	if (typeof window === "undefined") return;

	const stored = localStorage.getItem(THEME_KEY) as Theme | null;
	if (stored && ["light", "dark", "system"].includes(stored)) {
		setThemeState(stored);
	}

	updateResolvedTheme();
	applyTheme();

	// listen for system preference changes
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	mediaQuery.addEventListener("change", () => {
		if (theme() === "system") {
			updateResolvedTheme();
			applyTheme();
		}
	});
}

function updateResolvedTheme() {
	const currentTheme = theme();
	if (currentTheme === "system") {
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		setResolvedTheme(prefersDark ? "dark" : "light");
	} else {
		setResolvedTheme(currentTheme);
	}
}

function applyTheme() {
	const resolved = resolvedTheme();
	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);
}

export function setTheme(newTheme: Theme) {
	setThemeState(newTheme);
	localStorage.setItem(THEME_KEY, newTheme);
	updateResolvedTheme();
	applyTheme();
}

export function useTheme() {
	return {
		theme,
		resolvedTheme,
		setTheme,
	};
}
