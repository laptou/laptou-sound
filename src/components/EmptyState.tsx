// empty state component for when there's no content
import type { JSX } from "solid-js";

interface Props {
  icon: JSX.Element;
  title: string;
  description?: string;
  action?: JSX.Element;
}

export default function EmptyState(props: Props) {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-2xl mb-4">
        {props.icon}
      </div>
      <h3 class="text-subtitle text-surface-900 dark:text-surface-100 mb-2">
        {props.title}
      </h3>
      {props.description && (
        <p class="text-small max-w-md mb-6">{props.description}</p>
      )}
      {props.action}
    </div>
  );
}

