import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";

/**
 * Persistent "Training simulation" frame marker (ARCHITECTURE §14): reminds users that everything inside
 * ScamSense is fictional and no real money moves.
 */
export function TrainingIndicator({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border-2 border-teal bg-white px-3 py-1 font-heading text-caption font-extrabold whitespace-nowrap text-teal",
        className,
      )}
    >
      <Icon name="shield" className="size-4" />
      {compact ? (
        <>
          <span aria-hidden="true">Training</span>
          <span className="sr-only">Training simulation: fictional scenarios, no real money</span>
        </>
      ) : (
        <span>Training simulation</span>
      )}
    </p>
  );
}
