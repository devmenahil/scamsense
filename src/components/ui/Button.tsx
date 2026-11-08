import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

/**
 * Brand button (Brand guide p.5): 12–16px radius, 2px teal border, thicker bottom edge for a pressable feel,
 * Nunito Black 15px uppercase label. Use ONE primary (or yellow) button per screen.
 *
 * States: hover lifts 1px, active presses down onto the edge, focus-visible shows the global focus ring,
 * disabled/loading flatten the edge and block interaction.
 */
export type ButtonVariant = "primary" | "secondary" | "yellow" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "label-button relative inline-flex items-center justify-center gap-2 rounded-button border-2 text-center " +
  "transition-[transform,box-shadow,background-color] duration-150 ease-out select-none " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-teal text-white border-teal shadow-edge-shade hover:-translate-y-px hover:shadow-[0_5px_0_0_var(--color-teal-shade)] " +
    "active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-teal-shade)]",
  secondary:
    "bg-white text-teal border-teal shadow-edge hover:-translate-y-px hover:bg-mist hover:shadow-[0_5px_0_0_var(--color-teal)] " +
    "active:translate-y-[3px] active:shadow-edge-pressed",
  yellow:
    "bg-yellow text-teal-shade border-yellow-shade shadow-edge-yellow hover:-translate-y-px " +
    "hover:shadow-[0_5px_0_0_var(--color-yellow-shade)] active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-yellow-shade)]",
  ghost: "bg-transparent text-teal border-transparent hover:bg-mist active:bg-mist",
  inverse:
    "bg-white text-teal border-white shadow-edge-shade hover:-translate-y-px hover:bg-mist " +
    "active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-teal-shade)]",
};

const disabledStyles =
  "disabled:translate-y-0 disabled:opacity-55 disabled:shadow-none disabled:hover:translate-y-0 " +
  "aria-disabled:translate-y-0 aria-disabled:opacity-55 aria-disabled:shadow-none";

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 py-2 text-[0.8125rem] leading-5",
  md: "min-h-12 px-5 py-2.5 text-button",
  lg: "min-h-14 px-7 py-3 text-base leading-6",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], disabledStyles, sizes[size], fullWidth && "w-full", className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** Shows a spinner, disables the button, and sets aria-busy. */
  loading?: boolean;
  /** Text announced/visible while loading. Defaults to the children. */
  loadingText?: ReactNode;
}

export function Button({
  variant,
  size,
  fullWidth,
  iconLeft,
  iconRight,
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : iconLeft}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && iconRight}
    </button>
  );
}

export interface ButtonLinkProps extends ComponentProps<typeof Link>, CommonProps {}

/** A link styled as a button — use for navigation, so it stays a real link for assistive tech. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}
