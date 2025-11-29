// generic form field component for tanstack form

import { Show } from "solid-js";
import type { FieldApi } from "@tanstack/solid-form";

type FormFieldProps = {
	field: FieldApi<any, any, undefined, string, string>;
	label: string;
	type?: string;
	placeholder?: string;
	required?: boolean;
};

export function FormField(props: FormFieldProps) {
	return (
		<div>
			<label
				for={props.field().name}
				class="block text-sm font-medium text-gray-300 mb-2"
			>
				{props.label}
			</label>
			<input
				id={props.field().name}
				name={props.field().name}
				type={props.type || "text"}
				value={props.field().state.value}
				onInput={(e) => props.field().handleChange(e.currentTarget.value)}
				onBlur={props.field().handleBlur}
				required={props.required !== false}
				class="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
				placeholder={props.placeholder}
			/>
			<Show when={props.field().state.meta.errors.length > 0}>
				<p class="mt-1 text-sm text-red-400">
					{props.field().state.meta.errors[0]}
				</p>
			</Show>
		</div>
	);
}

