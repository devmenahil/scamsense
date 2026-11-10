"use client";

import { useEffect, useState } from "react";
import type { ChatThreadContent } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";
import { isAvailable } from "@/lib/domain/scenarioStateMachine";
import { Icon } from "@/components/icons/Icon";
import { ChatThread } from "./ChatThread";
import { useReveal, useSim } from "./SimContext";
import { Avatar } from "./primitives";

/**
 * Environment A (chat): a messaging app with a conversation list, threads, contact details, and controlled replies.
 * Threads gated by `requires` appear when their trigger happens (e.g. a code text arriving after a reply).
 */
export function MessagesApp({
  appId,
  title,
  threads,
}: {
  appId: string;
  title: string;
  threads: ChatThreadContent[];
}) {
  const { recorded, navRequest } = useSim();
  const visible = threads.filter((t) => isAvailable(t.requires, recorded));
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const open = visible.find((t) => t.id === openId) ?? null;

  function openThread(id: string) {
    setOpenId(id);
    setSeen((s) => new Set(s).add(id));
  }

  // Opening the app from a link (e.g. an email's chat link) shows its newest conversation.
  useEffect(() => {
    if (navRequest?.appId !== appId) return;
    const newest = visible[0];
    if (newest) openThread(newest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRequest?.nonce]);

  // Review (read-only): open the conversation that holds a piece of evidence.
  useReveal(appId, (t) => {
    if (t.kind === "thread") openThread(t.threadId);
  });

  return (
    <div className="grid h-full min-h-[30rem] md:grid-cols-[17rem_minmax(0,1fr)]">
      <section
        aria-label={`${title} conversations`}
        className={cn("border-teal/15 md:block md:border-r-2", open ? "hidden" : "block")}
      >
        <h3 className="px-4 pt-4 pb-2 font-heading text-lg font-extrabold">{title}</h3>
        <ul>
          {visible.map((t) => {
            const unread = t.unread && !seen.has(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openThread(t.id)}
                  aria-current={openId === t.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 border-t-2 border-mist px-4 py-3 text-left hover:bg-mist",
                    openId === t.id && "bg-mist",
                  )}
                >
                  <Avatar initials={t.contact.initials} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate font-heading", unread ? "font-black" : "font-bold")}>
                        {unread && <span className="sr-only">Unread: </span>}
                        {t.contact.name}
                      </span>
                      <span className="shrink-0 text-caption">{t.time}</span>
                    </span>
                    <span className={cn("block truncate text-small", unread && "font-semibold")}>
                      {t.preview}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-label="Conversation" className={cn("min-w-0 md:block", open ? "block" : "hidden")}>
        {open ? (
          <div className="flex h-full max-h-[40rem] min-h-[30rem] flex-col">
            <ChatThread key={open.id} thread={open} onBack={() => setOpenId(null)} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-teal/85">
            <Icon name="chat" className="size-8" />
            <p className="text-small">Select a conversation to read it.</p>
          </div>
        )}
      </section>
    </div>
  );
}
