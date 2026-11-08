import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";

/**
 * Labels Phase 1 page shells that render demonstration data instead of the user's real progress.
 * Remove it from a page as soon as that page is wired to real data.
 */
export function DemoNotice({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <aside
      aria-label="Demonstration data notice"
      className={cn(
        "flex items-start gap-2.5 rounded-card border-2 border-dashed border-teal/50 bg-white px-4 py-2.5 text-caption",
        className,
      )}
    >
      <Icon name="info" className="mt-px size-4" />
      <p>
        <strong className="font-heading font-extrabold">Demonstration data.</strong>{" "}
        {children ?? "This screen is a design shell. The values shown are examples, not your real progress."}
      </p>
    </aside>
  );
}
