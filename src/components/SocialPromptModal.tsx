// social media prompt modal shown before download

import X from "lucide-solid/icons/x";
import { type Component, Show } from "solid-js";

interface SocialLinks {
	instagram?: string;
	soundcloud?: string;
	tiktok?: string;
}

interface SocialPromptModalProps {
	isOpen: boolean;
	onClose: () => void;
	onDownload: () => void;
	artistName: string;
	socialLinks: SocialLinks | null;
}

export const SocialPromptModal: Component<SocialPromptModalProps> = (props) => {
	const hasSocialLinks = () => {
		const links = props.socialLinks;
		return links && (links.instagram || links.soundcloud || links.tiktok);
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
				{/* backdrop */}
				<div
					class="absolute inset-0 bg-black/60 backdrop-blur-sm"
					onClick={props.onClose}
				/>

				{/* modal */}
				<div class="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
					<button
						type="button"
						onClick={props.onClose}
						class="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
					>
						<X class="w-5 h-5" />
					</button>

					<div class="text-center mb-6">
						<h3 class="text-xl font-semibold text-white mb-2">
							Before you download...
						</h3>
						<p class="text-gray-400">
							Consider following{" "}
							<span class="text-violet-400">{props.artistName}</span> on social
							media!
						</p>
					</div>

					<Show when={hasSocialLinks()}>
						<div class="space-y-3 mb-6">
							<Show when={props.socialLinks?.instagram}>
								<a
									href={`https://instagram.com/${props.socialLinks?.instagram}`}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all"
								>
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
									</svg>
									Follow on Instagram
								</a>
							</Show>

							<Show when={props.socialLinks?.soundcloud}>
								<a
									href={`https://soundcloud.com/${props.socialLinks?.soundcloud}`}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-3 w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all"
								>
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.001v8.368zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689h1v-5.811z" />
									</svg>
									Follow on SoundCloud
								</a>
							</Show>

							<Show when={props.socialLinks?.tiktok}>
								<a
									href={`https://tiktok.com/@${props.socialLinks?.tiktok}`}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-3 w-full px-4 py-3 bg-black border border-slate-600 hover:bg-slate-900 text-white rounded-lg font-medium transition-all"
								>
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
									</svg>
									Follow on TikTok
								</a>
							</Show>
						</div>
					</Show>

					<div class="flex gap-3">
						<button
							type="button"
							onClick={props.onClose}
							class="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={props.onDownload}
							class="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-lg font-medium transition-all"
						>
							Download Anyway
						</button>
					</div>
				</div>
			</div>
		</Show>
	);
};

export default SocialPromptModal;
