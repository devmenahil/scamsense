"use client";

import { useEffect, useState } from "react";
import type { AttachmentContent, MailMessageContent } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";
import { isAvailable } from "@/lib/domain/scenarioStateMachine";
import { Icon } from "@/components/icons/Icon";
import { Modal } from "@/components/ui/Modal";
import { Attachment } from "./Attachments";
import { InvoiceView } from "./InvoiceView";
import { anchor, useAvailableDecisions, useSim } from "./SimContext";
import { Avatar, BackButton, DecisionButton, KvList, SimButton } from "./primitives";

type DocumentAttachment = Extract<AttachmentContent, { kind: "document" }>;

/**
 * Environment A (email): inbox list + reading pane, sender details, a link status line (like hovering a link in a
 * real mail client), attachments that open in a document viewer, and toolbar decisions. Nothing is highlighted (R10).
 */
export function MailApp({
  title,
  accountAddress,
  messages,
}: {
  title: string;
  accountAddress: string;
  messages: MailMessageContent[];
}) {
  const { recorded, record, interactive } = useSim();
  const visible = messages.filter((m) => isAvailable(m.requires, recorded));
  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [doc, setDoc] = useState<DocumentAttachment | null>(null);
  const open = visible.find((m) => m.id === openId) ?? null;

  // A decision made inside the document viewer closes it, so the confirmation is the only open dialog.
  useEffect(() => {
    if (!interactive) setDoc(null);
  }, [interactive]);

  function openMessage(m: MailMessageContent) {
    setOpenId(m.id);
    setRead((s) => new Set(s).add(m.id));
    record(m.openActionId);
  }

  return (
    <div className="grid h-full min-h-[30rem] md:grid-cols-[18rem_minmax(0,1fr)]">
      <section
        aria-label="Inbox"
        className={cn("border-teal/15 md:block md:border-r-2", open ? "hidden" : "block")}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h3 className="font-heading text-lg font-extrabold">{title}</h3>
          <span className="truncate text-caption">{accountAddress}</span>
        </div>
        <ul>
          {visible.map((m) => {
            const unread = m.unread && !read.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => openMessage(m)}
                  aria-current={openId === m.id ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-t-2 border-mist px-4 py-3 text-left hover:bg-mist",
                    openId === m.id && "bg-mist",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate font-heading", unread ? "font-black" : "font-bold")}>
                      {unread && <span className="sr-only">Unread: </span>}
                      {m.from.name}
                    </span>
                    <span className="shrink-0 text-caption">{m.listDate}</span>
                  </span>
                  <span className={cn("truncate text-small", unread && "font-semibold")}>{m.subject}</span>
                  <span className="truncate text-caption text-teal/80">{m.preview}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Message" className={cn("min-w-0 md:block", open ? "block" : "hidden")}>
        {open ? (
          <MailMessage key={open.id} message={open} onBack={() => setOpenId(null)} onOpenDocument={setDoc} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-teal/85">
            <Icon name="mail" className="size-8" />
            <p className="text-small">Select a message to read it.</p>
          </div>
        )}
      </section>

      <Modal open={doc !== null} onClose={() => setDoc(null)} title={doc?.name ?? "Document"} size="lg">
        {doc && <InvoiceView invoice={doc.invoice} />}
      </Modal>
    </div>
  );
}

function MailMessage({
  message: m,
  onBack,
  onOpenDocument,
}: {
  message: MailMessageContent;
  onBack: () => void;
  onOpenDocument: (d: DocumentAttachment) => void;
}) {
  const { record, openApp, interactive } = useSim();
  const [details, setDetails] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const decisions = useAvailableDecisions(m.decisionIds);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-mist px-3 py-2 sm:px-4">
        <span className="md:hidden">
          <BackButton onClick={onBack}>Inbox</BackButton>
        </span>
        {decisions.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {decisions.map((d) => (
              <DecisionButton key={d.id} decision={d} />
            ))}
          </div>
        )}
      </div>
      <article className="flex-1 px-4 py-5 sm:px-6">
        <h4
          className="font-heading text-xl leading-7 font-extrabold break-words"
          {...anchor(m.subjectAnchor)}
        >
          {m.subject}
        </h4>
        <div className="mt-3 flex items-start gap-3">
          <Avatar
            initials={m.from.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          />
          <div className="min-w-0 flex-1 text-small" {...anchor(m.fromAnchor)}>
            <p className="font-semibold break-words">{m.from.name}</p>
            <p className="text-caption">{m.fullDate}</p>
            <SimButton
              variant="quiet"
              className="-ml-3 min-h-9 text-caption underline underline-offset-2"
              aria-expanded={details}
              onClick={() => {
                if (!details) record(m.detailsActionId);
                setDetails((v) => !v);
              }}
            >
              {details ? "Hide details" : "Show details"}
            </SimButton>
            {details && (
              <KvList
                className="mt-1 rounded-tile bg-mist p-3 text-caption break-all"
                rows={[
                  { label: "From", value: `${m.from.name} <${m.from.address}>` },
                  ...(m.replyTo ? [{ label: "Reply-to", value: m.replyTo }] : []),
                  { label: "To", value: m.to },
                  { label: "Date", value: m.fullDate },
                ]}
              />
            )}
          </div>
        </div>

        <div className="mt-5 flex max-w-prose flex-col gap-3">
          {m.body.map((b, i) => {
            switch (b.type) {
              case "p":
                return (
                  <p key={i} className="break-words" {...anchor(b.anchor)}>
                    {b.text}
                  </p>
                );
              case "small":
                return (
                  <p key={i} className="text-caption break-words text-teal/80" {...anchor(b.anchor)}>
                    {b.text}
                  </p>
                );
              case "kv":
                return (
                  <div key={i} {...anchor(b.anchor)}>
                    <KvList rows={b.rows} className="rounded-tile bg-mist p-3" />
                  </div>
                );
              case "link":
                return (
                  <p key={i}>
                    <button
                      type="button"
                      disabled={!interactive}
                      onMouseEnter={() => setStatus(b.url)}
                      onMouseLeave={() => setStatus(null)}
                      onFocus={() => setStatus(b.url)}
                      onBlur={() => setStatus(null)}
                      onClick={() => {
                        record(b.actionId);
                        if (b.opens) openApp(b.opens.appId, b.opens.pageId);
                      }}
                      className={cn(
                        b.style === "button"
                          ? "inline-flex min-h-11 items-center rounded-[6px] bg-teal-shade px-5 font-semibold text-white hover:bg-teal"
                          : "font-semibold underline underline-offset-2",
                      )}
                      {...anchor(b.anchor)}
                    >
                      {b.text}
                    </button>
                  </p>
                );
            }
          })}
        </div>

        {m.attachments.length > 0 && (
          <div className="mt-6">
            <p className="text-caption font-semibold">
              {m.attachments.length} attachment{m.attachments.length > 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {m.attachments.map((a, i) => (
                <Attachment key={i} attachment={a} onOpenDocument={onOpenDocument} />
              ))}
            </div>
          </div>
        )}
      </article>
      {/* Link status line, like a mail client's hover preview. Shown for every link the same way. */}
      <p
        aria-live="polite"
        className="min-h-8 border-t-2 border-mist px-4 py-1.5 text-caption break-all text-teal/85"
      >
        {status ?? ""}
      </p>
    </div>
  );
}
