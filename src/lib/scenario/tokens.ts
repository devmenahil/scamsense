/**
 * Fills a scenario render's text tokens on the server (src/content/scenarios/schema.ts lists the token syntax).
 * Pure and deterministic. Money is computed in integer minor units (R38) and only formatted at the end; the amount
 * comes from the module run's starting funds × the slot percentage (R19), never from a client or from Gemini (R32).
 */
import { formatMoney } from "@/lib/domain/currency";
import { MoneyError } from "@/lib/domain/money";
import type { ScenarioRender } from "@/content/scenarios/schema";

export const TOKEN_PATTERN = /\{\{([A-Za-z0-9.]+)\}\}/g;

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

/** amount × bp / 10 000, half-up, integer only. Allows shares above 100% (e.g. other products' prices). */
export function shareOfMinor(amountMinor: number, basisPoints: number): number {
  const product = amountMinor * basisPoints;
  if (!Number.isSafeInteger(product)) throw new MoneyError("amount share out of range");
  return Math.floor((product + 5_000) / 10_000);
}

/** A display name reduced to a safe first name for in-story greetings (max 30 characters). */
export function firstNameFrom(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const cleaned = first.replace(/[{}<>]/g, "").slice(0, 30);
  return cleaned.length > 0 ? cleaned : "there";
}

export interface TokenContext {
  amountMinor: number;
  currency: string;
  playerName: string;
  /** Personalization slot values (authored defaults in Step 6). */
  slots: Record<string, string>;
}

export function buildTokenValues(render: ScenarioRender, ctx: TokenContext): Record<string, string> {
  const money = (minor: number) => formatMoney(minor, ctx.currency);
  const values: Record<string, string> = { amount: money(ctx.amountMinor), playerName: ctx.playerName };
  for (const [part, bp] of Object.entries(render.amountParts)) {
    const partMinor = shareOfMinor(ctx.amountMinor, bp);
    values[`amount.${part}`] = money(partMinor);
    if (bp < 10_000) values[`amount.minus.${part}`] = money(ctx.amountMinor - partMinor);
  }
  for (const slot of render.slots) {
    const raw = ctx.slots[slot.name] ?? slot.default;
    const v = raw.slice(0, slot.maxLength).replace(/[{}<>]/g, "");
    values[slot.name] = v.length > 0 ? v : slot.default;
    if (slot.kind === "name") values[`${slot.name}.initials`] = initialsOf(values[slot.name]!);
  }
  return values;
}

/** Up to two upper-case initials of a name ("Aria Studio" → "AS"). */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((w) => w.match(/\p{L}/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters.length > 0 ? letters : "?";
}

export function fillTokens(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN_PATTERN, (_m, name: string) => {
    const v = values[name];
    if (v === undefined) throw new TokenError(`Unknown token {{${name}}}`);
    return v;
  });
}

/** Deep copy of `value` with every string's tokens filled. */
export function fillDeep<T>(value: T, values: Record<string, string>): T {
  if (typeof value === "string") return fillTokens(value, values) as T;
  if (Array.isArray(value)) return value.map((v) => fillDeep(v, values)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillDeep(v, values)])) as T;
  }
  return value;
}

/** Every token name used anywhere in a value (for content tests). */
export function collectTokens(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") for (const m of value.matchAll(TOKEN_PATTERN)) out.add(m[1]!);
  else if (Array.isArray(value)) for (const v of value) collectTokens(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectTokens(v, out);
  return out;
}
