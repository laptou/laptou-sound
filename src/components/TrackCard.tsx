// track card component for displaying track in lists

import Play from "lucide-solid/icons/play";
import type { Component } from "solid-js";
import type { Track } from "@/db/schema";

interface TrackCardProps {
	track: Track;
	ownerName?: string;
	onPlay?: () => void;
}

export const TrackCard: Component<TrackCardProps> = (props) => {
	return (
		<a
			href={`/track/${props.track.id}`}
			class="group block bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10"
		>
			<div class="flex items-start gap-4">
				{/* play button overlay */}
				<div class="relative w-16 h-16 flex-shrink-0">
					<div class="absolute inset-0 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" />
					<div class="absolute inset-0 flex items-center justify-center">
						<Play class="w-8 h-8 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
					</div>
				</div>

				{/* track info */}
				<div class="flex-1 min-w-0">
					<h3 class="text-white font-medium truncate group-hover:text-violet-300 transition-colors">
						{props.track.title}
					</h3>
					<p class="text-gray-400 text-sm truncate">
						{props.ownerName ?? "Unknown Artist"}
					</p>
					{props.track.description && (
						<p class="text-gray-500 text-xs mt-1 line-clamp-2">
							{props.track.description}
						</p>
					)}
				</div>
			</div>
		</a>
	);
};

export default TrackCard;
