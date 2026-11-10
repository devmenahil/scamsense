import { cn } from "@/lib/cn";

/**
 * Sensei Kenshi's avatar: a calm mentor drawn in the brand icon style (2px rounded teal outline, one yellow fill: the
 * topknot tie), always inside a rounded tile. The samurai hint is deliberately subtle (a topknot, nothing else).
 */
export function KenshiAvatar({
  size = "md",
  tone = "mist",
  className,
  title,
}: {
  size?: "sm" | "md" | "lg";
  tone?: "mist" | "white";
  className?: string;
  /** Accessible name; omit when the avatar sits next to a visible "Sensei Kenshi" label. */
  title?: string;
}) {
  const box = { sm: "size-9", md: "size-11", lg: "size-16" }[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-tile border-2 border-teal",
        tone === "mist" ? "bg-mist" : "bg-white",
        box,
        className,
      )}
    >
      <svg
        viewBox="0 0 48 48"
        className="size-[85%]"
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        focusable="false"
      >
        {/* topknot + yellow tie */}
        <ellipse cx="24" cy="9" rx="4.2" ry="3.6" className="fill-teal" />
        <rect
          x="20.5"
          y="11.2"
          width="7"
          height="2.8"
          rx="1.4"
          className="fill-yellow stroke-teal"
          strokeWidth="1"
        />
        {/* face */}
        <circle cx="24" cy="28" r="13.5" className="fill-white stroke-teal" strokeWidth="2" />
        {/* hair */}
        <path
          d="M10.6 26.5C10.8 18.2 16.6 14 24 14s13.2 4.2 13.4 12.5c-3.6-3.3-8.3-4.9-13.4-4.9s-9.8 1.6-13.4 4.9Z"
          className="fill-teal"
        />
        {/* calm eyes, eyebrows, smile */}
        <path
          d="M17.5 29.5q2.2-2 4.4 0M26.1 29.5q2.2-2 4.4 0M20.4 34.6q3.6 2.6 7.2 0"
          className="fill-none stroke-teal"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M17.6 25.6l3.8-.6M30.4 25.6l-3.8-.6"
          className="fill-none stroke-teal"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
