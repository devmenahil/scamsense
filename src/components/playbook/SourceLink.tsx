import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";

/** "Source: <official page> · verified <date>" (or "not yet verified"), always beside the claim it supports. */
export function SourceLink({
  title,
  url,
  verified,
  className,
}: {
  title: string;
  url: string;
  /** ISO date the page was verified, or null when ScamSense couldn't verify it. */
  verified: string | null;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-caption", className)}>
      <Icon name="book" className="size-3.5 shrink-0" />
      <span>Source:</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold break-words underline underline-offset-2"
      >
        {title} (PayPal U.S.)<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <span>·</span>
      <span>{verified ? `verified ${formatDate(verified)}` : "not yet verified by ScamSense"}</span>
    </p>
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
