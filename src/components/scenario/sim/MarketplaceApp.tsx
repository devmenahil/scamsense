"use client";

import { useEffect, useState } from "react";
import type { MarketplaceAppContent, ProductContent } from "@/content/scenarios/schema";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/Icon";
import { BrowserFrame } from "./BrowserFrame";
import { ChatThread } from "./ChatThread";
import { ProductArt } from "./ProductArt";
import { anchor, useAvailableDecisions, useSim } from "./SimContext";
import { DecisionButton, KvList, SimButton } from "./primitives";

type Page =
  | { kind: "home" }
  | { kind: "product"; id: string }
  | { kind: "seller"; id: string }
  | { kind: "chat"; threadId: string }
  | { kind: "checkout" };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Environment D (online marketplace, buyer side): search results, product pages with specs and reviews, seller
 * profiles, on-platform seller messages, and a checkout whose "Place order" is the pay decision. The payment itself
 * is the PayPal Sandbox checkout that runs after the player's explanation (Step 7).
 */
export function MarketplaceApp({ app }: { app: MarketplaceAppContent }) {
  const { record } = useSim();
  const [history, setHistory] = useState<Page[]>([{ kind: "home" }]);
  const [index, setIndex] = useState(0);
  const page = history[index]!;

  function go(p: Page) {
    setHistory((h) => [...h.slice(0, index + 1), p]);
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    if (page.kind === "product") record(app.products.find((p) => p.id === page.id)?.openActionId);
    if (page.kind === "seller") record(app.sellers.find((s) => s.id === page.id)?.profileActionId);
    if (page.kind === "checkout") record(app.checkout.viewActionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const base = `https://${app.domain}`;
  const url =
    page.kind === "home"
      ? `${base}/search?q=${encodeURIComponent(app.searchQuery).replace(/%20/g, "+")}`
      : page.kind === "product"
        ? `${base}/item/${slug(app.products.find((p) => p.id === page.id)?.title ?? page.id).slice(0, 32)}`
        : page.kind === "seller"
          ? `${base}/seller/${slug(app.sellers.find((s) => s.id === page.id)?.name ?? page.id)}`
          : page.kind === "chat"
            ? `${base}/messages`
            : `${base}/checkout`;

  return (
    <BrowserFrame
      url={url}
      addressAnchor={app.addressAnchor}
      connection={app.connection}
      inspectActionId={app.inspectActionId}
      canBack={index > 0}
      canForward={index < history.length - 1}
      onBack={() => setIndex((i) => Math.max(0, i - 1))}
      onForward={() => setIndex((i) => Math.min(history.length - 1, i + 1))}
      onReload={() => setHistory((h) => [...h])}
    >
      <div className="flex flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b-2 border-mist px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => go({ kind: "home" })}
            className="flex items-center gap-2 text-left"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-9 items-center justify-center rounded-tile bg-teal-shade text-white"
            >
              <Icon name="marketplace" className="size-5" />
            </span>
            <span>
              <span className="block font-heading text-lg leading-5 font-black">{app.siteName}</span>
              <span className="block text-caption">{app.tagline}</span>
            </span>
          </button>
          <nav aria-label="Categories" className="ml-auto hidden flex-wrap gap-1 lg:flex">
            {app.categories.map((c) => (
              <span key={c} className="rounded-pill px-2.5 py-1 text-small font-semibold">
                {c}
              </span>
            ))}
          </nav>
        </header>

        <div className="px-4 py-5 sm:px-6">
          {page.kind === "home" && <Home app={app} onOpen={(id) => go({ kind: "product", id })} />}
          {page.kind === "product" && (
            <ProductPage
              app={app}
              product={app.products.find((p) => p.id === page.id)!}
              onSeller={(id) => go({ kind: "seller", id })}
              onMessage={(threadId) => go({ kind: "chat", threadId })}
              onBuy={() => go({ kind: "checkout" })}
            />
          )}
          {page.kind === "seller" && (
            <SellerPage
              app={app}
              sellerId={page.id}
              onMessage={(threadId) => go({ kind: "chat", threadId })}
              onProduct={(id) => go({ kind: "product", id })}
            />
          )}
          {page.kind === "chat" && (
            <div className="flex h-[34rem] flex-col overflow-hidden rounded-tile border-2 border-mist">
              <ChatThread
                thread={app.threads.find((t) => t.id === page.threadId)!}
                onBack={() => setIndex((i) => Math.max(0, i - 1))}
                backLabel="Back"
                backAlways
              />
            </div>
          )}
          {page.kind === "checkout" && <Checkout app={app} />}
        </div>
      </div>
    </BrowserFrame>
  );
}

function Stars({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-small">
      <span aria-hidden="true">★</span>
      <span>{value}</span>
    </span>
  );
}

function Home({ app, onOpen }: { app: MarketplaceAppContent; onOpen: (id: string) => void }) {
  return (
    <section aria-label="Search results">
      <p className="flex items-center gap-2 rounded-pill border-2 border-teal/25 px-4 py-2 text-small">
        <Icon name="search" className="size-4" />
        <span className="sr-only">Search: </span>
        {app.searchQuery}
      </p>
      <p className="mt-3 text-caption">{app.products.length} results</p>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {app.products.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className="flex h-full w-full gap-3 rounded-tile border-2 border-mist p-3 text-left hover:border-teal/40 sm:flex-col sm:gap-0"
            >
              <ProductArt art={p.art} className="w-24 shrink-0 self-start sm:w-full" />
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 font-semibold sm:mt-3">{p.title}</span>
                <span className="mt-1 font-heading text-lg font-black">{p.price}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-caption">
                  <Stars value={p.rating} />
                  <span>{p.ratingCount}</span>
                  <span>· {p.condition}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductPage({
  app,
  product: p,
  onSeller,
  onMessage,
  onBuy,
}: {
  app: MarketplaceAppContent;
  product: ProductContent;
  onSeller: (id: string) => void;
  onMessage: (threadId: string) => void;
  onBuy: () => void;
}) {
  const { record, interactive } = useSim();
  const [tab, setTab] = useState<"description" | "specs" | "reviews">("description");
  const seller = app.sellers.find((s) => s.id === p.sellerId)!;
  const [report] = useAvailableDecisions(p.reportDecisionId ? [p.reportDecisionId] : []);
  const tabs = [
    { id: "description" as const, label: "Description" },
    { id: "specs" as const, label: "Specifications", actionId: p.specsActionId },
    { id: "reviews" as const, label: `Reviews (${p.reviews.length})`, actionId: p.reviewsActionId },
  ];

  return (
    <article aria-label={p.title}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ProductArt art={p.art} />
        <div className="min-w-0">
          <h4 className="font-heading text-xl leading-7 font-black break-words">{p.title}</h4>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption">
            <Stars value={p.rating} />
            <span>{p.ratingCount}</span>
          </p>
          <p className="mt-3 font-heading text-3xl font-black" {...anchor(p.priceAnchor)}>
            {p.price}
          </p>
          <p className="mt-1 text-small">{p.condition}</p>
          <ul className="mt-3 flex flex-col gap-1 text-small">
            {p.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 size-4 shrink-0" />
                {h}
              </li>
            ))}
          </ul>
          <KvList
            className="mt-4 rounded-tile bg-mist p-3"
            rows={[
              { label: "Delivery", value: p.shipping, anchor: p.shippingAnchor },
              { label: "Returns", value: p.returns, anchor: p.returnsAnchor },
            ]}
          />
          <div className="mt-4 rounded-tile border-2 border-mist p-3 text-small" {...anchor(seller.anchor)}>
            <p>
              Sold by <span className="font-semibold">{seller.name}</span> · {seller.rating}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <SimButton variant="quiet" icon="user" onClick={() => onSeller(seller.id)}>
                View seller profile
              </SimButton>
              {seller.threadId && (
                <SimButton variant="quiet" icon="chat" onClick={() => onMessage(seller.threadId!)}>
                  Message seller
                </SimButton>
              )}
            </div>
          </div>
          {p.buyable ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <SimButton variant="solid" icon="marketplace" onClick={onBuy} disabled={!interactive}>
                Buy now
              </SimButton>
            </div>
          ) : (
            <p className="mt-4 text-small text-teal/85">This item isn&apos;t available to buy right now.</p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div
          role="tablist"
          aria-label="Product information"
          className="flex flex-wrap gap-1 border-b-2 border-mist"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => {
                record(t.actionId);
                setTab(t.id);
              }}
              className={cn(
                "-mb-0.5 min-h-10 border-b-2 px-3 text-small font-semibold",
                tab === t.id ? "border-teal" : "border-transparent hover:bg-mist",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="pt-4">
          {tab === "description" &&
            (p.description.length > 0 ? (
              p.description.map((d) => (
                <p key={d} className="mt-1 max-w-prose text-small">
                  {d}
                </p>
              ))
            ) : (
              <p className="text-small">{p.highlights.join(" · ")}</p>
            ))}
          {tab === "specs" &&
            (p.specs.length > 0 ? (
              <KvList rows={p.specs} className="max-w-lg" />
            ) : (
              <p className="text-small">No specifications listed.</p>
            ))}
          {tab === "reviews" && (
            <ul className="flex flex-col gap-3" {...anchor(p.reviewsAnchor)}>
              {p.reviews.length === 0 && <li className="text-small">No reviews yet.</li>}
              {p.reviews.map((r) => (
                <li key={r.author + r.date} className="rounded-tile border-2 border-mist p-3">
                  <p className="flex flex-wrap items-center gap-2 text-small">
                    <span className="font-semibold">{r.title}</span>
                    <span aria-label={`${r.rating} out of 5 stars`}>
                      {"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}
                    </span>
                  </p>
                  <p className="mt-1 text-small">{r.text}</p>
                  <p className="mt-1 text-caption text-teal/80">
                    {r.author} · {r.date}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {report && (
        <div className="mt-6 border-t-2 border-mist pt-3">
          <DecisionButton decision={report} variant="quiet" />
        </div>
      )}
    </article>
  );
}

function SellerPage({
  app,
  sellerId,
  onMessage,
  onProduct,
}: {
  app: MarketplaceAppContent;
  sellerId: string;
  onMessage: (threadId: string) => void;
  onProduct: (id: string) => void;
}) {
  const s = app.sellers.find((x) => x.id === sellerId)!;
  const items = app.products.filter((p) => p.sellerId === s.id);
  return (
    <section aria-label={`Seller ${s.name}`} {...anchor(s.anchor)}>
      <h4 className="font-heading text-2xl font-black">{s.name}</h4>
      <p className="mt-1 text-small">{s.since}</p>
      <KvList
        className="mt-4 max-w-xl rounded-tile bg-mist p-3"
        rows={[
          { label: "Rating", value: `${s.rating} · ${s.ratingCount}` },
          { label: "Location", value: s.location },
          { label: "Responses", value: s.responseTime },
          ...s.policies,
        ]}
      />
      {s.about.map((a) => (
        <p key={a} className="mt-3 max-w-prose text-small">
          {a}
        </p>
      ))}
      {s.threadId && (
        <SimButton className="mt-4" icon="chat" onClick={() => onMessage(s.threadId!)}>
          Message seller
        </SimButton>
      )}
      <h5 className="mt-6 font-heading text-lg font-extrabold">Items from this seller</h5>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onProduct(p.id)}
              className="text-left text-small font-semibold underline underline-offset-2"
            >
              {p.title} · {p.price}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Checkout({ app }: { app: MarketplaceAppContent }) {
  const product = app.products.find((p) => p.id === app.checkout.productId)!;
  const decisions = useAvailableDecisions(
    [app.checkout.decisionId, app.checkout.declineDecisionId].filter((x): x is string => !!x),
  );
  const pay = decisions.find((d) => d.id === app.checkout.decisionId);
  const decline = decisions.find((d) => d.id === app.checkout.declineDecisionId);
  return (
    <section aria-label="Checkout" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <h4 className="font-heading text-2xl font-black">Checkout</h4>
        <div className="mt-4 flex gap-3 rounded-tile border-2 border-mist p-3">
          <ProductArt art={product.art} className="w-24 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">{product.title}</p>
            <p className="text-small">Qty 1 · {product.condition}</p>
          </div>
        </div>
        <KvList
          className="mt-4 rounded-tile bg-mist p-3"
          rows={[
            { label: "Ship to", value: app.checkout.shipTo.join(", ") },
            { label: "Delivery", value: app.checkout.delivery },
            { label: "Payment", value: app.checkout.paymentMethodNote },
          ]}
        />
        <p className="mt-3 text-caption">{app.checkout.terms}</p>
      </div>
      <aside
        aria-label="Order summary"
        className="self-start rounded-tile border-2 border-teal/25 p-4"
        {...anchor(app.checkout.anchor)}
      >
        <h5 className="font-heading text-lg font-extrabold">Order summary</h5>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-small">
          <dt>Item</dt>
          <dd className="text-right">{product.price}</dd>
          <dt>Delivery</dt>
          <dd className="text-right">Free</dd>
          <dt className="border-t-2 border-mist pt-1 font-heading font-extrabold">Total</dt>
          <dd className="border-t-2 border-mist pt-1 text-right font-heading font-extrabold">
            {product.price}
          </dd>
        </dl>
        <div className="mt-4 flex flex-col gap-2">
          {pay && <DecisionButton decision={pay} variant="solid" className="w-full" />}
          {decline && <DecisionButton decision={decline} variant="quiet" className="w-full" />}
        </div>
      </aside>
    </section>
  );
}
