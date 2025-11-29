// track settings page - download controls and social prompts
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/solid-router";
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	Download,
	Instagram,
	Music2,
	Save,
	Video,
} from "lucide-solid";
import { createEffect, createSignal, Show } from "solid-js";
import type { SocialPrompt } from "../../../lib/db/types";
import { getSession } from "../../../lib/server/auth";
import { fetchTrack, updateTrackSettings } from "../../../lib/server/tracks";

export const Route = createFileRoute("/track/$trackId/settings")({
	head: () => ({
		meta: [{ title: "Track settings - laptou sound" }],
	}),
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session?.user) {
			throw redirect({ to: "/auth/login" });
		}
		return { session };
	},
	loader: async ({ params, context }) => {
		const track = await fetchTrack({ data: params.trackId });
		const session = (context as any).session;

		// check ownership
		if (track.uploader_id !== session.user.id && session.role !== "admin") {
			throw redirect({ to: `/track/${params.trackId}` });
		}

		return { track };
	},
	component: TrackSettingsPage,
});

function TrackSettingsPage() {
	const data = Route.useLoaderData();
	const params = Route.useParams();
	const _navigate = useNavigate();

	const track = () => data()?.track;

	// parse existing social prompt
	const existingSocialPrompt = (): SocialPrompt => {
		if (!track()?.social_prompt) return {};
		try {
			return JSON.parse(track()?.social_prompt!);
		} catch {
			return {};
		}
	};

	const [isDownloadable, setIsDownloadable] = createSignal(
		Boolean(track()?.is_downloadable),
	);
	const [instagram, setInstagram] = createSignal(
		existingSocialPrompt().instagram || "",
	);
	const [soundcloud, setSoundcloud] = createSignal(
		existingSocialPrompt().soundcloud || "",
	);
	const [tiktok, setTiktok] = createSignal(existingSocialPrompt().tiktok || "");

	const [saving, setSaving] = createSignal(false);
	const [saveState, setSaveState] = createSignal<"idle" | "success" | "error">(
		"idle",
	);
	const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

	// update state when data loads
	createEffect(() => {
		const t = track();
		if (t) {
			setIsDownloadable(Boolean(t.is_downloadable));
			const sp = existingSocialPrompt();
			setInstagram(sp.instagram || "");
			setSoundcloud(sp.soundcloud || "");
			setTiktok(sp.tiktok || "");
		}
	});

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setSaving(true);
		setSaveState("idle");
		setErrorMessage(null);

		try {
			const socialPrompt: SocialPrompt = {};
			if (instagram().trim()) socialPrompt.instagram = instagram().trim();
			if (soundcloud().trim()) socialPrompt.soundcloud = soundcloud().trim();
			if (tiktok().trim()) socialPrompt.tiktok = tiktok().trim();

			await updateTrackSettings({
				data: {
					trackId: params.trackId,
					isDownloadable: isDownloadable(),
					socialPrompt:
						Object.keys(socialPrompt).length > 0 ? socialPrompt : undefined,
				},
			});

			setSaveState("success");

			// reset after delay
			setTimeout(() => {
				setSaveState("idle");
			}, 3000);
		} catch (err: any) {
			console.error("Failed to save settings:", err);
			setSaveState("error");
			setErrorMessage(err.message || "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
			<div class="animate-fade-in-up">
				{/* header */}
				<div class="flex items-center gap-4 mb-8">
					<Link href={`/track/${params.trackId}`} class="btn-icon btn-ghost">
						<ArrowLeft class="w-5 h-5" />
					</Link>
					<div class="flex-1 min-w-0">
						<h1 class="text-title">Track settings</h1>
						<p class="text-small truncate">"{track()?.title}"</p>
					</div>
				</div>

				<form onSubmit={handleSubmit} class="space-y-8">
					{/* download settings */}
					<section class="card p-6">
						<h2 class="text-subtitle mb-4 flex items-center gap-2">
							<Download class="w-5 h-5 text-accent-500" />
							Download settings
						</h2>

						<label class="flex items-start gap-4 cursor-pointer">
							<div class="pt-0.5">
								<input
									type="checkbox"
									checked={isDownloadable()}
									onChange={(e) => setIsDownloadable(e.currentTarget.checked)}
									class="w-5 h-5 rounded border-surface-300 dark:border-surface-600 text-accent-500 focus:ring-accent-500"
								/>
							</div>
							<div>
								<span class="font-medium">Allow downloads</span>
								<p class="text-small mt-1">
									When enabled, users can download the original quality version
									of this track.
								</p>
							</div>
						</label>
					</section>

					{/* social prompts */}
					<section class="card p-6">
						<h2 class="text-subtitle mb-2">Social media prompts</h2>
						<p class="text-small mb-6">
							Optionally prompt users to follow your social accounts before
							downloading. Leave empty to skip.
						</p>

						<div class="space-y-4">
							<div>
								<label class="block text-sm font-medium mb-2">
									<Instagram class="w-4 h-4 inline mr-2" />
									Instagram username
								</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
										@
									</span>
									<input
										type="text"
										value={instagram()}
										onInput={(e) => setInstagram(e.currentTarget.value)}
										class="input pl-8"
										placeholder="yourusername"
										maxLength={30}
									/>
								</div>
							</div>

							<div>
								<label class="block text-sm font-medium mb-2">
									<Music2 class="w-4 h-4 inline mr-2" />
									SoundCloud username
								</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
										soundcloud.com/
									</span>
									<input
										type="text"
										value={soundcloud()}
										onInput={(e) => setSoundcloud(e.currentTarget.value)}
										class="input pl-32"
										placeholder="yourusername"
										maxLength={50}
									/>
								</div>
							</div>

							<div>
								<label class="block text-sm font-medium mb-2">
									<Video class="w-4 h-4 inline mr-2" />
									TikTok username
								</label>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
										@
									</span>
									<input
										type="text"
										value={tiktok()}
										onInput={(e) => setTiktok(e.currentTarget.value)}
										class="input pl-8"
										placeholder="yourusername"
										maxLength={30}
									/>
								</div>
							</div>
						</div>
					</section>

					{/* save status */}
					<Show when={saveState() !== "idle"}>
						<div
							class={`p-4 rounded-xl ${
								saveState() === "success"
									? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400"
									: "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"
							}`}
						>
							<div class="flex items-center gap-2">
								<Show
									when={saveState() === "success"}
									fallback={<AlertCircle class="w-5 h-5" />}
								>
									<CheckCircle2 class="w-5 h-5" />
								</Show>
								<span>
									{saveState() === "success"
										? "Settings saved successfully!"
										: errorMessage()}
								</span>
							</div>
						</div>
					</Show>

					{/* save button */}
					<button type="submit" class="btn-primary w-full" disabled={saving()}>
						<Save class="w-4 h-4" />
						{saving() ? "Saving..." : "Save settings"}
					</button>
				</form>
			</div>
		</div>
	);
}
