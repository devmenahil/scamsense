import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** Calm fallback when progress can't be read (network/database issue). The rest of the app keeps working. */
export function ProgressUnavailable({
  className,
  href = "/dashboard",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <EmptyState
      className={className}
      icon="clock"
      title="We couldn't load your progress right now"
      description="This is usually temporary. Your modules, Training Funds, and scores are safe. Please try again in a moment."
      action={
        <ButtonLink href={href} variant="secondary">
          Try again
        </ButtonLink>
      }
    />
  );
}
