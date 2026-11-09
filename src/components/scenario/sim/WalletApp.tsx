"use client";

import { useState } from "react";
import type { SiteBlockContent } from "@/content/scenarios/schema";
import { SiteBlocks } from "./SiteBlocks";
import { useSim } from "./SimContext";

/**
 * A fictional payment-account app (TandemPay) for independent verification: the player opens it themselves to check
 * activity, security events, and official contact details. Deliberately not styled like PayPal (R34).
 */
export function WalletApp({
  brand,
  owner,
  tabs,
}: {
  brand: string;
  owner: string;
  tabs: readonly { id: string; label: string; actionId?: string; blocks: SiteBlockContent[] }[];
}) {
  const { record } = useSim();
  const [tabId, setTabId] = useState<string | null>(null);
  const tab = tabs.find((t) => t.id === tabId) ?? null;

  function openTab(id: string) {
    const t = tabs.find((x) => x.id === id);
    record(t?.actionId);
    setTabId(id);
  }

  return (
    <div className="flex h-full min-h-[30rem] justify-center bg-mist/50 p-3 sm:p-6">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-panel border-2 border-teal/25 bg-white">
        <header className="on-dark bg-teal-shade px-5 py-4 text-white">
          <p className="font-heading text-xl font-black">{brand}</p>
          <p className="text-caption text-white/85">Signed in as {owner} on this phone</p>
        </header>
        {tab ? (
          <>
            <nav
              aria-label={`${brand} sections`}
              className="flex gap-1 overflow-x-auto border-b-2 border-mist px-2 py-2"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={t.id === tabId ? "page" : undefined}
                  onClick={() => openTab(t.id)}
                  className="inline-flex min-h-9 shrink-0 items-center rounded-pill px-3 text-small font-semibold hover:bg-mist aria-[current=page]:bg-mist"
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-4">
              <SiteBlocks blocks={tab.blocks} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-small">Open {brand} to see your account.</p>
            <button
              type="button"
              onClick={() => openTab(tabs[0]!.id)}
              className="inline-flex min-h-11 items-center rounded-tile bg-teal-shade px-5 font-semibold text-white hover:bg-teal"
            >
              Open {brand}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
