"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";

/**
 * Form controls for ScamSense chrome (NOT for in-scenario fictional fields, which are inert — R33).
 * Every control renders a visible label, optional hint, and an error announced via aria-describedby.
 * Errors use the "look again" flag + words, never red.
 */

const fieldBase =
  "w-full rounded-tile border-2 border-teal bg-white px-3.5 py-2.5 text-body text-teal placeholder:text-teal/60 " +
  "transition-[box-shadow,border-color] duration-150 hover:shadow-edge-sm " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/25 " +
  "disabled:cursor-not-allowed disabled:bg-mist disabled:opacity-70 " +
  "aria-[invalid=true]:border-yellow-shade aria-[invalid=true]:bg-yellow-tint";

interface FieldChromeProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** Extra content under the control, e.g. a character counter. */
  footer?: ReactNode;
}

function useFieldIds(id?: string) {
  const generated = useId();
  const controlId = id ?? generated;
  return { controlId, hintId: `${controlId}-hint`, errorId: `${controlId}-error` };
}

function describedBy(hint: unknown, error: unknown, ids: { hintId: string; errorId: string }) {
  return [hint ? ids.hintId : null, error ? ids.errorId : null].filter(Boolean).join(" ") || undefined;
}

function FieldChrome({
  controlId,
  hintId,
  errorId,
  label,
  hint,
  error,
  optional,
  footer,
  children,
}: FieldChromeProps & { controlId: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className="font-heading text-base font-bold">
        {label}
        {optional && (
          <span className="ml-1.5 font-body text-caption font-medium text-teal/80">(optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-caption text-teal/85">
          {hint}
        </p>
      )}
      {children}
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {footer}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-caption font-medium text-teal-shade">
      <Icon name="flag" accent className="mt-px size-4" />
      <span>
        <span className="font-heading font-extrabold">Look again:</span> {children}
      </span>
    </p>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldChromeProps {}

export function Input({ id, label, hint, error, optional, footer, className, ...rest }: InputProps) {
  const ids = useFieldIds(id);
  return (
    <FieldChrome {...ids} label={label} hint={hint} error={error} optional={optional} footer={footer}>
      <input
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={cn(fieldBase, "min-h-12", className)}
        {...rest}
      />
    </FieldChrome>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChromeProps {}

export function Textarea({ id, label, hint, error, optional, footer, className, ...rest }: TextareaProps) {
  const ids = useFieldIds(id);
  return (
    <FieldChrome {...ids} label={label} hint={hint} error={error} optional={optional} footer={footer}>
      <textarea
        id={ids.controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids)}
        className={cn(fieldBase, "min-h-32 resize-y", className)}
        {...rest}
      />
    </FieldChrome>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldChromeProps {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export function Select({
  id,
  label,
  hint,
  error,
  optional,
  footer,
  options,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <FieldChrome {...ids} label={label} hint={hint} error={error} optional={optional} footer={footer}>
      <div className="relative">
        <select
          id={ids.controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, ids)}
          className={cn(fieldBase, "min-h-12 cursor-pointer appearance-none pr-10", className)}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldChrome>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string;
}

/** Native checkbox with a large hit area and brand styling (accent-color keeps native a11y). */
export function Checkbox({ id, label, error, className, ...rest }: CheckboxProps) {
  const ids = useFieldIds(id);
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={ids.controlId}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-tile border-2 border-transparent p-1 text-body",
          className,
        )}
      >
        <input
          id={ids.controlId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.errorId : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-teal"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && <FieldError id={ids.errorId}>{error}</FieldError>}
    </div>
  );
}

/**
 * Pill-shaped toggle chip for multi-select option groups (e.g. financial activities). It is a real checkbox,
 * visually styled as a pill. The selected state is shown with a tick icon as well as fill.
 */
export function ChoiceChip({
  label,
  checked,
  onChange,
  name,
  value,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name: string;
  value: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border-2 border-teal px-4 py-2 font-heading text-small font-bold transition-colors duration-150",
        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal",
        checked ? "bg-teal text-white" : "bg-white text-teal hover:bg-mist",
      )}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {checked ? (
        <Icon name="check" className="size-4" />
      ) : (
        <span aria-hidden="true" className="size-4 rounded-pill border-2 border-teal/60" />
      )}
      {label}
    </label>
  );
}
