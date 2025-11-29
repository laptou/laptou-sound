// main navigation header
import { Link } from "@tanstack/solid-router";
import { Show, createSignal, createEffect } from "solid-js";
import { useSession } from "../lib/auth-client";
import { Music2, Upload, Settings, LogOut, Menu, X, Moon, Sun, Shield } from "lucide-solid";

export default function Header() {
  const session = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [isDark, setIsDark] = createSignal(false);

  // check initial theme
  createEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored = localStorage.getItem("theme");
    const dark = stored === "dark" || (!stored && prefersDark);
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  });

  const toggleTheme = () => {
    const newDark = !isDark();
    setIsDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  const user = () => session()?.data?.user;
  const isUploader = () => false; // simplified for now
  const isAdmin = () => false; // simplified for now

  return (
    <header class="sticky top-0 z-50 glass border-b border-surface-200 dark:border-surface-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between h-16">
          {/* logo */}
          <Link
            href="/"
            class="flex items-center gap-2 text-surface-900 dark:text-white hover:text-accent-600 dark:hover:text-accent-400 transition-colors"
          >
            <div class="p-2 bg-accent-500 rounded-xl">
              <Music2 class="w-5 h-5 text-white" />
            </div>
            <span class="font-bold text-lg tracking-tight">laptou sound</span>
          </Link>

          {/* desktop nav */}
          <nav class="hidden md:flex items-center gap-1">
            <Link
              href="/"
              class="btn-ghost text-sm"
              activeProps={{ class: "bg-surface-100 dark:bg-surface-800" }}
            >
              Discover
            </Link>

            <Show when={isUploader()}>
              <Link
                href="/upload"
                class="btn-ghost text-sm"
                activeProps={{ class: "bg-surface-100 dark:bg-surface-800" }}
              >
                <Upload class="w-4 h-4" />
                Upload
              </Link>
            </Show>

            <Show when={isAdmin()}>
              <Link
                href="/admin"
                class="btn-ghost text-sm"
                activeProps={{ class: "bg-surface-100 dark:bg-surface-800" }}
              >
                <Shield class="w-4 h-4" />
                Admin
              </Link>
            </Show>
          </nav>

          {/* right side */}
          <div class="flex items-center gap-2">
            {/* theme toggle */}
            <button
              onClick={toggleTheme}
              class="btn-icon btn-ghost"
              aria-label="Toggle theme"
            >
              <Show when={isDark()} fallback={<Moon class="w-5 h-5" />}>
                <Sun class="w-5 h-5" />
              </Show>
            </button>

            {/* user menu */}
            <Show
              when={user()}
              fallback={
                <div class="hidden md:flex items-center gap-2">
                  <Link href="/auth/login" class="btn-ghost text-sm">
                    Log in
                  </Link>
                  <Link href="/auth/signup" class="btn-primary text-sm">
                    Sign up
                  </Link>
                </div>
              }
            >
              <div class="hidden md:flex items-center gap-2">
                <Link href="/settings" class="btn-icon btn-ghost">
                  <Settings class="w-5 h-5" />
                </Link>
                <Link
                  href="/api/auth/signout"
                  class="btn-icon btn-ghost text-red-500 hover:text-red-600"
                >
                  <LogOut class="w-5 h-5" />
                </Link>
                <Show when={user()?.image}>
                  <img
                    src={user()!.image!}
                    alt={user()?.name || "User"}
                    class="w-8 h-8 rounded-full ring-2 ring-surface-200 dark:ring-surface-700"
                  />
                </Show>
              </div>
            </Show>

            {/* mobile menu button */}
            <button
              class="btn-icon btn-ghost md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen())}
              aria-label="Toggle menu"
            >
              <Show when={mobileMenuOpen()} fallback={<Menu class="w-5 h-5" />}>
                <X class="w-5 h-5" />
              </Show>
            </button>
          </div>
        </div>

        {/* mobile menu */}
        <Show when={mobileMenuOpen()}>
          <nav class="md:hidden py-4 border-t border-surface-200 dark:border-surface-800 animate-fade-in">
            <div class="flex flex-col gap-1">
              <Link
                href="/"
                class="btn-ghost justify-start"
                onClick={() => setMobileMenuOpen(false)}
              >
                Discover
              </Link>

              <Show when={isUploader()}>
                <Link
                  href="/upload"
                  class="btn-ghost justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Upload class="w-4 h-4" />
                  Upload
                </Link>
              </Show>

              <Show when={isAdmin()}>
                <Link
                  href="/admin"
                  class="btn-ghost justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Shield class="w-4 h-4" />
                  Admin
                </Link>
              </Show>

              <div class="h-px bg-surface-200 dark:bg-surface-800 my-2" />

              <Show
                when={user()}
                fallback={
                  <>
                    <Link
                      href="/auth/login"
                      class="btn-ghost justify-start"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/auth/signup"
                      class="btn-primary justify-start"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign up
                    </Link>
                  </>
                }
              >
                <Link
                  href="/settings"
                  class="btn-ghost justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings class="w-4 h-4" />
                  Settings
                </Link>
                <Link
                  href="/api/auth/signout"
                  class="btn-ghost justify-start text-red-500"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogOut class="w-4 h-4" />
                  Log out
                </Link>
              </Show>
            </div>
          </nav>
        </Show>
      </div>
    </header>
  );
}
