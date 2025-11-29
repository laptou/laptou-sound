// toggle component for switching between password and magic link login

import { Button } from "@ui/button";

type LoginMethodToggleProps = {
	useMagicLink: () => boolean;
	onToggle: (useMagicLink: boolean) => void;
};

export function LoginMethodToggle(props: LoginMethodToggleProps) {
	return (
		<div class="flex mb-6 bg-slate-700/50 rounded-lg p-1">
			<Button
				type="button"
				onClick={() => props.onToggle(false)}
				variant={!props.useMagicLink() ? "default" : "ghost"}
				class="flex-1"
			>
				Password
			</Button>
			<Button
				type="button"
				onClick={() => props.onToggle(true)}
				variant={props.useMagicLink() ? "default" : "ghost"}
				class="flex-1"
			>
				Magic Link
			</Button>
		</div>
	);
}
