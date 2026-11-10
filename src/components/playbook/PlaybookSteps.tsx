"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaybookStepView } from "@/lib/recovery/playbook";
import type { NoteState } from "@/lib/recovery/server";
import { apiRequest } from "@/lib/api/client";
import { LogoSymbol } from "@/components/brand/Logo";
import { Icon } from "@/components/icons/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { SourceLink } from "./SourceLink";

/**
 * "What you could do" + the optional personal note (Step 9). The note is requested at most once per page view and
 * only when none is stored; the server makes at most one Gemini call per attempt. The steps themselves are authored
 * (practice tips) or verified PayPal facts with their source — the note only changes which steps are shown first.
 */
export function PlaybookSteps({
  attemptId,
  steps,
  initialNote,
}: {
  attemptId: string;
  steps: PlaybookStepView[];
  initialNote: NoteState;
}) {
  const [note, setNote] = useState<NoteState>(initialNote);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || (note.status !== "missing" && note.status !== "pending")) return;
    asked.current = true;
    void apiRequest<{ note: NoteState }>(`/api/attempts/${attemptId}/playbook`, { method: "POST" }).then(
      (r) => setNote(r.ok ? r.data.note : { status: "unavailable" }),
    );
  }, [attemptId, note.status]);

  const emphasis = note.status === "ready" && note.source === "gemini" ? note.note.emphasisStepIds : [];
  const ordered = [
    ...emphasis.map((id) => steps.find((s) => s.id === id)).filter((s): s is PlaybookStepView => !!s),
    ...steps.filter((s) => !emphasis.includes(s.id)),
  ];

  return (
    <div>
      {(note.status === "missing" || note.status === "pending") && (
        <p className="mb-4 flex items-center gap-2 text-caption" role="status">
          <Spinner className="size-4" /> Tailoring a short note to your decision…
        </p>
      )}
      {note.status === "ready" && note.source === "gemini" && (
        <div className="mb-5 flex items-start gap-3 rounded-card bg-mist p-4">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-tile bg-white">
            <LogoSymbol className="w-6" />
          </span>
          <div>
            <p className="font-heading font-extrabold">A note for you</p>
            <p className="mt-1 text-small">{note.note.note}</p>
            <p className="mt-1 text-caption text-teal/80">
              Written by AI from your result. It never adds or changes PayPal policy: that comes only from the
              verified sources below.
            </p>
          </div>
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {ordered.map((s, i) => (
          <li key={s.id} className="flex items-start gap-3 rounded-card border-2 border-teal/25 p-4">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-teal font-heading text-small font-black text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              {emphasis.includes(s.id) && (
                <p className="mb-1 flex items-center gap-1 text-caption font-semibold">
                  <Icon name="target" className="size-3.5" /> Most relevant to your decision
                </p>
              )}
              {s.kind === "paypal" && s.source ? (
                <>
                  <p className="font-semibold">{s.lead}</p>
                  <blockquote className="mt-1 border-l-4 border-teal/40 pl-3 text-small">{s.text}</blockquote>
                  <SourceLink
                    className="mt-2"
                    title={s.source.title}
                    url={s.source.url}
                    verified={s.source.lastVerified}
                  />
                </>
              ) : (
                <>
                  <p className="text-small">{s.text}</p>
                  <p className="mt-1 text-caption text-teal/80">ScamSense practice tip</p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
