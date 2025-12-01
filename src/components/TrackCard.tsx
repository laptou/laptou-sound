import "./TrackCard.css";

import { useQuery } from "@tanstack/solid-query";
import Music from "lucide-solid/icons/music";
import { type Component, Show } from "solid-js";
import { getUserInfo } from "@/server/users";
import { formatSmartDate } from "@/lib/utils";
import { Link } from "@tanstack/solid-router";

// minimal track shape required by the card
interface TrackLike {
	id: string;
	ownerId: string;
	title: string;
	description?: string | null;
	createdAt: Date;
	albumArtKey?: string | null;
}

interface TrackCardProps {
	track: TrackLike;
	// optional pre-fetched info (skips query if provided)
	ownerName?: string;
	ownerImage?: string | null;
}

export const TrackCard: Component<TrackCardProps> = (props) => {
	// fetch owner info if not provided
	const ownerQuery = useQuery(() => ({
		queryKey: ["user", props.track.ownerId],
		queryFn: () => getUserInfo({ data: { userId: props.track.ownerId } }),
		enabled: props.ownerName === undefined,
		staleTime: 1000 * 60 * 5, // cache for 5 min
	}));

	const displayName = () =>
		props.ownerName ?? ownerQuery.data?.name ?? "Unknown";

	const ownerImage = () =>
		props.ownerImage !== undefined
			? props.ownerImage
			: (ownerQuery.data?.image ?? null);

	const albumArtUrl = () =>
		props.track.albumArtKey ? `/files/${props.track.albumArtKey}` : null;

	return (
		<Link
			to={`/track/${props.track.id}`}
			class="group flex bg-stone-900/50 hover:bg-stone-900/80 transition-colors rounded-sm overflow-clip"
		>
			<div class="relative w-40 h-40 shrink-0 bg-stone-800">
				<Show
					when={albumArtUrl()}
					fallback={
						<div class="absolute inset-0 flex items-center justify-center tc-vt-track-album-art">
							<Music class="w-8 h-8 text-stone-600" />
						</div>
					}
				>
					{(url) => (
						<img src={url()} alt="" class="w-full h-full object-cover tc-vt-track-album-art" />
					)}
				</Show>
			</div>

			{/* track info */}
			<div class="flex-1 min-w-0 px-8 py-3 flex flex-col justify-center group">
				<h3 class="font-bold text-2xl transition-colors tc-vt-track-name w-fit">
					{props.track.title}
				</h3>
				<div class="flex items-center gap-2 mt-0.5">
					<Show when={ownerImage()}>
						{(img) => (
							<img
								src={img()}
								alt=""
								class="w-4 h-4 rounded-full object-cover"
							/>
						)}
					</Show>
					<span class="text-sm tc-vt-track-metadata">
						<span class="opacity-70">uploaded by </span>
						<span class="opacity-70 group-hover:opacity-80">
							{displayName()}
						</span>
						<span class="opacity-50">
							&nbsp;&bull;&nbsp;{formatSmartDate(props.track.createdAt)}
						</span>
					</span>
				</div>
			</div>
		</Link>
	);
};

export default TrackCard;
