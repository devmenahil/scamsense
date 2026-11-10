"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { DiscussableAttempt, KenshiReply, KenshiSource } from "@/lib/kenshi/types";
import { Icon } from "@/components/icons/Icon";
import { formatDate } from "@/components/playbook/SourceLink";
import { KenshiAvatar } from "./KenshiAvatar";

/** A completed attempt Kenshi is discussing. */
export interface KenshiFocus {
  attemptId: string;
  title: string;
  isPractice: boolean;
}

type Turn =
  | { id: number; kind: "kenshi"; text: string; sources?: KenshiSource[] }
  | { id: number; kind: "user"; text: string; failed?: { message: string; retryable: boolean } }
  /** A context switch marker: history sent to the server restarts after it, so contexts never mix. */
  | { id: number; kind: "divider"; text: string };

const MAX = 500;
/** Recent turns sent with each question (the server bounds it again). */
const HISTORY_TURNS = 6;

const GENERAL_SUGGESTIONS = [
  "How can I recognize a phishing attempt?",
  "What should I verify before paying someone online?",
  "How does PayPal Purchase Protection work?",
  "What should I do if I get a suspicious payment request?",
];
const PROGRESS_SUGGESTION = "Which evidence do I tend to miss?";
const SCENARIO_SUGGESTIONS = [
  "What evidence did I miss?",
  "Why was my explanation incomplete?",
  "What could I have done differently?",
  "What PayPal protections might apply?",
];

function greeting(focus: KenshiFocus | null): string {
  return focus
    ? `Welcome back. Let's look at "${focus.title}" together: your decision, what you checked, and the evidence. Ask me anything about it.`
    : "Hello, I'm Sensei Kenshi. Ask me about scams, safe payments, PayPal's protections and reporting, or any scenario you've finished. I won't reveal anything about a scenario you haven't completed. That instinct is yours to build.";
}

/**
 * Sensei Kenshi chat (Step 10, R22). One POST /api/chat per question; opening the chat, suggestions, and switching
 * context never call the server. Conversations live only in this component (not stored). When `focus` is set, the
 * server checks that the attempt is the learner's own and COMPLETED before Kenshi sees anything about it.
 */
export function KenshiChat({
  initialFocus = null,
  discussable = [],
  hasCompleted = false,
  className,
  autoFocus = false,
}: {
  initialFocus?: KenshiFocus | null;
  /** Completed attempts the learner may switch to (dashboard / Sensei page). */
  discussable?: readonly DiscussableAttempt[];
  /** At least one scenario is completed (shapes the suggested questions). */
  hasCompleted?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const [focus, setFocus] = useState<KenshiFocus | null>(initialFocus);
  const [turns, setTurns] = useState<Turn[]>([{ id: 0, kind: "kenshi", text: greeting(initialFocus) }]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [followUps, setFollowUps] = useState<string[] | null>(null);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ids = { input: useId(), suggestions: useId(), counter: useId() };

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Keep the newest message in view (scrolls the log only, never the page).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending]);

  const id = () => nextId.current++;

  /** Turns since the last context switch, excluding greetings and failed questions. */
  function historyBefore(list: Turn[], index: number) {
    const before = list.slice(0, index);
    const lastDivider = before.map((t) => t.kind).lastIndexOf("divider");
    return before
      .slice(lastDivider + 1)
      .filter((t, i) => !(i === 0 && t.kind === "kenshi")) // the greeting that opens each context
      .filter((t): t is Extract<Turn, { kind: "user" | "kenshi" }> => t.kind !== "divider")
      .filter((t) => !(t.kind === "user" && t.failed))
      .slice(-HISTORY_TURNS)
      .map((t) => ({ role: t.kind === "user" ? ("user" as const) : ("kenshi" as const), text: t.text }));
  }

  async function ask(list: Turn[], userTurnId: number) {
    const index = list.findIndex((t) => t.id === userTurnId);
    const turn = list[index];
    if (!turn || turn.kind !== "user") return;
    setPending(true);
    setFollowUps(null);
    const res = await apiRequest<KenshiReply>("/api/chat", {
      method: "POST",
      body: {
        message: turn.text,
        history: historyBefore(list, index),
        ...(focus ? { attemptId: focus.attemptId } : {}),
      },
    });
    setPending(false);
    if (res.ok) {
      setTurns((cur) => [
        ...cur.map((t) => (t.id === userTurnId && t.kind === "user" ? { ...t, failed: undefined } : t)),
        { id: id(), kind: "kenshi", text: res.data.reply, sources: res.data.sources },
      ]);
      setFollowUps(res.data.followUps.length ? res.data.followUps : null);
      return;
    }
    const code = res.error.code;
    if (code === "attempt_not_completed" || code === "not_found") {
      // The server refused this attempt's context: continue as a general conversation.
      setFocus(null);
    }
    setTurns((cur) =>
      cur.map((t) =>
        t.id === userTurnId && t.kind === "user"
          ? {
              ...t,
              failed: {
                message: res.error.message,
                retryable: !["validation", "attempt_not_completed", "not_found"].includes(code),
              },
            }
          : t,
      ),
    );
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) {
      inputRef.current?.focus();
      return;
    }
    const userTurn: Turn = { id: id(), kind: "user", text: clean.slice(0, MAX) };
    const list = [...turns, userTurn];
    setTurns(list);
    setDraft("");
    void ask(list, userTurn.id);
  }

  function retry(userTurnId: number) {
    if (pending) return;
    // Same question, same bubble: clear the error and ask again (no duplicate message).
    const list = turns.map((t) =>
      t.id === userTurnId && t.kind === "user" ? { ...t, failed: undefined } : t,
    );
    setTurns(list);
    void ask(list, userTurnId);
  }

  function switchTo(next: KenshiFocus | null) {
    if (pending || next?.attemptId === focus?.attemptId) return;
    setFocus(next);
    setFollowUps(null);
    setTurns((cur) => [
      ...cur,
      {
        id: id(),
        kind: "divider",
        text: next
          ? `Now discussing: ${next.title}${next.isPractice ? " (practice attempt)" : ""}`
          : "Now: general questions",
      },
      { id: id(), kind: "kenshi", text: greeting(next) },
    ]);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  const suggestions =
    followUps ??
    (focus
      ? SCENARIO_SUGGESTIONS
      : hasCompleted
        ? [...GENERAL_SUGGESTIONS.slice(0, 3), PROGRESS_SUGGESTION]
        : GENERAL_SUGGESTIONS);

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden bg-white", className)}>
      {/* Context bar: what Kenshi is discussing, and switching */}
      <div className="border-b-2 border-mist px-4 py-2.5">
        {focus ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-pill bg-mist px-3 py-1 text-caption font-semibold">
              <Icon name="target" className="size-4 shrink-0" />
              <span className="truncate">
                Discussing: {focus.title}
                {focus.isPractice ? " · practice attempt" : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => switchTo(null)}
              disabled={pending}
              className="min-h-9 rounded-pill px-2 text-caption font-semibold underline underline-offset-2 hover:bg-mist disabled:opacity-60"
            >
              Ask general questions instead
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-mist px-3 py-1 text-caption font-semibold">
              <Icon name="chat" className="size-4" />
              General questions
            </span>
            {discussable.length > 0 && (
              <label className="flex min-w-0 items-center gap-1.5 text-caption">
                <span className="shrink-0">Or discuss:</span>
                <select
                  value=""
                  disabled={pending}
                  onChange={(e) => {
                    const a = discussable.find((d) => d.attemptId === e.target.value);
                    if (a) switchTo(a);
                  }}
                  className="min-h-9 max-w-full min-w-0 rounded-tile border-2 border-teal/40 bg-white px-2 text-caption font-semibold focus-visible:border-teal"
                >
                  <option value="">a completed scenario…</option>
                  {discussable.map((d) => (
                    <option key={d.attemptId} value={d.attemptId}>
                      {d.title}
                      {d.isPractice ? ` (practice attempt ${d.attemptNumber})` : " (original attempt)"}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with Sensei Kenshi"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
      >
        <ul className="flex flex-col gap-3">
          {turns.map((t) => (
            <li key={t.id}>
              {t.kind === "divider" ? (
                <p className="flex items-center gap-3 text-caption font-semibold text-teal/85">
                  <span aria-hidden="true" className="h-0.5 flex-1 rounded-pill bg-mist" />
                  {t.text}
                  <span aria-hidden="true" className="h-0.5 flex-1 rounded-pill bg-mist" />
                </p>
              ) : t.kind === "user" ? (
                <div className="flex flex-col items-end gap-1.5">
                  <p className="max-w-[85%] rounded-card rounded-br-[4px] bg-teal px-4 py-2.5 text-small break-words whitespace-pre-line text-white sm:max-w-[75%]">
                    <span className="sr-only">You: </span>
                    {t.text}
                  </p>
                  {t.failed && (
                    <div
                      role="alert"
                      className="flex max-w-[85%] flex-col gap-2 rounded-card border-2 border-teal/30 bg-yellow-tint px-3.5 py-2.5 text-caption sm:max-w-[75%]"
                    >
                      <p className="flex items-start gap-2">
                        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
                        {t.failed.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {t.failed.retryable && (
                          <button
                            type="button"
                            onClick={() => retry(t.id)}
                            disabled={pending}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border-2 border-teal bg-white px-3 font-heading font-extrabold tracking-wide uppercase hover:bg-mist disabled:opacity-60"
                          >
                            Try again
                          </button>
                        )}
                        <Link
                          href="/playbook"
                          className="min-h-9 px-1 py-2 font-semibold underline underline-offset-2"
                        >
                          Your Recovery Playbook
                        </Link>
                        {focus && (
                          <Link
                            href={`/play/${focus.attemptId}/results`}
                            className="min-h-9 px-1 py-2 font-semibold underline underline-offset-2"
                          >
                            Your results
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <KenshiAvatar size="sm" />
                  <div className="flex max-w-[85%] min-w-0 flex-col gap-2 sm:max-w-[78%]">
                    <p className="rounded-card rounded-tl-[4px] bg-mist px-4 py-2.5 text-small break-words whitespace-pre-line">
                      <span className="sr-only">Sensei Kenshi: </span>
                      {t.text}
                    </p>
                    {t.sources && t.sources.length > 0 && <Sources sources={t.sources} />}
                  </div>
                </div>
              )}
            </li>
          ))}
          {pending && (
            <li className="flex items-center gap-2.5" aria-live="off">
              <KenshiAvatar size="sm" />
              <span className="inline-flex items-center gap-1.5 rounded-card rounded-tl-[4px] bg-mist px-4 py-3">
                <span className="sr-only">Sensei Kenshi is thinking…</span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className="size-2 animate-bounce rounded-pill bg-teal motion-reduce:animate-none"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </li>
          )}
        </ul>
      </div>

      <div className="border-t-2 border-mist px-4 pt-3">
        <p className="sr-only" id={ids.suggestions}>
          Suggested questions
        </p>
        <ul aria-labelledby={ids.suggestions} className="flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <li key={s} className="shrink-0">
              <button
                type="button"
                disabled={pending}
                onClick={() => send(s)}
                className="min-h-9 rounded-pill border-2 border-teal/40 px-3 text-caption font-semibold hover:border-teal hover:bg-mist disabled:opacity-60"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 p-3 sm:p-4">
        <label htmlFor={ids.input} className="sr-only">
          Message Sensei Kenshi
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <textarea
            id={ids.input}
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            maxLength={MAX}
            aria-describedby={ids.counter}
            placeholder={focus ? `Ask about ${focus.title}…` : "Ask Sensei Kenshi a question…"}
            className="max-h-32 min-h-12 w-full resize-none rounded-tile border-2 border-teal px-3.5 py-2.5 text-body placeholder:text-teal/60 focus-visible:ring-4 focus-visible:ring-teal/25 focus-visible:outline-none"
          />
          <p id={ids.counter} className="px-1 text-caption text-teal/80">
            Enter to send · Shift+Enter for a new line
            {draft.length > MAX - 100 ? ` · ${MAX - draft.length} characters left` : ""}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-label="Send message"
          className="mb-6 inline-flex size-12 shrink-0 items-center justify-center rounded-button border-2 border-teal bg-teal text-white shadow-edge-shade hover:bg-teal-shade active:translate-y-0.5 active:shadow-none disabled:opacity-60"
        >
          <Icon name="send" className="size-5" />
        </button>
      </form>
      <p className="px-4 pb-3 text-caption text-teal/80">
        Sensei Kenshi is an AI learning guide, not PayPal or a financial adviser. Never share passwords,
        codes, or card details with anyone, including here.
      </p>
    </div>
  );
}

function Sources({ sources }: { sources: KenshiSource[] }) {
  return (
    <div className="rounded-card border-2 border-teal/25 px-3.5 py-2.5">
      <p className="text-caption font-semibold">Official PayPal sources (U.S.)</p>
      <ul className="mt-1 flex flex-col gap-1">
        {sources.map((s) => (
          <li key={s.policyId} className="text-caption">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 font-semibold break-words underline underline-offset-2"
            >
              <Icon name="book" className="mt-0.5 size-3.5 shrink-0" />
              {s.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <span className="block pl-5 text-teal/80">
              {s.verified && s.lastVerified
                ? `Verified by ScamSense ${formatDate(s.lastVerified)}`
                : "Not yet verified by ScamSense: read the current terms on PayPal"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
