/**
 * Shared neutrality rules for anything a player sees DURING a scenario (R10). Used by the content tests and, at
 * runtime, by the Gemini personalization validator (src/lib/personalization/validate.ts). Nothing here is secret.
 */

/** Words that would judge or hint during play (ARCHITECTURE §6). Checked against everything the player sees. */
export const JUDGMENT_PATTERNS: readonly RegExp[] = [
  /\bscam/i,
  /suspicious/i,
  /red flag/i,
  /\bfake\b/i,
  /fraud/i,
  /phishing/i,
  /\bwarning/i,
  /\bhint\b/i,
  /legit/i,
  /look-?alike/i,
  /spoof/i,
  /unfamiliar/i,
  /be careful/i,
  /genuine/i,
  /official/i,
];

/**
 * Extra rules for GENERATED narrative (stricter than authored content, which is reviewed by people): no security,
 * credential, urgency, money-protection, or trust vocabulary, so a personalized phrase can never add, remove, or
 * contradict evidence or nudge a decision.
 */
export const GENERATED_TEXT_DENY: readonly RegExp[] = [
  ...JUDGMENT_PATTERNS,
  /\burgen/i,
  /\bimmediate/i,
  /\bact now\b/i,
  /\bverif/i,
  /\bsecur/i,
  /\bpass(word|code)/i,
  /\bpin\b/i,
  /\botp\b/i,
  /\bone[- ]time\b/i,
  /\bcode\b/i,
  /\blog ?in\b/i,
  /\bsign[- ]?in\b/i,
  /\bcredential/i,
  /\bcard number/i,
  /\bcvv\b/i,
  /\baccount number/i,
  /\bbank details/i,
  /\brefund/i,
  /\bprotect/i,
  /\bguarant/i,
  /\btrust/i,
  /\bsafe(ly|ty)?\b/i,
  /\bauthentic/i,
  /\breal\b/i,
  /\bdeposit/i,
  /\binvoice/i,
  /\bpay(ment|pal)?\b/i,
  /\bwire\b/i,
  /\bgift card/i,
  /\bcrypto/i,
];

/** Real payment brands and large real companies must never appear in generated story text (R29, R34). */
export const REAL_BRANDS =
  /paypal|venmo|zelle|cash ?app|apple ?pay|google ?pay|stripe|wise\b|revolut|western union|moneygram|visa\b|mastercard|amex|american express|chase|wells fargo|bank of america|citi(bank)?\b|hsbc|barclays|amazon|ebay|etsy|walmart|target\b|apple\b|google\b|microsoft|facebook|instagram|tiktok|whatsapp|telegram|linkedin|fiverr|upwork|indeed|shopify|gmail|outlook|yahoo/i;

export function containsJudgment(text: string): boolean {
  return JUDGMENT_PATTERNS.some((re) => re.test(text));
}
