"use client";

import { useEffect, useState } from "react";
import type { BrowserPageContent } from "@/content/scenarios/schema";
import { isAvailable } from "@/lib/domain/scenarioStateMachine";
import { Icon } from "@/components/icons/Icon";
import { BrowserFrame } from "./BrowserFrame";
import { SiteBlocks } from "./SiteBlocks";
import { useReveal, useSim } from "./SimContext";

/**
 * Environment B (fictional web browser): history with back/forward, a bookmarks bar, an inspectable address bar, and
 * fictional sites rendered from content. Pages reached from a message only exist once that link was followed.
 * There are no sign-in forms anywhere (R33, Step 6 brief §3B).
 */
export function BrowserApp({
  appId,
  homePageId,
  bookmarks,
  pages,
}: {
  appId: string;
  homePageId: string;
  bookmarks: readonly { label: string; pageId: string; actionId?: string }[];
  pages: readonly BrowserPageContent[];
}) {
  const { record, recorded, navRequest } = useSim();
  const [history, setHistory] = useState<string[]>([homePageId]);
  const [index, setIndex] = useState(0);
  const [reloads, setReloads] = useState(0);
  const pageId = history[index]!;
  const page = pages.find((p) => p.id === pageId);
  const reachable = page && isAvailable(page.requires, recorded);

  function navigate(id: string) {
    setHistory((h) => [...h.slice(0, index + 1), id]);
    setIndex((i) => i + 1);
  }

  // Links from other apps (e.g. an email button) open their page here.
  useEffect(() => {
    if (navRequest?.appId === appId && navRequest.pageId) navigate(navRequest.pageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navRequest?.nonce]);

  // Review (read-only): show the page that holds a piece of evidence.
  useReveal(appId, (t) => {
    if (t.kind === "page" && t.pageId !== pageId) navigate(t.pageId);
  });

  // Visiting a page can count as an action (e.g. opening the official site from a bookmark).
  useEffect(() => {
    if (reachable) record(page.visitActionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, reachable]);

  return (
    <BrowserFrame
      key={`${pageId}-${reloads}`}
      url={page && reachable ? page.url : "about:blank"}
      addressAnchor={page?.addressAnchor ?? "blank_address"}
      connection={page?.connection ?? ""}
      inspectActionId={reachable ? page?.inspectActionId : undefined}
      canBack={index > 0}
      canForward={index < history.length - 1}
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onForward={() => setIndex((i) => Math.min(history.length - 1, i + 1))}
      onReload={() => setReloads((n) => n + 1)}
      bookmarks={
        bookmarks.length > 0 ? (
          <nav aria-label="Bookmarks" className="flex flex-wrap gap-1 px-2 pb-2 sm:px-3">
            {bookmarks.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => {
                  record(b.actionId);
                  navigate(b.pageId);
                }}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-pill px-2.5 text-caption font-semibold hover:bg-white"
              >
                <Icon name="book" className="size-3.5" />
                {b.label}
              </button>
            ))}
          </nav>
        ) : null
      }
    >
      {page && reachable ? (
        <div>
          <header className="flex flex-wrap items-center gap-3 border-b-2 border-mist px-4 py-3 sm:px-6">
            <span
              aria-hidden="true"
              className="inline-flex size-10 items-center justify-center rounded-tile bg-teal-shade font-heading text-small font-black text-white"
            >
              {page.site.mark}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-lg leading-6 font-black">{page.site.name}</p>
              {page.site.tagline && <p className="text-caption">{page.site.tagline}</p>}
            </div>
            {page.nav.length > 0 && (
              <nav aria-label={`${page.site.name} navigation`} className="flex flex-wrap gap-1">
                {page.nav.map((n) => (
                  <button
                    key={n.pageId}
                    type="button"
                    aria-current={n.pageId === pageId ? "page" : undefined}
                    onClick={() => navigate(n.pageId)}
                    className="inline-flex min-h-9 items-center rounded-pill px-3 text-small font-semibold hover:bg-mist aria-[current=page]:bg-mist"
                  >
                    {n.label}
                  </button>
                ))}
              </nav>
            )}
          </header>
          <div className="px-4 py-5 sm:px-6">
            <SiteBlocks blocks={page.blocks} onNavigate={navigate} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <Icon name="search" className="size-8" />
          <p className="font-heading font-extrabold">This page isn&apos;t available</p>
        </div>
      )}
    </BrowserFrame>
  );
}
