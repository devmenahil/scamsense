/**
 * Sensei Kenshi — policy retrieval (Step 10). Pure and deterministic: it picks a FEW records from the Step 9 policy
 * knowledge base (src/content/playbook/policies.ts, the only source of PayPal policy facts) for one question. There
 * is no second policy database and no AI involved in the choice.
 *
 *   • A question that isn't about PayPal, protection, reporting, or recovery gets no policy records at all.
 *   • Otherwise: records whose topic matches the question, then (when discussing a completed scenario) that
 *     scenario's deterministic Playbook mapping, capped at MAX_POLICIES.
 *   • Verified records carry all their verified items (facts, eligibility, procedures, exclusions); an unverified one
 *     would carry only its title and official link, so Kenshi could point to it but never state its rules. (Since the
 *     2026-11-10 re-verification every record is verified.)
 */
import {
  POLICY_RECORDS,
  policyItems,
  type PolicyRecord,
  type PolicyTopic,
} from "@/content/playbook/policies";

export const MAX_POLICIES = 4;

/** Does the question touch PayPal, protection, reporting, or recovery at all? */
const POLICY_INTENT =
  /pay\s?pal|protect|refund|reimburs|dispute|claim|chargeback|resolution cent|report|recover|money back|unauthori[sz]ed|hack|stolen|compromis|already (sent|paid)|sent the money|got scammed|phishing@|deadline|time ?frame|eligib|cover(ed|age)?\b/i;

const TOPIC_PATTERNS: Record<PolicyTopic, RegExp> = {
  account_security_phishing:
    /phish|suspicious (e-?mail|message|text|link|sms)|fake (e-?mail|message|text)|report (an? |the |this )?(e-?mail|message|text)|scam (e-?mail|message|text)|one[- ]time code|verification code|password|log ?in|sign ?in|account (security|safe)/i,
  unauthorized_transactions:
    /unauthori[sz]ed|didn'?t (make|authori[sz]e)|did not (make|authori[sz]e)|hack|stolen|compromis|someone (else )?(used|got into|logged)|account takeover|change (my )?password|already (sent|paid)|sent the money|got scammed|report (a |the )?(fraud|scam|payment|transaction)/i,
  purchase_protection:
    /purchase protection|buyer protection|item (not|never) (received|arrived)|not as described|significantly not|didn'?t (receive|arrive)|never (received|arrived)|bought|buying|refund|money back/i,
  seller_protection: /seller protection|as a seller|selling|i sold|buyer (claims?|says)|shipped|chargeback/i,
  disputes_resolution_center:
    /dispute|claim|resolution cent|chargeback|deadline|time ?frame|how long|days to/i,
};

export interface RetrievedPolicy {
  policyId: string;
  topic: PolicyTopic;
  title: string;
  url: string;
  verified: boolean;
  lastVerified: string | null;
  /** Verified facts only (empty for unverified records). */
  facts: { id: string; text: string; quote: boolean }[];
}

function toRetrieved(r: PolicyRecord): RetrievedPolicy {
  const verified = r.verificationStatus === "verified";
  return {
    policyId: r.policyId,
    topic: r.topic,
    title: r.sourceTitle,
    url: r.sourceUrl,
    verified,
    lastVerified: r.lastVerified,
    facts: verified ? policyItems(r).map((f) => ({ ...f })) : [],
  };
}

export function wantsPolicy(question: string): boolean {
  return POLICY_INTENT.test(question);
}

/**
 * Picks the policy records for one question. `scenarioPolicyIds` is the completed attempt's deterministic Playbook
 * mapping (Step 9 `selectPolicyIds`), or empty for general questions.
 */
export function retrievePolicies(
  question: string,
  scenarioPolicyIds: readonly string[] = [],
): RetrievedPolicy[] {
  if (!wantsPolicy(question)) return [];
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  const topics = (Object.keys(TOPIC_PATTERNS) as PolicyTopic[]).filter((t) =>
    TOPIC_PATTERNS[t].test(question),
  );
  // Topic matches first, verified records before unverified ones within a topic.
  for (const t of topics)
    POLICY_RECORDS.filter((r) => r.topic === t)
      .sort(
        (a, b) => Number(b.verificationStatus === "verified") - Number(a.verificationStatus === "verified"),
      )
      .forEach((r) => add(r.policyId));
  for (const id of scenarioPolicyIds) add(id);
  // A general PayPal question with no specific topic: the two verified reporting pages are the safest grounding.
  if (ids.length === 0) {
    add("report-fraud");
    add("report-suspicious-messages");
  }
  return ids
    .slice(0, MAX_POLICIES)
    .map((id) => POLICY_RECORDS.find((r) => r.policyId === id))
    .filter((r): r is PolicyRecord => !!r)
    .map(toRetrieved);
}
