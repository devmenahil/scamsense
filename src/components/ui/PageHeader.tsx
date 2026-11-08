import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Consistent page title block: eyebrow label, sentence-case H1, short description, optional actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl min-w-0">
        {eyebrow && <p className="mb-2 label-eyebrow text-teal/80">{eyebrow}</p>}
        <h1 className="text-[1.75rem] leading-[2.125rem] font-extrabold tracking-[-0.01em] sm:text-heading">
          {title}
        </h1>
        {description && <p className="mt-2 text-body text-teal/85">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
