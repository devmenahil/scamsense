"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { LogoSymbol } from "@/components/brand/Logo";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";

interface Message {
  id: number;
  from: "sensei" | "you";
  text: string;
}

const GREETING =
  "Hello, I'm Sensei Kenshi. Ask me about scenarios you've finished, common scam tactics, or how PayPal features work. I won't give hints for a scenario you're still playing. That instinct is yours to build.";

/** Deterministic offline reply: the same calm fallback the real chat shows when AI is unavailable (R27). */
const FALLBACK =
  "I can't answer questions just yet. My connection arrives in a later phase. Meanwhile, Your Recovery Playbook and your scenario results are good places to look.";

const SUGGESTIONS = [
  "Why do scammers create urgency?",
  "How can I check if a seller is genuine?",
  "What should I never share with anyone?",
];

const MAX = 500;

/**
 * Sensei Kenshi chat shell (R22). Phase 1 runs locally: your message is shown and a fixed fallback reply is
 * returned. Nothing is sent or stored. POST /api/chat (Gemini, grounded) replaces the reply in Phase 11.
 */
export function SenseiChat() {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "sensei", text: GREETING }]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  function send(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    setMessages((m) => [
      ...m,
      { id: m.length, from: "you", text },
      { id: m.length + 1, from: "sensei", text: FALLBACK },
    ]);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-[min(70dvh,40rem)] min-h-[26rem] flex-col overflow-hidden rounded-panel border-2 border-teal bg-white shadow-edge">
      <div className="flex items-center gap-3 border-b-2 border-teal bg-mist px-4 py-3">
        <span className="inline-flex size-10 items-center justify-center rounded-tile bg-white">
          <LogoSymbol className="w-7" />
        </span>
        <div>
          <p className="font-heading font-extrabold">Sensei Kenshi</p>
          <p className="text-caption">Learning guide · offline preview</p>
        </div>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 overflow-y-auto px-4 py-5"
      >
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-card px-4 py-2.5 text-small sm:max-w-[70%]",
                  m.from === "you"
                    ? "rounded-br-[4px] bg-teal text-white"
                    : "rounded-bl-[4px] bg-mist text-teal",
                )}
              >
                <span className="sr-only">{m.from === "you" ? "You: " : "Sensei Kenshi: "}</span>
                {m.text}
              </p>
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </div>

      <div className="border-t-2 border-mist px-4 pt-3">
        <p className="sr-only" id="suggestions-label">
          Suggested questions
        </p>
        <ul aria-labelledby="suggestions-label" className="flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <li key={s} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDraft(s);
                  inputRef.current?.focus();
                }}
                className="min-h-9 rounded-pill border-2 border-teal/40 px-3 text-caption font-semibold hover:border-teal hover:bg-mist"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={send} className="flex items-end gap-2 p-3 sm:p-4">
        <label htmlFor="sensei-input" className="sr-only">
          Message Sensei Kenshi
        </label>
        <textarea
          id="sensei-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={MAX}
          placeholder="Ask a question…"
          className="max-h-32 min-h-12 flex-1 resize-none rounded-tile border-2 border-teal px-3.5 py-2.5 text-body placeholder:text-teal/60 focus-visible:ring-4 focus-visible:ring-teal/25 focus-visible:outline-none"
        />
        <Button type="submit" aria-label="Send message">
          <Icon name="send" className="size-5" />
        </Button>
      </form>
    </div>
  );
}
