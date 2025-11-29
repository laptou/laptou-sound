// toggle component for switching between password and magic link login

type LoginMethodToggleProps = {
	useMagicLink: () => boolean;
	onToggle: (useMagicLink: boolean) => void;
};

export function LoginMethodToggle(props: LoginMethodToggleProps) {
	return (
		<div class="flex mb-6 bg-slate-700/50 rounded-lg p-1">
			<button
				type="button"
				onClick={() => props.onToggle(false)}
				class={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
					!props.useMagicLink()
						? "bg-violet-500 text-white"
						: "text-gray-400 hover:text-white"
				}`}
			>
				Password
			</button>
			<button
				type="button"
				onClick={() => props.onToggle(true)}
				class={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
					props.useMagicLink()
						? "bg-violet-500 text-white"
						: "text-gray-400 hover:text-white"
				}`}
			>
				Magic Link
			</button>
		</div>
	);
}
