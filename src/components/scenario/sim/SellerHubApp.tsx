"use client";

import { useState } from "react";
import type { SellerHubAppContent } from "@/content/scenarios/schema";
import { Icon } from "@/components/icons/Icon";
import { BrowserFrame } from "./BrowserFrame";
import { ChatThread } from "./ChatThread";
import { ProductArt } from "./ProductArt";
import { anchor, useAvailableDecisions, useReveal, useSim } from "./SimContext";
import { KvList, DecisionButton } from "./primitives";

type Tab = "overview" | "listings" | "orders" | "messages";

/**
 * Environment D (online marketplace, SELLER side) for M3-S2: the player's seller dashboard with listings, orders
 * (status, payment, shipping address, timeline), and on-platform buyer messages. "Mark as shipped" is a decision.
 */
export function SellerHubApp({ app }: { app: SellerHubAppContent }) {
  const { record } = useSim();
  const [tab, setTab] = useState<Tab>("overview");
  const [orderId, setOrderId] = useState<string | null>(null);
  const order = app.orders.find((o) => o.id === orderId) ?? null;
  const thread = app.threads[0]!;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "listings", label: "Listings" },
    { id: "orders", label: "Orders" },
    { id: "messages", label: "Messages" },
  ];
  const path = tab === "orders" && order ? `orders/${order.number}` : tab;

  // Review (read-only): open the tab or order that holds a piece of evidence.
  useReveal(app.id, (t) => {
    if (t.kind !== "hub") return;
    setTab(t.tab);
    setOrderId(t.tab === "orders" ? (t.orderId ?? null) : null);
  });

  function openOrder(id: string) {
    record(app.orders.find((o) => o.id === id)?.viewActionId);
    setTab("orders");
    setOrderId(id);
  }

  return (
    <BrowserFrame
      url={`https://${app.domain}/${path}`}
      addressAnchor={app.addressAnchor}
      connection={app.connection}
      inspectActionId={app.inspectActionId}
      canBack={tab !== "overview" || orderId !== null}
      canForward={false}
      onBack={() => (orderId ? setOrderId(null) : setTab("overview"))}
      onForward={() => undefined}
      onReload={() => setOrderId((o) => o)}
    >
      <div className="flex flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b-2 border-mist px-4 py-3 sm:px-6">
          <span
            aria-hidden="true"
            className="inline-flex size-9 items-center justify-center rounded-tile bg-teal-shade text-white"
          >
            <Icon name="marketplace" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg leading-5 font-black">{app.siteName} Seller Hub</p>
            <p className="text-caption">Signed in as {app.sellerName}</p>
          </div>
          <nav aria-label="Seller Hub" className="flex w-full flex-wrap gap-1 sm:w-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tab === t.id ? "page" : undefined}
                onClick={() => {
                  setTab(t.id);
                  setOrderId(null);
                }}
                className="inline-flex min-h-9 items-center gap-1 rounded-pill px-3 text-small font-semibold hover:bg-mist aria-[current=page]:bg-mist"
              >
                {t.label}
                {t.id === "messages" && thread.unread && <span className="sr-only"> (new message)</span>}
              </button>
            ))}
          </nav>
        </header>

        <div className="px-4 py-5 sm:px-6">
          {tab === "overview" && (
            <section aria-label="Overview" className="flex flex-col gap-5">
              <KvList rows={app.overview} className="max-w-md rounded-tile bg-mist p-4" />
              <div>
                <h4 className="font-heading text-lg font-extrabold">Needs your attention</h4>
                <ul className="mt-2 flex flex-col gap-2">
                  {app.orders.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => openOrder(o.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-tile border-2 border-mist px-3 py-2.5 text-left hover:bg-mist"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold break-words">
                            Order {o.number} · {o.item}
                          </span>
                          <span className="block text-caption">{o.placed}</span>
                        </span>
                        <Icon name="arrow-right" className="size-4 shrink-0" />
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => setTab("messages")}
                      className="flex w-full items-center justify-between gap-3 rounded-tile border-2 border-mist px-3 py-2.5 text-left hover:bg-mist"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">Message from {thread.contact.name}</span>
                        <span className="block truncate text-caption">{thread.preview}</span>
                      </span>
                      <Icon name="arrow-right" className="size-4 shrink-0" />
                    </button>
                  </li>
                </ul>
              </div>
            </section>
          )}

          {tab === "listings" && (
            <ul aria-label="Your listings" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {app.listings.map((l) => (
                <li key={l.id} className="rounded-tile border-2 border-mist p-3" {...anchor(l.anchor)}>
                  <ProductArt art={l.art} />
                  <p className="mt-2 font-semibold break-words">{l.title}</p>
                  <p className="font-heading text-lg font-black">{l.price}</p>
                  <p className="text-caption">
                    {l.status} · {l.views}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {tab === "orders" && !order && (
            <ul aria-label="Orders" className="flex flex-col gap-2">
              {app.orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => openOrder(o.id)}
                    className="grid w-full gap-1 rounded-tile border-2 border-mist px-3 py-2.5 text-left hover:bg-mist sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-semibold break-words">
                      {o.number} · {o.item}
                    </span>
                    <span className="text-small">{o.total}</span>
                    <span className="text-small">{o.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab === "orders" && order && <OrderDetail order={order} />}

          {tab === "messages" && (
            <div className="flex h-[34rem] flex-col overflow-hidden rounded-tile border-2 border-mist">
              <ChatThread thread={thread} />
            </div>
          )}
        </div>
      </div>
    </BrowserFrame>
  );
}

function OrderDetail({ order: o }: { order: SellerHubAppContent["orders"][number] }) {
  const decisions = useAvailableDecisions(o.decisionIds);
  return (
    <article aria-label={`Order ${o.number}`} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <h4 className="font-heading text-2xl font-black break-words">Order {o.number}</h4>
        <p className="text-small">
          Placed {o.placed} · Buyer {o.buyer}
        </p>
        <div className="mt-4 flex gap-3 rounded-tile border-2 border-mist p-3">
          <ProductArt art={o.art} className="w-24 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold break-words">{o.item}</p>
            <p className="text-small">Total {o.total}</p>
          </div>
        </div>
        <section className="mt-4 rounded-tile bg-mist p-4" {...anchor(o.statusAnchor)}>
          <p className="text-caption font-semibold uppercase">Order status</p>
          <p className="font-heading text-lg font-extrabold">{o.status}</p>
          <p className="mt-1 text-small">{o.paymentNote}</p>
        </section>
        <section className="mt-4">
          <h5 className="font-heading font-extrabold">Timeline</h5>
          <ol className="mt-2 flex flex-col gap-1.5 text-small">
            {o.timeline.map((t) => (
              <li key={t.label} className="flex justify-between gap-3 border-b-2 border-mist pb-1.5">
                <span>{t.label}</span>
                <span>{t.date}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <aside className="flex flex-col gap-4 self-start">
        <section className="rounded-tile border-2 border-mist p-4" {...anchor(o.shipToAnchor)}>
          <h5 className="font-heading font-extrabold">Ship to</h5>
          {o.shipTo.map((l) => (
            <p key={l} className="text-small break-words">
              {l}
            </p>
          ))}
        </section>
        {decisions.length > 0 && (
          <div className="flex flex-col gap-2">
            {decisions.map((d) => (
              <DecisionButton key={d.id} decision={d} className="w-full" />
            ))}
          </div>
        )}
      </aside>
    </article>
  );
}
