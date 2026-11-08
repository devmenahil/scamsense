import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Brand card: 16px radius, 2px teal border, thicker bottom edge.
 * - white: default content surface
 * - mist:  soft card background for grouping
 * - teal:  inverse surface (white text). Adds `on-dark` so focus rings switch to white.
 * - yellow-tint: "look again" / attention surface
 * `interactive` adds a hover lift for cards that contain a single primary link.
 */
export type CardTone = "white" | "mist" | "teal" | "yellow-tint";

const tones: Record<CardTone, string> = {
  white: "bg-white border-teal shadow-edge",
  mist: "bg-mist border-mist",
  teal: "on-dark bg-teal border-teal text-white shadow-edge-shade",
  "yellow-tint": "bg-yellow-tint border-yellow-shade shadow-edge-yellow",
};

const paddings = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

export interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: CardTone;
  padding?: keyof typeof paddings;
  interactive?: boolean;
  as?: "div" | "section" | "article" | "li" | "aside";
}

export function Card({
  tone = "white",
  padding = "md",
  interactive = false,
  as: Tag = "div",
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border-2",
        tones[tone],
        paddings[padding],
        interactive &&
          "transition-[transform,box-shadow] duration-150 focus-within:-translate-y-0.5 hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_var(--color-teal)]",
        className,
      )}
      {...rest}
    />
  );
}
