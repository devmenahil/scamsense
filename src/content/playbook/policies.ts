/**
 * Your Recovery Playbook — versioned U.S. PayPal POLICY KNOWLEDGE BASE (Step 9, revised 2026-11-10; R21, R30).
 *
 * Rules for editing this file (it is the ONLY source of PayPal policy facts in ScamSense; the Playbook pages, the
 * analysis report, and Sensei Kenshi all read it — nothing scrapes PayPal at runtime):
 *   • A fact may be added only after a person (or an automated check) actually READ the official U.S. page. Record the
 *     date in `lastVerified`. `quote: true` = verbatim from the page (curly quotes/apostrophes normalized to straight
 *     ones; "…" marks an omission); `quote: false` = a close summary of what the page says, never an addition to it.
 *   • `pageUpdated` is the "Last updated" date the page itself prints (null when it prints none). `effectiveDate` stays
 *     null unless the page prints an effective date.
 *   • A page that couldn't be read is kept as `source_unavailable`: its official link is shown, but NO eligibility
 *     rules, exclusions, procedures, or deadlines from it appear anywhere until it is verified (tests enforce this).
 *   • An HTTP 403 to one automated request is NOT evidence that a policy is unavailable or invalid: retry, and use the
 *     official alternatives listed in the verification note.
 *   • Gemini never writes or edits anything here, and never receives an unverified record's (empty) facts.
 *   • Bump POLICY_KB_VERSION on every change; stored personalized notes record the version they were made with.
 *
 * Verification log
 *   2026-11-09 (first automated pass): report-suspicious-messages and report-fraud read; five pages answered HTTP 403.
 *   2026-11-10 (second pass, browser-like request headers): ALL nine official pages below loaded (HTTP 200) and were
 *   read. Every `quote: true` item was then checked automatically against the downloaded page text (exact match after
 *   whitespace/quote normalization). Pages and the date each prints:
 *     • /us/legalhub/paypal/buyer-protection (Purchase Protection Program) — "Last updated on January 26, 2026"
 *     • /us/legalhub/paypal/seller-protection (Seller Protection Program) — "Last updated on January 26, 2026"
 *     • /us/legalhub/paypal/useragreement-full (User Agreement; section "Liability for Unauthorized Transactions and
 *       Other Errors" read) — "Last updated on November 4, 2026"
 *     • Help Center help1173, help136, help156, help364; /us/security/report-suspicious-messages and report-fraud —
 *       no date printed.
 */
import { z } from "zod";

export const POLICY_KB_VERSION = "2026-11-10.1";

export const POLICY_TOPICS = [
  "account_security_phishing",
  "unauthorized_transactions",
  "purchase_protection",
  "seller_protection",
  "disputes_resolution_center",
] as const;
export type PolicyTopic = (typeof POLICY_TOPICS)[number];

const SCENARIO_KEYS = ["m1-s1", "m1-s2", "m2-s1", "m2-s2", "m3-s1", "m3-s2"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const item = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  text: z.string().min(1).max(400),
  /** true = verbatim from the page; false = a close summary of what the page says. */
  quote: z.boolean(),
});
export type PolicyItem = z.infer<typeof item>;

export const policyRecordSchema = z
  .object({
    policyId: z.string().regex(/^[a-z0-9-]{1,60}$/),
    topic: z.enum(POLICY_TOPICS),
    jurisdiction: z.literal("US"),
    sourceTitle: z.string().min(1).max(120),
    /** Official U.S. PayPal page only. */
    sourceUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith("https://www.paypal.com/us/"), "official U.S. PayPal URL only"),
    effectiveDate: isoDate.nullable(),
    /** The "Last updated" date printed on the page, or null when it prints none. */
    pageUpdated: isoDate.nullable().default(null),
    /** Date the page's content was actually read and checked. null = never verified. */
    lastVerified: isoDate.nullable(),
    /** Date ScamSense last tried to check the page (verified or not). */
    lastChecked: isoDate,
    verificationStatus: z.enum(["verified", "source_unavailable"]),
    verificationNote: z.string().min(1).max(400),
    /** Key facts (shown first). */
    factualSummary: z.array(item),
    /** Requirements the page lists for eligibility. */
    eligibilityConditions: z.array(item),
    /** How to report / dispute / escalate, as the page describes it. */
    procedures: z.array(item).default([]),
    /** Exclusions and limits (a curated selection; `exclusionsNote` says when the page lists more). */
    exclusions: z.array(item),
    exclusionsNote: z.string().max(300).nullable().default(null),
    relevantScenarioTags: z.array(z.enum(SCENARIO_KEYS)),
  })
  .superRefine((r, ctx) => {
    if ((r.verificationStatus === "verified") !== (r.lastVerified !== null))
      ctx.addIssue({ code: "custom", message: "lastVerified is set exactly when verified" });
    if (r.verificationStatus === "verified" && r.factualSummary.length === 0)
      ctx.addIssue({ code: "custom", message: "a verified record needs at least one fact" });
    if (
      r.verificationStatus !== "verified" &&
      r.eligibilityConditions.length + r.exclusions.length + r.factualSummary.length + r.procedures.length > 0
    )
      ctx.addIssue({ code: "custom", message: "unverified records may not carry policy content" });
    const ids = [...r.factualSummary, ...r.eligibilityConditions, ...r.procedures, ...r.exclusions].map(
      (i) => i.id,
    );
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "item ids must be unique" });
  });
export type PolicyRecord = z.infer<typeof policyRecordSchema>;

const q = (id: string, text: string): z.input<typeof item> => ({ id, text, quote: true });
const s = (id: string, text: string): z.input<typeof item> => ({ id, text, quote: false });

const RECORDS: z.input<typeof policyRecordSchema>[] = [
  /* ------------------------------------------------------------------ phishing / suspicious messages */
  {
    policyId: "report-suspicious-messages",
    topic: "account_security_phishing",
    jurisdiction: "US",
    sourceTitle: "How to Report Suspicious Emails & Messages",
    sourceUrl: "https://www.paypal.com/us/security/report-suspicious-messages",
    effectiveDate: null,
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote: "Read in full on 2026-11-09 and re-checked on 2026-11-10. The page shows no date.",
    eligibilityConditions: [],
    exclusions: [],
    factualSummary: [
      {
        id: "email_dont_click",
        text: 'For a suspicious email: "don\'t click on any links, call any listed phone numbers, or download attachments."',
        quote: true,
      },
      {
        id: "email_forward",
        text: '"Forward the entire email to phishing@paypal.com and delete it from your inbox."',
        quote: true,
      },
      {
        id: "text_dont_click",
        text: "\"Don't click any links in a text message that appears to be from PayPal, but doesn't seem right.\"",
        quote: true,
      },
      {
        id: "text_steps",
        text: 'For a suspicious text, the page\'s steps are: "Tap and hold the message", "Tap More and then the Forward arrow", "Enter phishing@paypal.com as the recipient", "Tap Send", "Block the sender", "Delete the message".',
        quote: true,
      },
    ],
    relevantScenarioTags: ["m1-s1", "m1-s2", "m2-s1", "m3-s1", "m3-s2"],
  },

  /* ------------------------------------------------------------------ unauthorized transactions */
  {
    policyId: "report-fraud",
    topic: "unauthorized_transactions",
    jurisdiction: "US",
    sourceTitle: "Report Fraud & Unauthorized Activity",
    sourceUrl: "https://www.paypal.com/us/security/report-fraud",
    effectiveDate: null,
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote:
      "Read on 2026-11-09 and re-checked on 2026-11-10. The page shows no date. The government-reporting item summarizes the page's links.",
    eligibilityConditions: [],
    exclusions: [],
    factualSummary: [
      {
        id: "report_unauthorized",
        text: '"If you notice a transaction you did not make or authorize, report it right away in our Resolution Center."',
        quote: true,
      },
      {
        id: "change_logins",
        text: '"Change your password, PIN, and security questions for all accounts—including your email accounts and those that don\'t seem to have been compromised."',
        quote: true,
      },
      {
        id: "check_changed_info",
        text: '"Scammers can change info in your accounts, so check for things like phone numbers, email, or mailing addresses that have been added or changed in your accounts."',
        quote: true,
      },
      {
        id: "contact_bank",
        text: 'For your bank: "Ask for the Fraud department, explain what\'s happened, and be clear what they—and you—can do to resolve it."',
        quote: true,
      },
      {
        id: "contact_card_issuer",
        text: 'For a credit card issuer: "Call the number printed on the back of your card."',
        quote: true,
      },
      s(
        "government_reporting",
        "The page also points to U.S. government reporting: the Federal Trade Commission (reportfraud.ftc.gov, identitytheft.gov) and the FBI's Internet Crime Complaint Center (ic3.gov).",
      ),
    ],
    relevantScenarioTags: ["m1-s1", "m1-s2", "m2-s1", "m3-s1", "m3-s2"],
  },
  {
    policyId: "report-unauthorized-help",
    topic: "unauthorized_transactions",
    jurisdiction: "US",
    sourceTitle: "How do I report an unauthorized transaction or account activity?",
    sourceUrl:
      "https://www.paypal.com/us/cshelp/article/how-do-i-report-an-unauthorized-transaction-or-account-activity-help136",
    effectiveDate: null,
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote:
      "Read in full on 2026-11-10 (the 2026-11-09 attempt got HTTP 403). PayPal Help Center article; no date printed.",
    factualSummary: [
      q(
        "report_right_away",
        "If you notice a payment that you didn't authorize, let us know right away through our Resolution Center.",
      ),
      q(
        "investigate_email",
        "Once you've filed an unauthorized transaction, we'll investigate it. You'll receive an email within 10 days.",
      ),
      q(
        "check_family_subscriptions",
        "Some charges may appear unfamiliar but are legitimate and authorized. Before filing a case, make sure the suspicious activity wasn't from a family member using your PayPal account or from an automatic payment, such as a subscription.",
      ),
    ],
    eligibilityConditions: [],
    procedures: [
      s(
        "web_steps",
        'On the web: go to the Resolution Center, click Report a problem, choose the payment you want to report and click Continue, choose "I want to report unauthorized activity," and follow the steps to report the payment.',
      ),
    ],
    exclusions: [],
    relevantScenarioTags: ["m1-s1", "m1-s2"],
  },
  {
    policyId: "user-agreement",
    topic: "unauthorized_transactions",
    jurisdiction: "US",
    sourceTitle: "PayPal User Agreement: Liability for Unauthorized Transactions",
    sourceUrl: "https://www.paypal.com/us/legalhub/paypal/useragreement-full",
    effectiveDate: null,
    pageUpdated: "2026-11-04",
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote:
      'Read on 2026-11-10: the section "Liability for Unauthorized Transactions and Other Errors" only (the full agreement is much longer). The page prints "Last updated on November 4, 2026".',
    factualSummary: [
      q(
        "definition",
        'An "Unauthorized Transaction" occurs when money is sent from your PayPal account that you did not authorize and that did not benefit you.',
      ),
      q(
        "definition_example",
        "For example, if someone steals or fraudulently obtains your password, uses the password to access your PayPal account, and sends a payment from your PayPal account, an Unauthorized Transaction has occurred.",
      ),
      q(
        "protection_applies",
        "When this protection applies, PayPal will cover you for the full amount of the unauthorized activity as long as you cooperate with us and follow the procedures described below.",
      ),
      q(
        "tell_at_once",
        "Tell us AT ONCE if you believe that an electronic fund transfer has been made without your permission using your login information or by other means. You could lose all the money in your PayPal account.",
      ),
      q(
        "sixty_days",
        "If you do not tell us within 60 days after we provided the statement to you, you may not get back any money you lost after the 60 days if we can prove that we could have stopped someone from taking the money if you had told us in time.",
      ),
    ],
    eligibilityConditions: [],
    procedures: [
      q(
        "lost_login",
        "If you believe your PayPal login information has been lost or stolen, please contact PayPal customer service immediately",
      ),
      q(
        "review_statement",
        "To protect yourself from unauthorized activity in your PayPal account, you should regularly log into your PayPal account and review your PayPal account statement.",
      ),
    ],
    exclusions: [
      q(
        "shared_login",
        "If you grant authority to someone to use your PayPal account (by giving them your login information) and they exceed the authority you gave them. You are responsible for transactions made in this situation unless you have previously notified PayPal that you no longer authorize transfers by that individual.",
      ),
      s(
        "reversals",
        "Also not an Unauthorized Transaction: the invalidation and reversal of a payment under the agreement's Refunds, Reversals and Chargebacks section.",
      ),
    ],
    exclusionsNote:
      'These are the two situations the section lists under "What is not considered an Unauthorized Transaction".',
    relevantScenarioTags: ["m1-s1", "m1-s2", "m2-s1", "m3-s1"],
  },

  /* ------------------------------------------------------------------ Purchase Protection */
  {
    policyId: "purchase-protection",
    topic: "purchase_protection",
    jurisdiction: "US",
    sourceTitle: "PayPal Purchase Protection Program",
    sourceUrl: "https://www.paypal.com/us/legalhub/paypal/buyer-protection",
    effectiveDate: null,
    pageUpdated: "2026-01-26",
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote:
      'Read in full on 2026-11-10 (the 2026-11-09 attempt got HTTP 403; also reachable with ?locale.x=en). The page prints "Last updated on January 26, 2026".',
    factualSummary: [
      s(
        "two_problems",
        'Purchase Protection may apply when you didn\'t receive an item from a seller (an "Item Not Received" claim) or received an item that isn\'t what you ordered (a "Significantly Not as Described" claim).',
      ),
      q(
        "may_cover",
        "When applicable, PayPal's Purchase Protection program may result in coverage for the full purchase price of the item plus the original shipping costs you paid, if any.",
      ),
      q(
        "sole_discretion",
        "PayPal determines, in its sole discretion, whether your claim is eligible for the Purchase Protection program based on the eligibility requirements, any information or documentation provided during the resolution process, or any other information PayPal deems relevant and appropriate under the circumstances.",
      ),
      q(
        "unauthorized_is_different",
        "If you believe that a transaction made through your PayPal account was not authorized by you, this type of claim is different from the Purchase Protection program",
      ),
      q(
        "inr_proof",
        "…you will not qualify for a refund under PayPal's Purchase Protection program for an Item Not Received Claim if the seller has provided proof of shipment or delivery.",
      ),
      q(
        "return_item",
        "You may be required to return the item to the seller or other party we specify as part of the settlement of your claim. PayPal's Purchase Protection program does not entitle you to coverage for the return shipping costs that you may incur.",
      ),
      q(
        "card_issuer_choice",
        "You must choose whether to pursue a dispute with PayPal under our Purchase Protection program, or to pursue the dispute with your card issuer. You can't do both at the same time or seek a double recovery.",
      ),
    ],
    eligibilityConditions: [
      q("good_standing", "Have a PayPal account in good standing."),
      q("paid_with_paypal", "Pay for the eligible item from your PayPal account."),
      q(
        "contact_seller",
        "Attempt to contact the seller to resolve your issue directly before filing a claim through the Resolution Center.",
      ),
      q(
        "respond_docs",
        "Respond to PayPal's request for documentation and other information within the time requested.",
      ),
      q(
        "open_in_time",
        "Open a dispute in the Resolution Center within the applicable timeframe and follow our online dispute resolution process.",
      ),
      q(
        "no_other_recovery",
        "Not have received a recovery or agreed to an alternative resolution related to your purchase from another source.",
      ),
    ],
    procedures: [
      s(
        "step_open",
        "Step 1: open a dispute in the Resolution Center within the applicable timeframe. This can start a direct conversation with the seller, and PayPal holds the related funds in the seller's account until the dispute is resolved or closed.",
      ),
      q(
        "step_escalate",
        "Escalate the dispute to a claim for reimbursement within 20 days after opening the dispute, if you and the seller are unable to come to an agreement, or we will automatically close the dispute.",
      ),
      q(
        "escalate_wait",
        "PayPal may ask you to wait at least 7 days from the transaction date to escalate the dispute.",
      ),
      q(
        "step_documents",
        "PayPal may require you to provide receipts, third-party evaluations, police reports or other documents that PayPal specifies.",
      ),
      q(
        "step_ship_back",
        "PayPal may require you, at your expense, to ship the item back to the seller, to PayPal or to a third party (which will be specified by PayPal) and to provide proof of delivery.",
      ),
      q(
        "temporary_refund",
        "While we investigate your dispute, in our sole discretion, we may provide a temporary refund.",
      ),
    ],
    exclusions: [
      q(
        "friends_family",
        "Personal Payments including payments sent using PayPal's friends and family functionality.",
      ),
      q(
        "cash_equivalent",
        "Payments that are equivalent to cash, including stored value items such as gift cards and pre-paid cards.",
      ),
      q("financial_products", "Financial products or investments of any kind."),
      q("custom_made", "Significantly Not as Described claims for wholly or partly custom-made items."),
      q(
        "resale",
        "Items intended for resale, including single item transactions or transactions that include multiple items.",
      ),
      s(
        "collected_in_person",
        "Item Not Received claims for physical items you collect in person or arrange to be collected on your behalf (with an exception for some PayPal goods-and-services QR code payments).",
      ),
      q("not_your_account", "Payments that you have not sent using your PayPal account."),
      s(
        "not_snad",
        "Not Significantly Not as Described: an item that was properly described but that you didn't want after you received it, or that didn't meet your expectations.",
      ),
    ],
    exclusionsNote:
      "A selection. The page lists further exclusions, including real estate, vehicles, businesses, industrial machinery, gold, NFTs, gambling, donations, and payments to government bodies.",
    relevantScenarioTags: ["m2-s1", "m2-s2", "m3-s1"],
  },
  {
    policyId: "purchase-protection-help",
    topic: "purchase_protection",
    jurisdiction: "US",
    sourceTitle: "Does PayPal cover my purchase if there's a problem?",
    sourceUrl:
      "https://www.paypal.com/us/cshelp/article/does-paypal-cover-my-purchase-if-theres-a-problem-help364",
    effectiveDate: null,
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote: "Read in full on 2026-11-10. PayPal Help Center article; no date printed.",
    factualSummary: [
      q(
        "requirements",
        "To avail of our Purchase Protection, we require that your PayPal account is kept in good standing and that you open a dispute within the correct dispute-filing timeframe.",
      ),
      q(
        "claim_meaning",
        "By escalating a dispute to a claim, you're asking PayPal to investigate and decide the outcome.",
      ),
      q(
        "auto_close",
        "A dispute will automatically close after 20 days unless it's been escalated. Closed disputes cannot be reopened or escalated to a claim.",
      ),
      q(
        "decision",
        "We'll review the case and decide if you're eligible for a refund. If we decide the claim in your favor, we'll reimburse you for the full purchase price and original shipping costs.",
      ),
    ],
    eligibilityConditions: [],
    procedures: [
      q("report_problem", "Go to your Resolution Center and click Report a Problem."),
      q(
        "exchange_messages",
        "In a dispute, you can exchange messages with the other party in your Resolution Center to try to solve the problem.",
      ),
    ],
    exclusions: [
      q("ff", "Friends and Family payments"),
      q("pending", "Pending authorizations"),
      q("unpaid_requests", "Money requests or invoice requests that have not been paid by customers"),
    ],
    exclusionsNote:
      "A selection of the examples the article lists (it also names motor vehicles, industrial machinery, real estate, prepaid cards, items that violate PayPal's policies, custom-made items, and items intended for resale).",
    relevantScenarioTags: ["m2-s1", "m2-s2", "m3-s1"],
  },

  /* ------------------------------------------------------------------ Seller Protection */
  {
    policyId: "seller-protection",
    topic: "seller_protection",
    jurisdiction: "US",
    sourceTitle: "PayPal Seller Protection Program",
    sourceUrl: "https://www.paypal.com/us/legalhub/paypal/seller-protection",
    effectiveDate: null,
    pageUpdated: "2026-01-26",
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote:
      'Read in full on 2026-11-10 (the 2026-11-09 attempt got HTTP 403; also reachable with ?locale.x=en_US). The page prints "Last updated on January 26, 2026".',
    factualSummary: [
      q(
        "may_retain",
        "When it applies, PayPal's Seller Protection program may result in you retaining the full purchase amount.",
      ),
      s(
        "claim_types",
        'It may apply when a buyer claims they didn\'t authorize the payment (an "Unauthorized Transaction" claim, in an environment hosted by PayPal) or didn\'t receive the item (an "Item Not Received" claim). Item Not Received claims a buyer files as a card chargeback with their issuer aren\'t eligible.',
      ),
      q(
        "transaction_details",
        "By accessing the Transaction Details page in your PayPal account you can see transactions that may be eligible for protection under this program.",
      ),
      s(
        "sole_discretion",
        "PayPal decides, in its sole discretion, whether a claim is eligible, based on the requirements, the information provided, and anything else PayPal deems relevant.",
      ),
    ],
    eligibilityConditions: [
      q("us_address", "The primary address for your PayPal account must be in the United States."),
      s(
        "physical_goods",
        "The item must be a physical, tangible good that can be shipped (intangible goods have their own additional requirements).",
      ),
      q(
        "ship_to_address",
        "You must ship the item to the shipping address on the Transaction Details page in your PayPal account for the transaction.",
      ),
      q(
        "redirected",
        "If you originally ship the item to the recipient's shipping address on the Transaction Details page but the item is later redirected to a different address, you will not be eligible for PayPal's Seller Protection program.",
      ),
      q("proof", "You provide us with valid proof of shipment or delivery."),
      s(
        "respond_docs",
        "You must respond to PayPal's requests for documentation and other information in the time requested.",
      ),
      q(
        "marked_eligible",
        'In the case of Unauthorized Transaction claims, the payment must be marked "eligible" or "partially eligible" for PayPal\'s Seller Protection program on the Transaction Details page.',
      ),
    ],
    procedures: [
      s(
        "proof_of_delivery",
        'Proof of delivery for physical goods is documentation from a shipping company with an online, verifiable tracking number, the delivery date and "delivered" status, and a recipient address that matches the Transaction Details page.',
      ),
      q(
        "buyer_arranged_shipping",
        "We therefore recommend not using a shipping service that is arranged by the buyer, so that you will be able to provide valid proof of shipping and delivery.",
      ),
    ],
    exclusions: [
      q(
        "snad",
        "Items where the buyer claims (either with us or their card issuer) that the item you sent isn't what was ordered (referred to as a Significantly Not as Described claim).",
      ),
      q("inr_card", "Item Not Received claims filed by your buyer directly with their card issuer."),
      q("sent_after_warning", "Items sent after PayPal advised you not to release the item."),
      q(
        "personal_payments",
        "Personal payments including a payment sent using PayPal's friends and family functionality.",
      ),
      s(
        "in_person",
        "Physical items delivered in person, unless the buyer paid in person with PayPal's goods and services QR code.",
      ),
    ],
    exclusionsNote:
      "A selection. The page lists further exclusions, including real estate, vehicles, businesses, industrial machinery, gift cards and other cash equivalents, financial products, gambling, and donations.",
    relevantScenarioTags: ["m3-s2"],
  },
  {
    policyId: "seller-protection-help",
    topic: "seller_protection",
    jurisdiction: "US",
    sourceTitle: "What is PayPal Seller Protection?",
    sourceUrl: "https://www.paypal.com/us/cshelp/article/what-is-paypal-seller-protection-help156",
    effectiveDate: null,
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote: "Read in full on 2026-11-10. PayPal Help Center article; no date printed.",
    factualSummary: [
      q(
        "guards_against",
        "Our Seller Protection helps guard against losing money to claims, chargebacks, and reversals. You're covered for the total purchase amount on all eligible transactions.",
      ),
      s(
        "two_complaints",
        "It applies to two types of complaints: Item Not Received issues filed through PayPal's Resolution Center, and unauthorized payment issues.",
      ),
      q(
        "unauthorized_marked",
        "For unauthorized payment issues, a payment is eligible for Seller Protection if it is marked as eligible on the Transaction Details page.",
      ),
    ],
    eligibilityConditions: [
      q("ship_address", "Ship the item to the address on the Transaction Details page."),
      q(
        "respond",
        "Respond to our requests for documentation and other information within the required timeframe.",
      ),
      q("proof", "Provide us with valid proof of shipment or delivery."),
    ],
    exclusions: [
      q("snad", "Claims for items or services Significantly Not As Described."),
      q("cash", "Items equivalent to cash, including prepaid or gift cards."),
    ],
    exclusionsNote:
      "A selection. The article also names real estate, businesses, vehicles, industrial machinery, items prohibited by the Acceptable Use Policy, and Item Not Received claims filed with a card issuer.",
    relevantScenarioTags: ["m3-s2"],
  },

  /* ------------------------------------------------------------------ disputes and the Resolution Center */
  {
    policyId: "dispute-filing-timeframes",
    topic: "disputes_resolution_center",
    jurisdiction: "US",
    sourceTitle: "Dispute filing timeframes",
    sourceUrl: "https://www.paypal.com/us/cshelp/article/dispute-filing-timeframes-help1173",
    effectiveDate: null,
    lastVerified: "2026-11-10",
    lastChecked: "2026-11-10",
    verificationStatus: "verified",
    verificationNote:
      "Read in full on 2026-11-10 (the 2026-11-09 attempt got HTTP 403; the same article is also served at pep.paypal.com). PayPal Help Center article; no date printed. Its timeframes match the Purchase Protection terms.",
    factualSummary: [
      s(
        "reasons",
        "You can file a dispute for unauthorized activity in your PayPal account, a purchase that doesn't arrive or doesn't match the seller's description, a seller who isn't cooperating, or billing errors such as being charged more than once.",
      ),
      q(
        "inr_180",
        "Item Not Received: Dispute must be opened within 180 days of the date you sent the payment to the seller.",
      ),
      q(
        "snad_30_180",
        "Significantly Not as Described: Dispute must be opened within 30 days of the date of delivery or fulfillment (as applicable) of an order or within 180 days of the date you sent the payment to the seller, whichever is sooner.",
      ),
      q(
        "unauthorized_at_once",
        "Unauthorized transactions: If your PayPal account statement shows transfers that you did not make, you should tell us at once.",
      ),
      q(
        "other_errors_60",
        "We must hear from you no later than 60 days after we sent the FIRST statement on which the problem or error appeared.",
      ),
    ],
    eligibilityConditions: [],
    exclusions: [],
    relevantScenarioTags: ["m2-s1", "m2-s2", "m3-s1"],
  },
];

export const POLICY_RECORDS: readonly PolicyRecord[] = RECORDS.map((r) => policyRecordSchema.parse(r));
export type PolicyId = string;

export function getPolicy(id: string): PolicyRecord | undefined {
  return POLICY_RECORDS.find((p) => p.policyId === id);
}

/** Every item of a record, in display order (facts, eligibility, procedures, exclusions). */
export function policyItems(p: PolicyRecord): PolicyItem[] {
  return [...p.factualSummary, ...p.eligibilityConditions, ...p.procedures, ...p.exclusions];
}

export const TOPIC_LABELS: Record<PolicyTopic, string> = {
  account_security_phishing: "Account security and suspicious messages",
  unauthorized_transactions: "Unauthorized transactions",
  purchase_protection: "Purchase Protection",
  seller_protection: "Seller Protection",
  disputes_resolution_center: "Disputes and the Resolution Center",
};
