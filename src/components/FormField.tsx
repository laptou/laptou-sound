// generic form field component for tanstack form

import type { FieldApi } from "@tanstack/solid-form";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
} from "@ui/text-field";

type FormFieldProps = {
	field: FieldApi<unknown, unknown, undefined, string, string>;
	label: string;
	type?: string;
	placeholder?: string;
	required?: boolean;
};

export function FormField(props: FormFieldProps) {
	const fieldState = () => props.field();
	const hasError = () => fieldState().state.meta.errors.length > 0;

	return (
		<TextField
			value={fieldState().state.value}
			onChange={(value) => fieldState().handleChange(value)}
			validationState={hasError() ? "invalid" : "valid"}
			required={props.required !== false}
		>
			<TextFieldLabel for={fieldState().name}>{props.label}</TextFieldLabel>
			<TextFieldInput
				id={fieldState().name}
				name={fieldState().name}
				type={props.type || "text"}
				placeholder={props.placeholder}
				onInput={(e) => fieldState().handleChange(e.currentTarget.value)}
				onBlur={fieldState().handleBlur}
			/>
			<TextFieldErrorMessage>
				{hasError() ? fieldState().state.meta.errors[0] : ""}
			</TextFieldErrorMessage>
		</TextField>
	);
}
