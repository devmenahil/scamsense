"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { anchor, useSim } from "./SimContext";

/**
 * Environment B chrome: a simulated browser toolbar (back / forward / reload), an address bar showing the page's
 * displayed address, and a site-information panel opened by clicking the address. The address bar is never
 * highlighted, and nothing here leaves the simulation: every address is a non-functional `.example` domain (R29).
 */
export function BrowserFrame({
  url,
  addressAnchor,
  connection,
  inspectActionId,
  canBack,
  canForward,
  onBack,
  onForward,
  onReload,
  bookmarks,
  children,
}: {
  url: string;
  addressAnchor: string;
  connection: string;
  inspectActionId?: string;
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  bookmarks?: ReactNode;
  children: ReactNode;
}) {
  const { record } = useSim();
  const [info, setInfo] = useState(false);
  const toolButton =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-pill hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b-2 border-teal/15 bg-mist">
        <div className="flex items-center gap-1 px-2 py-2 sm:gap-2 sm:px-3">
          <button type="button" className={toolButton} onClick={onBack} disabled={!canBack} aria-label="Back">
            <Icon name="arrow-right" className="size-4 rotate-180" />
          </button>
          <button
            type="button"
            className={toolButton}
            onClick={onForward}
            disabled={!canForward}
            aria-label="Forward"
          >
            <Icon name="arrow-right" className="size-4" />
          </button>
          <button
            type="button"
            className={`${toolButton} hidden sm:inline-flex`}
            onClick={onReload}
            aria-label="Reload"
          >
            <Icon name="clock" className="size-4" />
          </button>
          <button
            type="button"
            aria-expanded={info}
            aria-label={`Address: ${url}. Show site information`}
            onClick={() => {
              if (!info) record(inspectActionId);
              setInfo((v) => !v);
            }}
            className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-pill border-2 border-teal/25 bg-white px-3 text-left text-small hover:border-teal/50"
            {...anchor(addressAnchor)}
          >
            <Icon name="lock" className="size-3.5 shrink-0" />
            <span className="truncate">{url}</span>
          </button>
        </div>
        {info && (
          <section
            aria-label="Site information"
            className="mx-2 mb-2 rounded-tile border-2 border-teal/20 bg-white p-3 text-small sm:mx-3"
          >
            <p className="font-heading font-extrabold">Site information</p>
            <p className="mt-1 break-all">
              <span className="font-semibold">Address: </span>
              {url}
            </p>
            <p className="mt-1">{connection}</p>
          </section>
        )}
        {bookmarks}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">{children}</div>
    </div>
  );
}
