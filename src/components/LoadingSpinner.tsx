// loading spinner component with playful animation
import { Loader2 } from "lucide-solid";

interface Props {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export default function LoadingSpinner(props: Props) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div class="flex flex-col items-center justify-center gap-3">
      <Loader2
        class={`${sizeClasses[props.size ?? "md"]} text-accent-500 animate-spin-slow`}
      />
      {props.text && (
        <p class="text-small animate-pulse-soft">{props.text}</p>
      )}
    </div>
  );
}

