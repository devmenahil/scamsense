/**
 * Zod schemas for the CLIENT-SAFE half of a scenario: the immersive environment the player explores (ARCHITECTURE §6).
 * Nothing here may say whether a scenario is legitimate, which decision is right, or which element is evidence
 * (R10). The server-only half (answer key, rubric, evidence, routing metadata) is in `templateSchema.ts` and the
 * `*.server.ts` content files.
 *
 * Content conventions
 *  • Text may contain tokens filled in by the server before anything reaches the browser:
 *      {{amount}}            the scenario amount (slot % of the module's starting Training Funds, R19)
 *      {{amount.<part>}}     a fixed share of that amount (basis points in `amountParts`)
 *      {{amount.minus.<p>}}  the amount minus a part (so invoice lines always add up exactly)
 *      {{playerName}}        the player's first name from the profile
 *      {{<slot>}}            a personalization slot (authored default now; Gemini-personalized in Step 8)
 *  • `anchor` = a stable element ID (rendered as `data-sim-anchor`, no styling difference). Evidence definitions in
 *    the answer key point at anchors; many non-evidence elements carry anchors too, so anchors reveal nothing.
 *  • `requires` = action IDs that must already be recorded before the element appears (controlled branching).
 *  • `actionId` = recorded (once) when the player uses the element. Actions never end the scenario by themselves:
 *    only a decision does (Step 6 brief §2.9).
 *  • Every domain shown is a reserved, non-functional `.example` domain (R29); nothing links outside the simulation.
 */
import { z } from "zod";
import type { IconName } from "@/components/icons/Icon";

export const idSchema = z.string().regex(/^[a-z0-9_]{1,64}$/, "lower_snake_case id");
export const anchorSchema = z.string().regex(/^[a-z0-9_]{1,64}$/, "lower_snake_case anchor");
const text = z.string().min(1).max(2000);
const requires = z.array(idSchema).max(8).optional();

const APP_ICONS = [
  "chat",
  "mail",
  "search",
  "wallet",
  "marketplace",
  "invoice",
  "job",
  "otp",
  "phishing",
] as const satisfies readonly IconName[];
export const appIconSchema = z.enum(APP_ICONS);

export const kvRowSchema = z.object({ label: text, value: text, anchor: anchorSchema.optional() });

/* ------------------------------------------------------------------------------------------------ attachments */
export const invoiceSchema = z.object({
  anchor: anchorSchema,
  issuer: z.object({ name: text, lines: z.array(text), anchor: anchorSchema.optional() }),
  billTo: z.object({ name: text, lines: z.array(text) }),
  number: text,
  numberAnchor: anchorSchema.optional(),
  issueDate: text,
  dueDate: text,
  dueAnchor: anchorSchema.optional(),
  reference: text.optional(),
  items: z
    .array(z.object({ description: text, detail: text.optional(), quantity: text, amount: text }))
    .min(1),
  subtotal: text,
  tax: text,
  total: text,
  totalAnchor: anchorSchema.optional(),
  paymentInstructions: z.object({
    title: text,
    lines: z.array(text).min(1),
    anchor: anchorSchema.optional(),
  }),
  notes: z.array(z.object({ text, anchor: anchorSchema.optional() })),
  /** Decisions offered on the invoice itself (e.g. "Pay invoice"). */
  decisionIds: z.array(idSchema).default([]),
});
export type InvoiceContent = z.infer<typeof invoiceSchema>;

export const attachmentSchema = z.discriminatedUnion("kind", [
  /** A picture the sender shared (rendered as a fictional receipt card, not an image file). */
  z.object({
    kind: z.literal("receipt"),
    anchor: anchorSchema.optional(),
    caption: text,
    title: text,
    rows: z.array(kvRowSchema),
    footer: text.optional(),
  }),
  /** An in-chat payment request card. Paying is a decision bound to the thread's action bar. */
  z.object({
    kind: z.literal("payment_request"),
    anchor: anchorSchema.optional(),
    title: text,
    payee: text,
    amount: text,
    rows: z.array(kvRowSchema),
  }),
  /** A document the player can open (e.g. an invoice PDF), shown in the in-simulation document viewer. */
  z.object({
    kind: z.literal("document"),
    anchor: anchorSchema.optional(),
    name: text,
    size: text,
    actionId: idSchema.optional(),
    invoice: invoiceSchema,
  }),
]);
export type AttachmentContent = z.infer<typeof attachmentSchema>;

/* ------------------------------------------------------------------------------------------------ chat */
export const chatMessageSchema = z.object({
  id: idSchema,
  from: z.enum(["contact", "me", "system"]),
  text: text.optional(),
  time: text.optional(),
  anchor: anchorSchema.optional(),
  attachment: attachmentSchema.optional(),
});
export type ChatMessageContent = z.infer<typeof chatMessageSchema>;

export const chatThreadSchema = z.object({
  id: idSchema,
  requires,
  contact: z.object({
    name: text,
    subtitle: text,
    /** 1–3 letters, or a {{<nameSlot>.initials}} token filled on the server. */
    initials: z.union([z.string().min(1).max(3), z.string().regex(/^\{\{[a-z][A-Za-z0-9]*\.initials\}\}$/)]),
    anchor: anchorSchema,
    detailsActionId: idSchema.optional(),
    details: z.array(kvRowSchema),
  }),
  preview: text,
  time: text,
  unread: z.boolean().default(false),
  messages: z.array(chatMessageSchema).min(1),
  /** Controlled conversation branches (Step 6 brief §3A): a reply chip records its action and reveals messages. */
  branches: z
    .array(
      z.object({ actionId: idSchema, label: text, requires, messages: z.array(chatMessageSchema).min(1) }),
    )
    .default([]),
  /** Decisions offered in the thread's action bar (e.g. "Send the code", "Block and report"). */
  decisionIds: z.array(idSchema).default([]),
});
export type ChatThreadContent = z.infer<typeof chatThreadSchema>;

/* ------------------------------------------------------------------------------------------------ mail */
const opensSchema = z.object({ appId: idSchema, pageId: idSchema.optional() });
export const mailBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text, anchor: anchorSchema.optional() }),
  z.object({
    type: z.literal("link"),
    style: z.enum(["text", "button"]).default("text"),
    text,
    /** The destination the link really points to: shown in the status line on hover/focus, like a mail client. */
    url: text,
    anchor: anchorSchema.optional(),
    actionId: idSchema.optional(),
    opens: opensSchema.optional(),
  }),
  z.object({ type: z.literal("kv"), rows: z.array(kvRowSchema).min(1), anchor: anchorSchema.optional() }),
  z.object({ type: z.literal("small"), text, anchor: anchorSchema.optional() }),
]);
export type MailBlockContent = z.infer<typeof mailBlockSchema>;

export const mailMessageSchema = z.object({
  id: idSchema,
  requires,
  from: z.object({ name: text, address: text }),
  fromAnchor: anchorSchema,
  replyTo: text.optional(),
  to: text,
  subject: text,
  subjectAnchor: anchorSchema.optional(),
  listDate: text,
  fullDate: text,
  preview: text,
  unread: z.boolean().default(false),
  openActionId: idSchema.optional(),
  detailsActionId: idSchema.optional(),
  body: z.array(mailBlockSchema).min(1),
  attachments: z.array(attachmentSchema).default([]),
  /** Decisions in the message toolbar (e.g. "Report message", "Delete"). */
  decisionIds: z.array(idSchema).default([]),
});
export type MailMessageContent = z.infer<typeof mailMessageSchema>;

/* ------------------------------------------------------------------------------------------------ websites */
export const siteBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), title: text, text: text.optional(), anchor: anchorSchema.optional() }),
  z.object({ type: z.literal("notice"), title: text, text, anchor: anchorSchema.optional() }),
  z.object({
    type: z.literal("text"),
    title: text.optional(),
    paras: z.array(text).min(1),
    anchor: anchorSchema.optional(),
  }),
  z.object({
    type: z.literal("list"),
    title: text.optional(),
    anchor: anchorSchema.optional(),
    items: z
      .array(
        z.object({
          title: text,
          text: text.optional(),
          meta: text.optional(),
          anchor: anchorSchema.optional(),
          pageId: idSchema.optional(),
          actionId: idSchema.optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("kv"),
    title: text.optional(),
    rows: z.array(kvRowSchema).min(1),
    anchor: anchorSchema.optional(),
  }),
  z.object({
    type: z.literal("table"),
    title: text.optional(),
    columns: z.array(text).min(2),
    rows: z.array(z.array(text)).min(1),
    anchor: anchorSchema.optional(),
    empty: text.optional(),
  }),
  z.object({
    type: z.literal("actions"),
    items: z
      .array(
        z.object({
          label: text,
          variant: z.enum(["primary", "secondary"]).default("primary"),
          decisionId: idSchema.optional(),
          pageId: idSchema.optional(),
          actionId: idSchema.optional(),
          anchor: anchorSchema.optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("search"),
    query: text,
    results: z
      .array(
        z.object({
          title: text,
          url: text,
          snippet: text,
          pageId: idSchema,
          actionId: idSchema.optional(),
          anchor: anchorSchema.optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("profile"),
    name: text,
    headline: text,
    initials: z.string().min(1).max(3),
    rows: z.array(kvRowSchema),
    anchor: anchorSchema.optional(),
  }),
]);
export type SiteBlockContent = z.infer<typeof siteBlockSchema>;

export const browserPageSchema = z.object({
  id: idSchema,
  requires,
  /** The address shown in the address bar. Always a reserved `.example` domain (R29). */
  url: text,
  title: text,
  site: z.object({ name: text, mark: z.string().min(1).max(3), tagline: text.optional() }),
  addressAnchor: anchorSchema,
  /** Recorded when the player opens the address bar's site information. */
  inspectActionId: idSchema.optional(),
  /** Recorded when the page is shown. */
  visitActionId: idSchema.optional(),
  nav: z.array(z.object({ label: text, pageId: idSchema })).default([]),
  connection: text,
  blocks: z.array(siteBlockSchema).min(1),
});
export type BrowserPageContent = z.infer<typeof browserPageSchema>;

/* ------------------------------------------------------------------------------------------------ marketplace */
export const PRODUCT_ART = [
  "laptop",
  "laptop_slim",
  "laptop_wide",
  "camera",
  "headphones",
  "tablet",
] as const;
export const productSchema = z.object({
  id: idSchema,
  title: text,
  price: text,
  priceAnchor: anchorSchema.optional(),
  art: z.enum(PRODUCT_ART),
  rating: text,
  ratingCount: text,
  condition: text,
  highlights: z.array(text).min(1),
  specs: z.array(kvRowSchema).default([]),
  description: z.array(text).default([]),
  sellerId: idSchema,
  shipping: text,
  shippingAnchor: anchorSchema.optional(),
  returns: text,
  returnsAnchor: anchorSchema.optional(),
  reviews: z
    .array(z.object({ author: text, rating: z.number().int().min(1).max(5), date: text, title: text, text }))
    .default([]),
  reviewsAnchor: anchorSchema.optional(),
  openActionId: idSchema.optional(),
  specsActionId: idSchema.optional(),
  reviewsActionId: idSchema.optional(),
  /** Products without a buy option are browsable only (they exist so the market feels real). */
  buyable: z.boolean().default(false),
  /** Decision behind the listing's "Report listing" control, if any. */
  reportDecisionId: idSchema.optional(),
});
export type ProductContent = z.infer<typeof productSchema>;

export const sellerSchema = z.object({
  id: idSchema,
  name: text,
  anchor: anchorSchema,
  since: text,
  rating: text,
  ratingCount: text,
  location: text,
  responseTime: text,
  about: z.array(text).min(1),
  policies: z.array(kvRowSchema).default([]),
  profileActionId: idSchema.optional(),
  threadId: idSchema.optional(),
});

export const marketplaceAppSchema = z.object({
  type: z.literal("marketplace"),
  id: idSchema,
  label: text,
  icon: appIconSchema,
  siteName: text,
  domain: text,
  addressAnchor: anchorSchema,
  inspectActionId: idSchema.optional(),
  connection: text,
  tagline: text,
  categories: z.array(text).min(1),
  searchQuery: text,
  products: z.array(productSchema).min(1),
  sellers: z.array(sellerSchema).min(1),
  threads: z.array(chatThreadSchema).default([]),
  checkout: z.object({
    productId: idSchema,
    decisionId: idSchema,
    /** Decision behind the checkout's "Remove from cart" control, if any. */
    declineDecisionId: idSchema.optional(),
    shipTo: z.array(text).min(1),
    delivery: text,
    paymentMethodNote: text,
    anchor: anchorSchema.optional(),
    terms: text,
    viewActionId: idSchema.optional(),
  }),
});

export const sellerHubAppSchema = z.object({
  type: z.literal("seller_hub"),
  id: idSchema,
  label: text,
  icon: appIconSchema,
  siteName: text,
  domain: text,
  addressAnchor: anchorSchema,
  inspectActionId: idSchema.optional(),
  connection: text,
  sellerName: text,
  overview: z.array(kvRowSchema).min(1),
  listings: z
    .array(
      z.object({
        id: idSchema,
        title: text,
        price: text,
        art: z.enum(PRODUCT_ART),
        status: text,
        views: text,
        anchor: anchorSchema.optional(),
      }),
    )
    .min(1),
  orders: z
    .array(
      z.object({
        id: idSchema,
        number: text,
        buyer: text,
        item: text,
        art: z.enum(PRODUCT_ART),
        total: text,
        placed: text,
        status: text,
        statusAnchor: anchorSchema.optional(),
        paymentNote: text,
        shipTo: z.array(text).min(1),
        shipToAnchor: anchorSchema.optional(),
        timeline: z.array(z.object({ label: text, date: text })).min(1),
        viewActionId: idSchema.optional(),
        decisionIds: z.array(idSchema).default([]),
      }),
    )
    .min(1),
  threads: z.array(chatThreadSchema).min(1),
});

/* ------------------------------------------------------------------------------------------------ apps */
export const appSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("messages"),
    id: idSchema,
    label: text,
    icon: appIconSchema,
    threads: z.array(chatThreadSchema).min(1),
  }),
  z.object({
    type: z.literal("mail"),
    id: idSchema,
    label: text,
    icon: appIconSchema,
    accountAddress: text,
    messages: z.array(mailMessageSchema).min(1),
  }),
  z.object({
    type: z.literal("browser"),
    id: idSchema,
    label: text,
    icon: appIconSchema,
    homePageId: idSchema,
    bookmarks: z
      .array(z.object({ label: text, pageId: idSchema, actionId: idSchema.optional() }))
      .default([]),
    pages: z.array(browserPageSchema).min(1),
  }),
  /** A fictional payment-account app (TandemPay). Never a PayPal look-alike (R34). */
  z.object({
    type: z.literal("wallet"),
    id: idSchema,
    label: text,
    icon: appIconSchema,
    brand: text,
    owner: text,
    tabs: z
      .array(
        z.object({
          id: idSchema,
          label: text,
          actionId: idSchema.optional(),
          blocks: z.array(siteBlockSchema).min(1),
        }),
      )
      .min(1),
  }),
  marketplaceAppSchema,
  sellerHubAppSchema,
]);
export type AppContent = z.infer<typeof appSchema>;
export type MarketplaceAppContent = z.infer<typeof marketplaceAppSchema>;
export type SellerHubAppContent = z.infer<typeof sellerHubAppSchema>;

/* ------------------------------------------------------------------------------------------------ render */
/** The four reusable environments (Step 6 brief §3). */
export const INTERFACE_TYPES = ["chat_email", "web_browser", "invoice", "marketplace"] as const;
export type InterfaceType = (typeof INTERFACE_TYPES)[number];

/**
 * What a decision means for the explanation prompt (Step 6 brief §8). Neutral: an intent describes the player's
 * action, never whether it is right.
 */
export const DECISION_INTENTS = [
  "pay",
  "report",
  "decline",
  "share_code",
  "continue_on_site",
  "ship",
  "hold",
] as const;
export type DecisionIntent = (typeof DECISION_INTENTS)[number];

export const decisionSchema = z.object({
  id: idSchema,
  kind: z.enum(["pay", "other"]),
  intent: z.enum(DECISION_INTENTS),
  /** The environment-native control's label ("Pay invoice", "Ship item"). */
  label: text,
  /** How the decision reads in the confirmation and explanation steps ("Pay the invoice in full"). */
  summary: text,
  /** Overrides the default explanation prompt for the intent. */
  explanationPrompt: text.optional(),
  requires,
});
export type DecisionContent = z.infer<typeof decisionSchema>;

export const actionSchema = z.object({
  id: idSchema,
  /** investigate = inspecting or independently verifying; interact = anything else (replying, opening). */
  kind: z.enum(["investigate", "interact"]),
  /** A short neutral description, used in the attempt log and (after completion) in feedback. */
  label: text,
  requires,
});
export type ActionContent = z.infer<typeof actionSchema>;

/**
 * A personalization slot (Step 8): a narrative-only phrase Gemini may rewrite for the player. Slots never carry
 * evidence, amounts, or domains of evidence-bearing sites; Gemini values are validated per kind
 * (src/lib/personalization/validate.ts) and fall back to the authored default.
 *   text         a short phrase or sentence (no digits, currency, links, or judgment words)
 *   name         a fictional person or business name; also provides {{<slot>.initials}}
 *   domainLabel  the first label of a fictional ".example" domain (lower-case letters, digits, hyphens)
 */
export const SLOT_KINDS = ["text", "name", "domainLabel"] as const;
export const slotSchema = z.object({
  name: z.string().regex(/^[a-z][A-Za-z0-9]{1,31}$/),
  kind: z.enum(SLOT_KINDS).default("text"),
  default: z.string().min(1).max(160),
  maxLength: z.number().int().min(1).max(160),
  purpose: text,
});
export type SlotContent = z.infer<typeof slotSchema>;

export const scenarioRenderSchema = z.object({
  scenarioKey: z.enum(["m1-s1", "m1-s2", "m2-s1", "m2-s2", "m3-s1", "m3-s2"]),
  contentVersion: z.string().min(1).max(64),
  interfaceType: z.enum(INTERFACE_TYPES),
  /** Neutral, one-line introduction (R9). */
  introLine: z.string().min(10).max(120),
  apps: z.array(appSchema).min(1).max(5),
  startAppId: idSchema,
  actions: z.array(actionSchema).min(1),
  decisions: z.array(decisionSchema).min(2),
  slots: z.array(slotSchema).default([]),
  /** Shares of the scenario amount, in basis points of it (can exceed 100%, e.g. other products' prices). */
  amountParts: z
    .record(z.string().regex(/^[a-z][a-zA-Z0-9]{1,31}$/), z.number().int().min(1).max(200_000))
    .default({}),
  /** How the fictional payee appears in the checkout step (pay decisions only). */
  checkout: z.object({ payee: text, description: text }).optional(),
});
export type ScenarioRender = z.infer<typeof scenarioRenderSchema>;
export type ScenarioRenderInput = z.input<typeof scenarioRenderSchema>;
