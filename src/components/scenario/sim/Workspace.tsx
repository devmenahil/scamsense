"use client";

import { useState } from "react";
import type { AppContent } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";
import { BrowserApp } from "./BrowserApp";
import { MailApp } from "./MailApp";
import { MarketplaceApp } from "./MarketplaceApp";
import { MessagesApp } from "./MessagesApp";
import { SellerHubApp } from "./SellerHubApp";
import { WalletApp } from "./WalletApp";

/**
 * The simulated device: an app dock (left rail on desktop, tab strip on small screens) hosting the scenario's apps.
 * Every app stays mounted while hidden so the player's place in each app is kept while switching (R8).
 */
export function Workspace({
  apps,
  activeAppId,
  onSelectApp,
}: {
  apps: readonly AppContent[];
  activeAppId: string;
  onSelectApp: (id: string) => void;
}) {
  // Apps are mounted on first visit (keeps the initial page light) and then stay mounted.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([activeAppId]));
  if (!visited.has(activeAppId)) setVisited((v) => new Set(v).add(activeAppId));
  const multi = apps.length > 1;

  return (
    <div className="overflow-hidden rounded-panel border-2 border-teal bg-white shadow-edge">
      <div className={cn("flex flex-col", multi && "lg:flex-row")}>
        {multi && (
          <nav
            aria-label="Apps"
            className="flex shrink-0 gap-1 overflow-x-auto border-b-2 border-teal bg-mist p-2 lg:w-24 lg:flex-col lg:border-r-2 lg:border-b-0"
          >
            {apps.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-current={a.id === activeAppId ? "page" : undefined}
                onClick={() => onSelectApp(a.id)}
                className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-tile px-1 py-1.5 text-caption font-semibold hover:bg-white aria-[current=page]:bg-white sm:flex-row sm:gap-2 sm:px-3 sm:text-small lg:flex-none lg:flex-col lg:gap-1 lg:px-1 lg:text-caption"
              >
                <Icon name={a.icon} className="size-5" />
                <span className="max-w-full truncate lg:text-center">{a.label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="min-h-[32rem] min-w-0 flex-1">
          {apps.map((a) =>
            visited.has(a.id) ? (
              <div key={a.id} hidden={a.id !== activeAppId} className="h-full">
                <AppHost app={a} />
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

function AppHost({ app }: { app: AppContent }) {
  switch (app.type) {
    case "messages":
      return <MessagesApp appId={app.id} title={app.label} threads={app.threads} />;
    case "mail":
      return (
        <MailApp
          appId={app.id}
          title={app.label}
          accountAddress={app.accountAddress}
          messages={app.messages}
        />
      );
    case "browser":
      return (
        <BrowserApp appId={app.id} homePageId={app.homePageId} bookmarks={app.bookmarks} pages={app.pages} />
      );
    case "wallet":
      return <WalletApp appId={app.id} brand={app.brand} owner={app.owner} tabs={app.tabs} />;
    case "marketplace":
      return <MarketplaceApp app={app} />;
    case "seller_hub":
      return <SellerHubApp app={app} />;
  }
}
