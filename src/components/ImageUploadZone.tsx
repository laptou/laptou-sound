// image upload zone component for profile photos and album art
// supports both presigned url uploads (production) and indirect uploads (development)

import Camera from "lucide-solid/icons/camera";
import ImageIcon from "lucide-solid/icons/image";
import Loader2 from "lucide-solid/icons/loader-2";
import X from "lucide-solid/icons/x";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";

type ImageUploadZoneProps = {
	// current image url (if any)
	currentImage?: string | null;
	// callback when upload completes
	onUploadComplete: () => void;
	// callback when image is removed
	onRemove?: () => void;
	// upload url getter - returns presigned url or indirect upload endpoint
	getUploadUrl: (contentType: string, ext: string) => Promise<{
		mode: "presigned" | "indirect";
		uploadUrl: string;
		uploadId: string;
		tempKey: string;
	}>;
	// confirm upload callback (for presigned uploads)
	confirmUpload?: (tempKey: string) => Promise<void>;
	// optional: accepted file types (defaults to image/*)
	accept?: string;
	// optional: max file size in bytes (defaults to 5MB)
	maxSize?: number;
	// optional: placeholder element when no image
	placeholder?: string;
	// optional: size of the preview
	previewSize?: "sm" | "md" | "lg";
	// optional: shape of the preview
	shape?: "circle" | "square";
	// optional: additional css classes
	class?: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ImageUploadZone(props: ImageUploadZoneProps) {
	const [isUploading, setIsUploading] = createSignal(false);
	const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);

	const accept = () => props.accept ?? "image/*";
	const maxSize = () => props.maxSize ?? MAX_FILE_SIZE;
	const previewSize = () => props.previewSize ?? "md";
	const shape = () => props.shape ?? "circle";

	const sizeClasses = {
		sm: "w-16 h-16",
		md: "w-24 h-24",
		lg: "w-32 h-32",
	};

	const shapeClasses = {
		circle: "rounded-full",
		square: "rounded-xl",
	};

	const validateFile = (file: File): boolean => {
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return false;
		}

		if (file.size > maxSize()) {
			const maxMB = Math.round(maxSize() / (1024 * 1024));
			toast.error(`File size must be less than ${maxMB}MB`);
			return false;
		}

		return true;
	};

	const handleFileSelect = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file || !validateFile(file)) {
			return;
		}

		// show preview immediately
		const reader = new FileReader();
		reader.onload = (e) => {
			setPreviewUrl(e.target?.result as string);
		};
		reader.readAsDataURL(file);

		setIsUploading(true);

		try {
			const ext = file.name.split(".").pop() || "png";
			const uploadInfo = await props.getUploadUrl(file.type, ext);

			if (uploadInfo.mode === "presigned") {
				// upload directly to presigned url
				const response = await fetch(uploadInfo.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": file.type },
					body: file,
				});

				if (!response.ok) {
					throw new Error("Upload failed");
				}

				// confirm upload to trigger processing
				if (props.confirmUpload) {
					await props.confirmUpload(uploadInfo.tempKey);
				}
			} else {
				// indirect upload through our api
				const formData = new FormData();
				formData.append("file", file);

				const response = await fetch(uploadInfo.uploadUrl, {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					const errorData = (await response.json()) as { error?: string };
					throw new Error(errorData.error || "Upload failed");
				}
			}

			toast.success("Image uploaded! Processing...");
			props.onUploadComplete();
		} catch (error) {
			setPreviewUrl(null);
			toast.error(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setIsUploading(false);
			// reset input
			input.value = "";
		}
	};

	const handleRemove = () => {
		setPreviewUrl(null);
		props.onRemove?.();
	};

	const currentImageUrl = () => previewUrl() ?? props.currentImage;

	return (
		<div class={`relative ${props.class ?? ""}`}>
			<div
				class={`${sizeClasses[previewSize()]} ${shapeClasses[shape()]} bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center overflow-hidden`}
			>
				<Show
					when={currentImageUrl()}
					fallback={
						<span class="text-3xl font-bold text-white">
							{props.placeholder ?? <ImageIcon class="w-8 h-8 text-white/50" />}
						</span>
					}
				>
					{(src) => (
						<img
							src={src()}
							alt="Preview"
							class="w-full h-full object-cover"
						/>
					)}
				</Show>
				<Show when={isUploading()}>
					<div class="absolute inset-0 bg-black/50 flex items-center justify-center">
						<Loader2 class="w-6 h-6 text-white animate-spin" />
					</div>
				</Show>
			</div>

			{/* upload button */}
			<label
				class={`absolute bottom-0 right-0 w-8 h-8 bg-violet-500 hover:bg-violet-600 ${shapeClasses[shape()]} flex items-center justify-center cursor-pointer transition-colors shadow-lg`}
			>
				<Camera class="w-4 h-4 text-white" />
				<input
					type="file"
					accept={accept()}
					onChange={handleFileSelect}
					disabled={isUploading()}
					class="sr-only"
				/>
			</label>

			{/* remove button */}
			<Show when={currentImageUrl() && props.onRemove && !isUploading()}>
				<button
					type="button"
					onClick={handleRemove}
					class={`absolute top-0 right-0 w-6 h-6 bg-red-500 hover:bg-red-600 ${shapeClasses[shape()]} flex items-center justify-center cursor-pointer transition-colors shadow-lg -translate-y-1 translate-x-1`}
				>
					<X class="w-3 h-3 text-white" />
				</button>
			</Show>
		</div>
	);
}

