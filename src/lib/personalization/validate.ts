/**
 * Validation of Gemini scenario personalization (Step 8 brief §9–§10). Pure.
 *
 * Gemini may only fill the scenario's declared narrative slots and the neutral intro line. Everything that
 * carries evidence, truth, decisions, actions, anchors, amounts, currency, payment, and the domains of evidence-bearing
 * sites stays authored, so the semantic guarantees hold BY CONSTRUCTION; this module checks each generated value:
 *   • only declared slots, each within its length; unknown keys are dropped;
 *   • no digits or currency symbols (amounts can only come from server tokens, so displayed amounts always match the
 *     backend payment configuration), no links, emails, or markup;
 *   • no judgment, hint, credential, urgency, or payment vocabulary (GENERATED_TEXT_DENY) and no real brands;
 *   • names look like names; domain labels are fictional `.example` labels that don't imitate any domain or
 *     organization already in the scenario (a required look-alike stays the only look-alike);
 * The neutral one-line introduction (R9) is personalized too, but only accepted when it passes the scenario-specific
 * accuracy and neutrality checks in ./intro.ts (owner decision 13); otherwise the authored intro is used.
 * A rejected value falls back to its authored default. If nothing valid remains, the whole instance is a fallback.
 */
import { GENERATED_TEXT_DENY, REAL_BRANDS } from "@/content/scenarios/neutrality";
import type { ScenarioRender, SlotContent } from "@/content/scenarios/schema";
import { checkIntroLine, type IntroRejection } from "./intro";

export interface ValidatedPersonalization {
  slots: Record<string, string>;
  /** Validated personalized intro, or null → the authored intro is shown. */
  introLine: string | null;
  /** Why a generated intro was rejected (monitoring only). */
  introRejection: IntroRejection | null;
  /** Slot names (and "introLine") whose generated value was rejected and replaced by the authored default. */
  rejected: string[];
}

const LINKISH = /https?:|www\.|\.[a-z]{2,}(\/|\b)|@|\{|\}|<|>|\[|\]/i;
const DIGIT_OR_MONEY = /[\p{Nd}$€£¥₹₩₽¢%]/u;
const NAME = /^\p{L}[\p{L}\p{M} .'&-]{0,38}[\p{L}.]$/u;
const DOMAIN_LABEL = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** First labels of every `.example` host/address in the authored render (e.g. "spasebank", "brightlinecloud"). */
export function authoredDomainLabels(render: ScenarioRender): string[] {
  const out = new Set<string>();
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(/([a-z0-9-]+)\.example\b/gi)) {
        if (!m[1]!.includes("{{")) out.add(squash(m[1]!));
      }
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  // Slot defaults are personalization, not authored scenario domains.
  const { slots, ...rest } = render;
  void slots;
  visit(rest);
  return [...out].filter((l) => l.length >= 4);
}

function cleanText(v: string): string {
  return v.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Returns the cleaned value, or null when it must not be shown. */
export function validateSlotValue(
  slot: SlotContent,
  raw: unknown,
  protectedLabels: readonly string[],
): string | null {
  if (typeof raw !== "string") return null;
  const v = cleanText(raw);
  if (v.length < 2 || v.length > slot.maxLength) return null;
  if (/[\r\n\t]/.test(raw)) return null;
  if (REAL_BRANDS.test(v)) return null;
  const sq = squash(v);
  if (protectedLabels.some((l) => sq.includes(l) || (sq.length >= 5 && l.includes(sq)))) return null;

  if (slot.kind === "domainLabel") {
    if (!DOMAIN_LABEL.test(v) || v.includes("--")) return null;
    if (GENERATED_TEXT_DENY.some((re) => re.test(v.replace(/-/g, " ")))) return null;
    return v;
  }
  if (DIGIT_OR_MONEY.test(v) || LINKISH.test(v)) return null;
  if (GENERATED_TEXT_DENY.some((re) => re.test(v))) return null;
  if (slot.kind === "name" && !NAME.test(v)) return null;
  return v;
}

/** Validates Gemini's `{ slots }` against the render's declared slots. Never throws on bad values. */
export function validatePersonalization(
  render: ScenarioRender,
  output: { slots?: unknown; introLine?: unknown },
): ValidatedPersonalization {
  const protectedLabels = authoredDomainLabels(render);
  const given =
    output.slots && typeof output.slots === "object" ? (output.slots as Record<string, unknown>) : {};
  const slots: Record<string, string> = {};
  const rejected: string[] = [];
  for (const slot of render.slots) {
    const v = validateSlotValue(slot, given[slot.name], protectedLabels);
    if (v === null) rejected.push(slot.name);
    else slots[slot.name] = v;
  }
  // Two name slots with the same value would read as one person/organization: keep the first.
  const seen = new Set<string>();
  for (const slot of render.slots) {
    if (slot.kind !== "name" || !slots[slot.name]) continue;
    const k = squash(slots[slot.name]!);
    if (seen.has(k)) {
      delete slots[slot.name];
      rejected.push(slot.name);
    }
    seen.add(k);
  }
  // The intro is checked against the scenario's authoritative setting and the validated personalized details.
  let introLine: string | null = null;
  let introRejection: IntroRejection | null = null;
  if (output.introLine != null) {
    const intro = checkIntroLine(render, output.introLine, slots);
    if (intro.ok) introLine = intro.value;
    else {
      introRejection = intro.reason;
      rejected.push("introLine");
    }
  }
  return { slots, introLine, introRejection, rejected };
}
