// generic form field components for tanstack form

import type { JSX } from "solid-js";
import { Label } from "@ui/label";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "@ui/text-field";

// common field accessor type - uses any to avoid complex tanstack form generics
// biome-ignore lint/suspicious/noExplicitAny: tanstack form types are complex
type FieldAccessor<T = any> = () => {
	name: string;
	state: {
		value: T;
		// biome-ignore lint/suspicious/noExplicitAny: errors can be string, undefined, or complex objects
		meta: { errors: any[] };
	};
	handleChange: (value: T) => void;
	handleBlur: () => void;
};

type InputType =
	| "text"
	| "email"
	| "password"
	| "url"
	| "number"
	| "tel"
	| "search"
	| "date"
	| "time";

// text input field
type FormFieldProps = {
	field: FieldAccessor<string>;
	label: string;
	type?: InputType;
	placeholder?: string;
	required?: boolean;
	class?: string;
	inputClass?: string;
};

export function FormField(props: FormFieldProps) {
	const hasError = () => props.field().state.meta.errors.length > 0;
	const firstError = () => {
		const err = props.field().state.meta.errors[0];
		return typeof err === "string" ? err : "";
	};

	return (
		<TextField
			value={props.field().state.value}
			onChange={(value) => props.field().handleChange(value)}
			validationState={hasError() ? "invalid" : "valid"}
			required={props.required}
			class={props.class}
		>
			<TextFieldLabel for={props.field().name}>{props.label}</TextFieldLabel>
			<TextFieldInput
				id={props.field().name}
				name={props.field().name}
				type={props.type ?? "text"}
				placeholder={props.placeholder}
				onBlur={props.field().handleBlur}
				class={props.inputClass}
			/>
			<TextFieldErrorMessage>{firstError()}</TextFieldErrorMessage>
		</TextField>
	);
}

// textarea field
type FormTextAreaProps = {
	field: FieldAccessor<string>;
	label?: string;
	placeholder?: string;
	rows?: number;
	required?: boolean;
	class?: string;
	textareaClass?: string;
};

export function FormTextArea(props: FormTextAreaProps) {
	const hasError = () => props.field().state.meta.errors.length > 0;
	const firstError = () => {
		const err = props.field().state.meta.errors[0];
		return typeof err === "string" ? err : "";
	};

	return (
		<TextField
			value={props.field().state.value}
			onChange={(value) => props.field().handleChange(value)}
			validationState={hasError() ? "invalid" : "valid"}
			required={props.required}
			class={props.class}
		>
			{props.label && (
				<TextFieldLabel for={props.field().name}>{props.label}</TextFieldLabel>
			)}
			<TextFieldTextArea
				id={props.field().name}
				name={props.field().name}
				rows={props.rows ?? 3}
				placeholder={props.placeholder}
				onBlur={props.field().handleBlur}
				class={props.textareaClass}
			/>
			<TextFieldErrorMessage>{firstError()}</TextFieldErrorMessage>
		</TextField>
	);
}

// checkbox field with label and optional description
type FormCheckboxProps = {
	field: FieldAccessor<boolean>;
	label: string;
	description?: string;
	class?: string;
};

export function FormCheckbox(props: FormCheckboxProps) {
	return (
		<label class={`flex items-center gap-3 cursor-pointer ${props.class ?? ""}`}>
			<input
				type="checkbox"
				checked={props.field().state.value}
				onChange={(e) => props.field().handleChange(e.currentTarget.checked)}
				class="w-4 h-4 rounded border-stone-600 bg-stone-800 text-violet-500 focus:ring-violet-500"
			/>
			<div>
				<Label class="text-white/80 cursor-pointer">{props.label}</Label>
				{props.description && (
					<p class="text-stone-400 text-sm">{props.description}</p>
				)}
			</div>
		</label>
	);
}

// simple checkbox (no description, inline style)
type FormCheckboxSimpleProps = {
	field: FieldAccessor<boolean>;
	label: string;
	class?: string;
};

export function FormCheckboxSimple(props: FormCheckboxSimpleProps) {
	return (
		<label class={`flex items-center gap-3 cursor-pointer ${props.class ?? ""}`}>
			<input
				type="checkbox"
				checked={props.field().state.value}
				onChange={(e) => props.field().handleChange(e.currentTarget.checked)}
				class="w-4 h-4 rounded border-stone-600 bg-stone-800 text-violet-500"
			/>
			<span class="text-white/80">{props.label}</span>
		</label>
	);
}

// form submit button that subscribes to form state
type FormSubmitButtonProps = {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack form types are complex
	form: any;
	label?: string;
	loadingLabel?: string;
	class?: string;
	disabled?: boolean;
	children?: JSX.Element;
};

export function FormSubmitButton(props: FormSubmitButtonProps) {
	return (
		<props.form.Subscribe
			selector={(state: { canSubmit: boolean; isSubmitting: boolean }) => ({
				canSubmit: state.canSubmit,
				isSubmitting: state.isSubmitting,
			})}
		>
			{(state: () => { canSubmit: boolean; isSubmitting: boolean }) => (
				<button
					type="submit"
					disabled={
						!state().canSubmit || state().isSubmitting || props.disabled
					}
					class={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 ${props.class ?? ""}`}
				>
					{props.children ??
						(state().isSubmitting
							? (props.loadingLabel ?? "Saving...")
							: (props.label ?? "Submit"))}
				</button>
			)}
		</props.form.Subscribe>
	);
}
