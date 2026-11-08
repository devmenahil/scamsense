import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { IconName } from "@/components/icons/Icon";
import { IconTile } from "./IconTile";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border-2 border-dashed border-teal/40 bg-white px-6 py-10 text-center",
        className,
      )}
    >
      <IconTile name={icon} tone="mist" accent={false} />
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-small text-teal/85">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
