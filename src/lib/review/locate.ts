/**
 * Reveal the Red Flags (Step 9): finds WHERE a stable anchor (`data-sim-anchor`) lives inside a scenario render, so the
 * read-only review can open the right app, conversation, email, page, tab, or order before highlighting it. Pure.
 *
 * Highlighting always uses the authored anchors (never text search). `requires` lists the actions that gate the
 * content (a reply chosen, a link followed), so the review can say when the learner never opened that part.
 */
import type { AppContent, ScenarioRender } from "@/content/scenarios/schema";

export type RevealTarget =
  | { kind: "app" }
  | { kind: "thread"; threadId: string; details?: boolean }
  | { kind: "mail"; messageId: string; documentIndex?: number }
  | { kind: "page"; pageId: string }
  | { kind: "wallet_tab"; tabId: string }
  | {
      kind: "market";
      page: "home" | "product" | "seller" | "chat" | "checkout";
      id?: string;
      productTab?: "specs" | "reviews";
      threadId?: string;
      details?: boolean;
    }
  | {
      kind: "hub";
      tab: "overview" | "listings" | "orders" | "messages";
      orderId?: string;
      threadId?: string;
      details?: boolean;
    };

export interface AnchorLocation {
  appId: string;
  target: RevealTarget;
  /** Actions that must have been recorded for this content to appear during play. */
  requires: string[];
}

/** Every anchor value under `node` (keys `anchor` or `…Anchor`), in document order. */
export function collectAnchors(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) collectAnchors(n, out);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if ((k === "anchor" || k.endsWith("Anchor")) && typeof v === "string") out.push(v);
      else collectAnchors(v, out);
    }
  }
  return out;
}

function threadEntries(
  thread: {
    id: string;
    requires?: string[];
    contact: { details: unknown };
    messages: unknown;
    branches: { actionId: string; requires?: string[]; messages: unknown }[];
  },
  make: (details: boolean) => RevealTarget,
  add: (anchors: string[], target: RevealTarget, requires: string[]) => void,
) {
  const base = thread.requires ?? [];
  // Most specific first: contact details (a toggled panel), then branch messages, then the rest of the thread.
  add(collectAnchors(thread.contact.details), make(true), base);
  for (const b of thread.branches)
    add(collectAnchors(b.messages), make(false), [...base, ...(b.requires ?? []), b.actionId]);
  add(collectAnchors({ ...thread, branches: [] }), make(false), base);
}

function locateInApp(app: AppContent, add: (a: string[], t: RevealTarget, r: string[]) => void) {
  switch (app.type) {
    case "messages":
      for (const t of app.threads)
        threadEntries(
          t,
          (details) => ({ kind: "thread", threadId: t.id, details: details || undefined }),
          add,
        );
      return;
    case "mail":
      for (const m of app.messages) {
        const req = m.requires ?? [];
        m.attachments.forEach((a, i) => {
          if (a.kind === "document")
            add(collectAnchors(a.invoice), { kind: "mail", messageId: m.id, documentIndex: i }, req);
        });
        add(collectAnchors(m), { kind: "mail", messageId: m.id }, req);
      }
      return;
    case "browser":
      for (const p of app.pages) add(collectAnchors(p), { kind: "page", pageId: p.id }, p.requires ?? []);
      return;
    case "wallet":
      for (const t of app.tabs) add(collectAnchors(t), { kind: "wallet_tab", tabId: t.id }, []);
      return;
    case "marketplace": {
      add([app.addressAnchor], { kind: "market", page: "home" }, []);
      for (const s of app.sellers) add(collectAnchors(s), { kind: "market", page: "seller", id: s.id }, []);
      for (const p of app.products) {
        add(collectAnchors(p.specs), { kind: "market", page: "product", id: p.id, productTab: "specs" }, []);
        add(
          p.reviewsAnchor ? [p.reviewsAnchor] : [],
          { kind: "market", page: "product", id: p.id, productTab: "reviews" },
          [],
        );
        add(collectAnchors(p), { kind: "market", page: "product", id: p.id }, []);
      }
      for (const t of app.threads)
        threadEntries(
          t,
          (details) => ({ kind: "market", page: "chat", threadId: t.id, details: details || undefined }),
          add,
        );
      add(collectAnchors(app.checkout), { kind: "market", page: "checkout" }, []);
      return;
    }
    case "seller_hub": {
      add([app.addressAnchor], { kind: "hub", tab: "overview" }, []);
      add(collectAnchors(app.overview), { kind: "hub", tab: "overview" }, []);
      add(collectAnchors(app.listings), { kind: "hub", tab: "listings" }, []);
      for (const o of app.orders) add(collectAnchors(o), { kind: "hub", tab: "orders", orderId: o.id }, []);
      for (const t of app.threads)
        threadEntries(
          t,
          (details) => ({ kind: "hub", tab: "messages", threadId: t.id, details: details || undefined }),
          add,
        );
      return;
    }
  }
}

/** Location of every anchor in the render. When an anchor appears twice, its first (most specific) place wins. */
export function locateAnchors(render: ScenarioRender): Map<string, AnchorLocation> {
  const map = new Map<string, AnchorLocation>();
  for (const app of render.apps) {
    locateInApp(app, (anchors, target, requires) => {
      for (const a of anchors)
        if (!map.has(a)) map.set(a, { appId: app.id, target, requires: [...new Set(requires)] });
    });
  }
  return map;
}

/**
 * The order in which actions count as "recorded" in the review: the learner's own actions first (so their path
 * reads as they experienced it), then every other action, so all evidence-bearing content can be inspected.
 */
export function reviewRecordedActions(render: ScenarioRender, learnerActions: readonly string[]): string[] {
  const all = new Set<string>(learnerActions);
  for (const a of render.actions) all.add(a.id);
  // Branch and page triggers that are not declared as actions are still content gates.
  const walk = (n: unknown) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === "object")
      for (const [k, v] of Object.entries(n)) {
        if (k === "requires" && Array.isArray(v)) v.forEach((x) => typeof x === "string" && all.add(x));
        else walk(v);
      }
  };
  walk(render.apps);
  return [...all];
}
