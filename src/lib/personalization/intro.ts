/**
 * Gemini-personalized neutral introductions (Step 8, owner decision 13: restored). Pure.
 *
 * Each scenario has AUTHORITATIVE intro facts (channel, roles, situation) that are sent to Gemini and a matching set of
 * deterministic checks. A generated intro is shown only if it is one short neutral sentence that
 *   • names the scenario's real channel/situation (e.g. a marketplace stays an ONLINE marketplace),
 *   • mentions nothing that contradicts it (no "local seller", no email in a text-message scenario, …),
 *   • contains no judgment, hint, urgency, instruction, credential, or evidence vocabulary (never reveals the answer),
 *   • introduces no names or brands that aren't already in the scenario or its personalized details,
 *   • has no digits, money, links, or real brands.
 * Otherwise the authored intro is used. The facts describe the setting only; they never say what is true (R9, R10).
 */
import { JUDGMENT_PATTERNS, REAL_BRANDS } from "@/content/scenarios/neutrality";
import type { ScenarioRender } from "@/content/scenarios/schema";

export const INTRO_MIN = 15;
export const INTRO_MAX = 120;

type Key = ScenarioRender["scenarioKey"];

export interface IntroRule {
  /** Authoritative setting for the prompt. Neutral: channel and roles only. */
  facts: string;
  /** Which profile details fit this scenario's intro (keeps background from blurring into evidence). */
  personalize: string;
  /** Every pattern must match (the real channel / situation is named). */
  mustMention: readonly RegExp[];
  /** Anything that would misdescribe the setting. */
  mustNotMention: RegExp;
}

export const INTRO_RULES: Record<Key, IntroRule> = {
  "m1-s1": {
    personalize:
      "Use the player's everyday life (studies, work, clients, or their savings goal) as the moment the text arrives.",
    facts:
      "A TEXT MESSAGE (chat) arrives on the player's phone, in their Messages app, from a sender named TandemPay Support, about the player's TandemPay payment account. It is a text/chat conversation: not an email, not a phone call, not a bank letter.",
    mustMention: [/\b(messages?|texts?|chat|sms)\b/i, /\b(payments?|account|app|tandempay|wallet)\b/i],
    mustNotMention:
      /\b(e-?mails?|inbox|phone call|calls? you|voicemail|letter|marketplace|invoices?|seller|buyer|jobs?|bank)\b/i,
  },
  "m1-s2": {
    personalize:
      "Use the player's everyday life (studies, work, clients, or their savings goal) as the moment the email arrives.",
    facts:
      "An EMAIL notification arrives in the player's inbox from a sender named Space Bank, about the player's online banking access. It is an email: not a text message, chat, or call.",
    mustMention: [/\b(e-?mails?|inbox|notifications?)\b/i, /\b(account|bank|banking)\b/i],
    mustNotMention:
      /\b(texts?|text message|sms|chat|phone call|voicemail|marketplace|invoices?|seller|buyer|jobs?|laptop)\b/i,
  },
  "m2-s1": {
    personalize:
      "Use what the player keeps in cloud storage or their work/studies; don't mention shopping or job hunting.",
    facts:
      "An EMAIL with an attached INVOICE arrives in the player's inbox from Brightline Cloud, the online cloud-storage service the player uses. It is an invoice/bill by email: not a marketplace purchase, chat, call, or paper letter.",
    mustMention: [/\binvoices?\b/i],
    mustNotMention:
      /\b(marketplace|seller|buyer|chat|text message|sms|phone call|jobs?|laptop|in person|paper|post(ed)? to)\b/i,
  },
  "m2-s2": {
    personalize:
      "Use what the player needs the laptop for, or their savings goal if it is about a laptop or their work.",
    facts:
      "The player is SHOPPING ONLINE on Circuitry Market, an online marketplace WEBSITE where independent sellers list electronics, looking at a LAPTOP listing that fits their budget. It is online: never local, nearby, in person, a private sale, or a classified ad.",
    mustMention: [
      /\blaptops?\b/i,
      /\b(online|marketplace|website|site|store|shop(ping)?|listings?|listed)\b/i,
    ],
    mustNotMention:
      /\b(local|nearby|in[- ]person|neighbou?rs?|garage|yard sale|flea|private seller|classifieds?|meet( up)?|pick ?up|e-?mails?|inbox|invoices?|jobs?|text message|you(?:'re| are) selling)\b/i,
  },
  "m3-s1": {
    personalize:
      "Use the player's occupation, skills, studies, or job search only; never shopping, devices, laptops, or purchases.",
    facts:
      "A RECRUITMENT update: a recruiter from the staffing agency Talentbridge emails the player about a remote JOB OFFER at Meridian Logistics after a job application; the conversation later continues in a chat app. It is about a job opportunity: not a purchase, sale, invoice, or bank.",
    mustMention: [/\b(jobs?|role|position|offer|opportunit\w*|recruit\w*|applications?|hiring|career)\b/i],
    mustNotMention: /\b(marketplace|invoices?|seller|buyer|laptop|bank|purchases?|shopping)\b/i,
  },
  "m3-s2": {
    personalize:
      "Use the item the player is selling, or why they sell (decluttering, their goal); never what they are buying.",
    facts:
      "The player is the SELLER on Tradepost, an online resale marketplace. A BUYER sends them a message in the marketplace's messages about an item the player LISTED FOR SALE. The player is selling, not buying.",
    // "buyer" already makes the player the seller; "you bought / buying" is excluded below.
    mustMention: [/\bbuyers?\b/i],
    mustNotMention:
      /\b(you bought|you(?:'re| are) buying|purchased|invoices?|jobs?|bank|e-?mails?|inbox|phone call|text message|seller (contacted|messaged))\b/i,
  },
};

/** Never reveal the answer, judge, hint, hurry, or instruct (R9, R10). */
const SPOILERS: readonly RegExp[] = [
  ...JUDGMENT_PATTERNS,
  /\b(urgen\w*|immediate\w*|act now|quick(ly)?|hurry|asap|deadline|expires?)\b/i,
  /\b(verif\w*|secur\w*|trust\w*|safe\w*|real|authentic\w*|risk\w*|danger\w*|careful|beware|alert|odd|strange|unusual|unexpected|claim\w*|supposed\w*|apparent\w*|too good|bargain|deal)\b/i,
  /\b(should|must|make sure|be sure|remember|don'?t|do not|never|always|check|confirm|report|block|ignore|avoid|decide|pause|stop|careful)\b/i,
  /\b(codes?|password|passcode|pin|otp|log ?in|sign[- ]?in|credentials?)\b/i,
  /\b(deposit|fee|refund|equipment|payment request|forward\w*|freight|courier|ship\w*|tracking|lookalike|misspell\w*|domain|address|link)\b/i,
];

const DIGIT_OR_MONEY = /[\p{Nd}$€£¥₹₩₽¢%]/u;
const LINKISH = /https?:|www\.|\.[a-z]{2,}\b|@|[{}<>[\]]/i;

/** Every word that may appear capitalized in an intro: words from the scenario's own text and personalized details. */
export function knownProperWords(render: ScenarioRender, slots: Record<string, string>): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => {
    for (const w of s.match(/\p{Lu}[\p{L}'-]*/gu) ?? []) out.add(w.replace(/'s$/, ""));
  };
  const visit = (v: unknown) => {
    if (typeof v === "string") add(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(render);
  Object.values(slots).forEach(add);
  return out;
}

export type IntroRejection =
  | "shape"
  | "digits_or_links"
  | "real_brand"
  | "spoiler"
  | "missing_setting"
  | "wrong_setting"
  | "unknown_name";

/** The validated intro, or the reason it was rejected (the caller then uses the authored intro). */
export function checkIntroLine(
  render: ScenarioRender,
  raw: unknown,
  slots: Record<string, string>,
): { ok: true; value: string } | { ok: false; reason: IntroRejection } {
  if (typeof raw !== "string") return { ok: false, reason: "shape" };
  const v = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (v.length < INTRO_MIN || v.length > INTRO_MAX || /[\r\n]/.test(raw))
    return { ok: false, reason: "shape" };
  // One neutral sentence, addressed to the player, like the authored intros.
  if (
    !/^(You|Your|A|An)\b/.test(v) ||
    !/\.$/.test(v) ||
    /[!?;:…]/.test(v) ||
    (v.match(/\./g) ?? []).length > 1
  )
    return { ok: false, reason: "shape" };
  if (DIGIT_OR_MONEY.test(v) || LINKISH.test(v)) return { ok: false, reason: "digits_or_links" };
  if (REAL_BRANDS.test(v)) return { ok: false, reason: "real_brand" };
  if (SPOILERS.some((re) => re.test(v))) return { ok: false, reason: "spoiler" };
  const rule = INTRO_RULES[render.scenarioKey];
  if (rule.mustNotMention.test(v)) return { ok: false, reason: "wrong_setting" };
  if (!rule.mustMention.every((re) => re.test(v))) return { ok: false, reason: "missing_setting" };
  const known = knownProperWords(render, slots);
  const words = v.split(" ").slice(1);
  for (const w of words) {
    const proper = w.match(/^\p{Lu}[\p{L}'-]*/u)?.[0]?.replace(/'s$/, "");
    if (proper && !known.has(proper)) return { ok: false, reason: "unknown_name" };
  }
  return { ok: true, value: v };
}
