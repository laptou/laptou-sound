// shared file upload zone component for audio files

import { Button } from "@ui/button";
import Music from "lucide-solid/icons/music";
import Upload from "lucide-solid/icons/upload";
import X from "lucide-solid/icons/x";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";

type FileUploadZoneProps = {
	// the currently selected file
	file: File | null;
	// called when a file is selected or cleared
	onFileChange: (file: File | null) => void;
	// whether the upload is in progress
	isUploading?: boolean;
	// optional: upload button label
	uploadLabel?: string;
	// optional: callback for upload button (if not provided, no button is shown)
	onUpload?: () => void;
	// optional: accepted file types (defaults to audio/*)
	accept?: string;
	// optional: max file size in bytes (defaults to 100MB)
	maxSize?: number;
	// optional: custom placeholder text
	placeholder?: string;
	// optional: additional css classes
	class?: string;
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function FileUploadZone(props: FileUploadZoneProps) {
	const [isDragOver, setIsDragOver] = createSignal(false);

	const accept = () => props.accept ?? "audio/*";
	const maxSize = () => props.maxSize ?? MAX_FILE_SIZE;
	const placeholder = () =>
		props.placeholder ?? "Drop audio file or click to browse";

	const validateFile = (file: File): boolean => {
		// validate file type
		const acceptPattern = accept();
		if (acceptPattern.startsWith("audio/")) {
			if (!file.type.startsWith("audio/")) {
				toast.error("Please select an audio file");
				return false;
			}
		}

		// validate file size
		if (file.size > maxSize()) {
			const maxMB = Math.round(maxSize() / (1024 * 1024));
			toast.error(`File size must be less than ${maxMB}MB`);
			return false;
		}

		return true;
	};

	const handleFileSelect = (e: Event) => {
		const input = e.target as HTMLInputElement;
		const selectedFile = input.files?.[0];

		if (selectedFile && validateFile(selectedFile)) {
			props.onFileChange(selectedFile);
		}
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);

		const droppedFile = e.dataTransfer?.files[0];
		if (droppedFile && validateFile(droppedFile)) {
			props.onFileChange(droppedFile);
		}
	};

	const handleDragOver = (e: DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = () => {
		setIsDragOver(false);
	};

	const clearFile = () => {
		props.onFileChange(null);
	};

	const formatFileSize = (bytes: number): string => {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	};

	return (
		<div
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			class={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
				props.file
					? "border-violet-500 bg-violet-500/10"
					: isDragOver()
						? "border-violet-400 bg-violet-500/5"
						: "border-stone-700 hover:border-stone-600"
			} ${props.class ?? ""}`}
		>
			<Show
				when={props.file}
				fallback={
					<>
						<Upload class="w-10 h-10 text-stone-500 mx-auto mb-3" />
						<p class="text-white font-medium mb-1">{placeholder()}</p>
						<p class="text-stone-400 text-sm">
							MP3, WAV, FLAC up to {Math.round(maxSize() / (1024 * 1024))}MB
						</p>
						<input
							type="file"
							accept={accept()}
							onChange={handleFileSelect}
							class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
						/>
					</>
				}
			>
				{(file) => (
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center shrink-0">
								<Music class="w-6 h-6 text-violet-400" />
							</div>
							<div class="text-left min-w-0">
								<p class="text-white font-medium truncate">{file().name}</p>
								<p class="text-stone-400 text-sm">
									{formatFileSize(file().size)}
								</p>
							</div>
						</div>
						<div class="flex gap-2 shrink-0">
							<Show when={props.onUpload}>
								<Button
									size="sm"
									onClick={() => props.onUpload?.()}
									disabled={props.isUploading}
								>
									{props.isUploading
										? "Uploading..."
										: (props.uploadLabel ?? "Upload")}
								</Button>
							</Show>
							<Button
								variant="ghost"
								size="icon"
								onClick={clearFile}
								disabled={props.isUploading}
							>
								<X class="w-4 h-4" />
							</Button>
						</div>
					</div>
				)}
			</Show>
		</div>
	);
}
