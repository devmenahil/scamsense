"use client";

import type { AttachmentContent } from "@/content/scenarios/schema";
import { Icon } from "@/components/icons/Icon";
import { anchor, useSim } from "./SimContext";
import { KvList } from "./primitives";

/** Renders an attachment inside a chat bubble or an email. Documents open in the document viewer. */
export function Attachment({
  attachment,
  onOpenDocument,
}: {
  attachment: AttachmentContent;
  onOpenDocument?: (a: Extract<AttachmentContent, { kind: "document" }>) => void;
}) {
  const { record } = useSim();
  switch (attachment.kind) {
    case "receipt":
      return (
        <figure className="w-full max-w-xs" {...anchor(attachment.anchor)}>
          <figcaption className="mb-1 flex items-center gap-1.5 text-caption">
            <Icon name="info" className="size-3.5" />
            {attachment.caption}
          </figcaption>
          <div className="rounded-tile border-2 border-teal/25 bg-white p-3 text-teal">
            <p className="font-heading font-extrabold">{attachment.title}</p>
            <KvList rows={attachment.rows} className="mt-2" />
            {attachment.footer && <p className="mt-2 text-caption text-teal/80">{attachment.footer}</p>}
          </div>
        </figure>
      );
    case "payment_request":
      return (
        <div
          className="w-full max-w-xs rounded-tile border-2 border-teal/25 bg-white p-3 text-teal"
          {...anchor(attachment.anchor)}
        >
          <p className="flex items-center gap-1.5 text-caption font-semibold">
            <Icon name="wallet" className="size-4" />
            {attachment.title}
          </p>
          <p className="mt-1 font-heading text-xl font-black">{attachment.amount}</p>
          <p className="text-small">to {attachment.payee}</p>
          <KvList rows={attachment.rows} className="mt-2" />
        </div>
      );
    case "document":
      return (
        <button
          type="button"
          onClick={() => {
            record(attachment.actionId);
            onOpenDocument?.(attachment);
          }}
          className="flex w-full max-w-xs items-center gap-3 rounded-tile border-2 border-teal/25 bg-white p-3 text-left hover:border-teal hover:bg-mist"
          {...anchor(attachment.anchor)}
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-tile bg-mist">
            <Icon name="invoice" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{attachment.name}</span>
            <span className="block text-caption text-teal/80">PDF · {attachment.size} · Open</span>
          </span>
        </button>
      );
  }
}
