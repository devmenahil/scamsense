"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { DiscussableAttempt } from "@/lib/kenshi/types";
import { Icon } from "@/components/icons/Icon";
import { KenshiAvatar } from "./KenshiAvatar";
import { KenshiChat, type KenshiFocus } from "./KenshiChat";

/**
 * Opens Sensei Kenshi in a side panel (native <dialog>: focus is trapped, Esc closes, focus returns to the opener).
 * Used on the dashboard and on the debrief pages of a COMPLETED attempt only; never on gameplay screens. Opening
 * and closing make no request: the chat mounts on open and is discarded on close.
 */
export function KenshiLauncher({
  focus = null,
  discussable,
  hasCompleted,
  variant = "button",
  label,
  className,
}: {
  focus?: KenshiFocus | null;
  discussable?: readonly DiscussableAttempt[];
  hasCompleted?: boolean;
  /** "button": compact pill; "card": the dashboard's invitation card. */
  variant?: "button" | "card";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const text = label ?? (focus ? "Ask Sensei Kenshi about this scenario" : "Ask Sensei Kenshi");

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "group flex w-full items-center gap-3 rounded-card border-2 border-teal bg-white p-4 text-left shadow-edge-sm transition-transform hover:-translate-y-0.5",
            className,
          )}
        >
          <KenshiAvatar size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg font-extrabold">{text}</span>
            <span className="mt-0.5 block text-caption text-teal/85">
              Your learning companion for scams, safe payments, PayPal protections, and the scenarios
              you&apos;ve finished.
            </span>
          </span>
          <Icon
            name="arrow-right"
            className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-pill border-2 border-teal bg-white py-1 pr-4 pl-1 font-heading text-small font-extrabold hover:bg-mist",
            className,
          )}
        >
          <KenshiAvatar size="sm" className="border-0" />
          {text}
        </button>
      )}

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className={cn(
          "m-0 ml-auto h-dvh max-h-dvh w-full max-w-full border-0 bg-white p-0 text-teal shadow-float",
          "sm:my-auto sm:mr-4 sm:h-[calc(100dvh-2rem)] sm:max-h-[44rem] sm:w-[28rem] sm:rounded-panel sm:border-2 sm:border-teal",
          "backdrop:bg-teal-shade/40",
        )}
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b-2 border-teal bg-mist px-4 py-3">
              <KenshiAvatar tone="white" />
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-heading text-lg font-extrabold">
                  Sensei Kenshi
                </h2>
                <p className="text-caption">Your ScamSense learning companion</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 font-heading text-small font-extrabold hover:bg-white"
              >
                <Icon name="close" className="size-5" />
                <span>Close</span>
              </button>
            </div>
            <KenshiChat
              className="flex-1"
              initialFocus={focus}
              discussable={discussable}
              hasCompleted={hasCompleted}
              autoFocus
            />
          </div>
        )}
      </dialog>
    </>
  );
}
