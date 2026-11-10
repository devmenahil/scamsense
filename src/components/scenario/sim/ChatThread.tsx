"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessageContent, ChatThreadContent } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";
import { isAvailable } from "@/lib/domain/scenarioStateMachine";
import { Icon } from "@/components/icons/Icon";
import { Attachment } from "./Attachments";
import { anchor, useAvailableDecisions, useSim } from "./SimContext";
import { Avatar, BackButton, DecisionButton, KvList, SimButton } from "./primitives";

/** The messages visible in a thread: the opening messages, then each chosen branch in the order it was chosen. */
export function visibleMessages(
  thread: ChatThreadContent,
  recorded: readonly string[],
): ChatMessageContent[] {
  const out = [...thread.messages];
  for (const id of recorded) {
    const branch = thread.branches.find((b) => b.actionId === id);
    if (branch) out.push(...branch.messages);
  }
  return out;
}

/**
 * A conversation with controlled branches (Step 6 brief §3A): reply chips are predefined; choosing one records its
 * action and reveals the scripted response. The player can't talk the other side into a different outcome.
 */
export function ChatThread({
  thread,
  onBack,
  backLabel = "Chats",
  backAlways = false,
}: {
  thread: ChatThreadContent;
  onBack?: () => void;
  backLabel?: string;
  /** Show the back control on wide screens too (otherwise it only appears in the stacked mobile layout). */
  backAlways?: boolean;
}) {
  const { recorded, record, interactive, reveal } = useSim();
  const [showDetails, setShowDetails] = useState(false);

  // Review (read-only): evidence inside the contact details opens that panel.
  useEffect(() => {
    const t = reveal?.target;
    if (t && "threadId" in t && t.threadId === thread.id && t.details) setShowDetails(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.nonce]);
  const messages = visibleMessages(thread, recorded);
  const replies = thread.branches.filter(
    (b) => !recorded.includes(b.actionId) && isAvailable(b.requires, recorded),
  );
  const decisions = useAvailableDecisions(thread.decisionIds);
  const listRef = useRef<HTMLOListElement>(null);
  const count = messages.length;

  useEffect(() => {
    // Scroll the conversation itself (never the page) to the newest message.
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b-2 border-mist px-3 py-2 sm:px-4">
        {onBack && (
          <span className={backAlways ? undefined : "md:hidden"}>
            <BackButton onClick={onBack}>{backLabel}</BackButton>
          </span>
        )}
        <Avatar initials={thread.contact.initials} className="size-9" />
        <div className="min-w-0 flex-1" {...anchor(thread.contact.anchor)}>
          <p className="truncate font-heading font-extrabold">{thread.contact.name}</p>
          <p className="truncate text-caption text-teal/80">{thread.contact.subtitle}</p>
        </div>
        <SimButton
          variant="quiet"
          icon="info"
          aria-expanded={showDetails}
          onClick={() => {
            if (!showDetails) record(thread.contact.detailsActionId);
            setShowDetails((v) => !v);
          }}
        >
          <span className="hidden sm:inline">Details</span>
          <span className="sr-only sm:hidden">Contact details</span>
        </SimButton>
      </header>

      {showDetails && (
        <section aria-label="Contact details" className="border-b-2 border-mist bg-mist/60 px-4 py-3">
          <KvList rows={thread.contact.details} />
        </section>
      )}

      <ol
        ref={listRef}
        aria-label={`Conversation with ${thread.contact.name}`}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-4"
      >
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "flex max-w-full flex-col",
              m.from === "me" ? "items-end" : m.from === "system" ? "items-center" : "items-start",
            )}
          >
            {m.from === "system" ? (
              <p
                className="max-w-md rounded-pill bg-mist px-3 py-1 text-center text-caption"
                {...anchor(m.anchor)}
              >
                {m.text}
              </p>
            ) : (
              <>
                {m.text && (
                  <p
                    className={cn(
                      "max-w-[85%] rounded-card px-3.5 py-2 text-small break-words whitespace-pre-line sm:max-w-[70%]",
                      m.from === "me"
                        ? "rounded-br-tile bg-teal text-white"
                        : "rounded-bl-tile bg-mist text-teal",
                    )}
                    {...anchor(m.anchor)}
                  >
                    <span className="sr-only">{m.from === "me" ? "You: " : `${thread.contact.name}: `}</span>
                    {m.text}
                  </p>
                )}
                {m.attachment && (
                  <div className="mt-1 max-w-[85%]">
                    <Attachment attachment={m.attachment} />
                  </div>
                )}
                {m.time && <span className="mt-0.5 px-1 text-caption text-teal/70">{m.time}</span>}
              </>
            )}
          </li>
        ))}
      </ol>

      <footer className="border-t-2 border-mist px-3 py-3 sm:px-4">
        {replies.length > 0 ? (
          <div>
            <p className="mb-2 text-caption font-semibold">Reply</p>
            <ul className="flex flex-wrap gap-2">
              {replies.map((b) => (
                <li key={b.actionId}>
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => record(b.actionId)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border-2 border-teal/35 bg-white px-3.5 text-left text-small hover:border-teal hover:bg-mist disabled:opacity-60"
                  >
                    <Icon name="send" className="size-3.5" />
                    {b.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-caption text-teal/80">No new replies to send in this conversation.</p>
        )}
        {decisions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-mist pt-3">
            {decisions.map((d) => (
              <DecisionButton key={d.id} decision={d} />
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}
