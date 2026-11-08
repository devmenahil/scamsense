import { cn } from "@/lib/cn";

/** Decorative spinner. Pair with visible or screen-reader text that names what is loading. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(!className?.includes("size-") && "size-5", "animate-spin", className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Accessible loading block: a live region announcing the label. */
export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-3 py-12 text-teal", className)}
    >
      <Spinner />
      <span className="font-medium">{label}</span>
    </div>
  );
}
