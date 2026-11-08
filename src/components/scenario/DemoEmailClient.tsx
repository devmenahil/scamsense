"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";

/**
 * DEMONSTRATION environment for the Phase 1 scenario-player shell.
 *
 * Shows how an immersive environment hosts decisions as native actions (R8): there is no question and no answer
 * list, just a fictional mail app. All organisations are fictional and every address uses the reserved `.example`
 * TLD (R29). Nothing is highlighted, and no element hints at legitimacy (R10). Real scenario content and the
 * EmailClient renderer arrive in Phases 3–4.
 */

export interface EnvironmentDecision {
  id: string;
  label: string;
  kind: "pay" | "other";
}

interface Message {
  id: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  preview: string;
  received: string;
  body: string[];
  unread: boolean;
  /** Only the scenario's own message carries decision actions. */
  isScenarioMessage?: boolean;
}

const MESSAGES: Message[] = [
  {
    id: "m1",
    fromName: "Maple Street Utilities",
    fromAddress: "statements@maplestreet-utilities.example",
    subject: "Your October statement is ready",
    preview: "Your statement for account ending 2048 is now available…",
    received: "9:14 AM",
    unread: true,
    isScenarioMessage: true,
    body: [
      "Hello,",
      "Your statement for the account ending 2048 is now available. The amount due this month is $72.40, payable by November 20.",
      "You can pay using the button below or through your usual payment method.",
      "Thank you,\nMaple Street Utilities Customer Care",
    ],
  },
  {
    id: "m2",
    fromName: "Larkspur Home Goods",
    fromAddress: "orders@larkspur-home.example",
    subject: "Your order has shipped",
    preview: "Good news: order LH-30917 is on its way…",
    received: "Yesterday",
    unread: false,
    body: ["Good news: order LH-30917 is on its way.", "Estimated delivery: 3–5 business days."],
  },
  {
    id: "m3",
    fromName: "Riverside Community Library",
    fromAddress: "events@riverside-library.example",
    subject: "Reminder: book club on Thursday",
    preview: "This month we're reading…",
    received: "Mon",
    unread: false,
    body: ["This month we're reading a mystery novel. See you on Thursday at 6 PM in Room B."],
  },
];

export const DEMO_DECISIONS: EnvironmentDecision[] = [
  { id: "pay", label: "Pay bill", kind: "pay" },
  { id: "report", label: "Report message", kind: "other" },
  { id: "archive", label: "Archive", kind: "other" },
];

const findDecision = (id: string) => DEMO_DECISIONS.find((d) => d.id === id)!;

export function DemoEmailClient({ onDecision }: { onDecision: (d: EnvironmentDecision) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState(false);
  const open = MESSAGES.find((m) => m.id === openId) ?? null;

  function openMessage(id: string) {
    setOpenId(id);
    setShowDetails(false);
    setReadIds((prev) => new Set(prev).add(id));
  }

  return (
    <div className="overflow-hidden rounded-panel border-2 border-teal bg-white shadow-edge">
      {/* App chrome with an inert, non-editable address bar */}
      <div className="flex items-center gap-3 border-b-2 border-teal bg-mist px-3 py-2.5 sm:px-4">
        <span aria-hidden="true" className="hidden gap-1.5 sm:flex">
          <span className="size-3 rounded-pill border-2 border-teal" />
          <span className="size-3 rounded-pill border-2 border-teal" />
          <span className="size-3 rounded-pill border-2 border-teal" />
        </span>
        <p
          className="flex min-w-0 flex-1 items-center gap-2 rounded-pill border-2 border-teal/40 bg-white px-3 py-1 text-caption"
          aria-label="Simulated address bar: inkwell-mail.example/inbox"
        >
          <Icon name="lock" className="size-3.5" />
          <span className="truncate">inkwell-mail.example/inbox</span>
        </p>
      </div>

      <div className="grid min-h-[28rem] md:grid-cols-[18rem_1fr]">
        {/* Inbox list (hidden on small screens while a message is open) */}
        <section
          aria-label="Inbox"
          className={cn("border-teal/20 md:block md:border-r-2", open ? "hidden" : "block")}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="font-heading text-lg font-extrabold">Inkwell Mail</h3>
            <span className="text-caption font-medium">Inbox</span>
          </div>
          <ul>
            {MESSAGES.map((m) => {
              const unread = m.unread && !readIds.has(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => openMessage(m.id)}
                    aria-current={openId === m.id ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-t-2 border-mist px-4 py-3 text-left transition-colors hover:bg-mist",
                      openId === m.id && "bg-mist",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate",
                          unread ? "font-heading font-black" : "font-heading font-bold",
                        )}
                      >
                        {unread && <span className="sr-only">Unread: </span>}
                        {m.fromName}
                      </span>
                      <span className="shrink-0 text-caption">{m.received}</span>
                    </span>
                    <span className={cn("truncate text-small", unread && "font-semibold")}>{m.subject}</span>
                    <span className="truncate text-caption text-teal/80">{m.preview}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Message view */}
        <section aria-label="Message" className={cn("min-w-0 flex-col md:flex", open ? "flex" : "hidden")}>
          {open ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b-2 border-mist px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-pill px-2 font-heading text-small font-extrabold hover:bg-mist md:hidden"
                >
                  <Icon name="arrow-right" className="size-4 rotate-180" />
                  Inbox
                </button>
                {open.isScenarioMessage && (
                  <div className="ml-auto flex flex-wrap gap-2">
                    {(["report", "archive"] as const).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onDecision(findDecision(id))}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-tile border-2 border-teal/40 bg-white px-3 text-small font-semibold hover:border-teal hover:bg-mist"
                      >
                        <Icon name={id === "report" ? "report" : "modules"} className="size-4" />
                        {findDecision(id).label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <article className="flex-1 px-4 py-5 sm:px-6">
                <h4 className="font-heading text-xl leading-7 font-extrabold">{open.subject}</h4>
                <div className="mt-3 flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-teal font-heading text-small font-black text-white"
                  >
                    {open.fromName
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 text-small">
                    <p className="font-semibold">{open.fromName}</p>
                    <button
                      type="button"
                      onClick={() => setShowDetails((v) => !v)}
                      aria-expanded={showDetails}
                      className="text-caption underline underline-offset-2"
                    >
                      {showDetails ? "Hide details" : "Show details"}
                    </button>
                    {showDetails && (
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-caption break-all">
                        <dt className="font-semibold">From</dt>
                        <dd>{open.fromAddress}</dd>
                        <dt className="font-semibold">To</dt>
                        <dd>you@inkwell-mail.example</dd>
                        <dt className="font-semibold">Received</dt>
                        <dd>{open.received}</dd>
                      </dl>
                    )}
                  </div>
                </div>
                <div className="mt-5 flex max-w-prose flex-col gap-3 whitespace-pre-line">
                  {open.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {open.isScenarioMessage && (
                  <button
                    type="button"
                    onClick={() => onDecision(findDecision("pay"))}
                    className="mt-6 inline-flex min-h-11 items-center rounded-[6px] bg-teal-shade px-5 font-semibold text-white hover:bg-teal"
                  >
                    {findDecision("pay").label}
                  </button>
                )}
              </article>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-teal/85">
              <Icon name="mail" className="size-8" />
              <p className="text-small">Select a message to read it.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
