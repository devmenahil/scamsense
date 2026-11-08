import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/Icon";

/** Icons always sit inside a rounded tile (Brand guide p.5). */
const sizes = {
  sm: { tile: "size-10 rounded-tile", icon: "size-5" },
  md: { tile: "size-12 rounded-tile", icon: "size-6" },
  lg: { tile: "size-16 rounded-card", icon: "size-8" },
} as const;

export function IconTile({
  name,
  accent = true,
  tone = "white",
  size = "md",
  label,
  className,
}: {
  name: IconName;
  accent?: boolean;
  tone?: "white" | "mist" | "teal";
  size?: keyof typeof sizes;
  label?: string;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border-2",
        s.tile,
        tone === "white" && "border-teal bg-white text-teal shadow-edge-sm",
        tone === "mist" && "border-mist bg-mist text-teal",
        tone === "teal" && "border-teal-shade bg-teal text-white",
        className,
      )}
    >
      <Icon name={name} accent={accent} label={label} className={s.icon} />
    </span>
  );
}
