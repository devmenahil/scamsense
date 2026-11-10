import "server-only";
/**
 * Recovery Playbook — scenario guidance and the DETERMINISTIC scenario → policy mapping (Step 9). SERVER-ONLY because
 * it describes what each scenario really was; it is shown only for COMPLETED attempts (R10).
 *
 * Step kinds:
 *   • "practice": ScamSense's own general safety habit (never a PayPal rule, deadline, or outcome).
 *   • "paypal":   a VERIFIED fact from policies.ts, shown with its official source link and verification date.
 * Policy selection = core ∪ (paid ? whenPaid) ∪ (decision not appropriate ? whenAffected). No AI involved.
 */
import { z } from "zod";
import type { ScenarioKey } from "@/content/modules";
import { DISTINCTION_IDS, type DistinctionId } from "./distinctions";

const stepSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().regex(/^[a-z0-9_]{1,40}$/),
    kind: z.literal("practice"),
    text: z.string().min(1).max(320),
  }),
  z.object({
    id: z.string().regex(/^[a-z0-9_]{1,40}$/),
    kind: z.literal("paypal"),
    /** Short ScamSense lead-in ("If someone got into your account:"); the fact itself is PayPal's verified wording. */
    lead: z.string().min(1).max(120),
    policyId: z.string(),
    factId: z.string(),
  }),
]);
export type PlaybookStep = z.infer<typeof stepSchema>;

export const scenarioPlaybookSchema = z.object({
  scenarioKey: z.enum(["m1-s1", "m1-s2", "m2-s1", "m2-s2", "m3-s1", "m3-s2"]),
  lesson: z.string().min(1).max(160),
  framing: z.object({ appropriate: z.string().min(1).max(320), affected: z.string().min(1).max(320) }),
  steps: z.array(stepSchema).min(3).max(10),
  howPayPalMayHelp: z.string().min(1).max(400),
  policies: z.object({
    core: z.array(z.string()).min(1),
    whenPaid: z.array(z.string()).default([]),
    whenAffected: z.array(z.string()).default([]),
  }),
  distinctions: z.array(z.enum(DISTINCTION_IDS as [DistinctionId, ...DistinctionId[]])).min(2),
});
export type ScenarioPlaybook = z.infer<typeof scenarioPlaybookSchema>;

const RAW: z.input<typeof scenarioPlaybookSchema>[] = [
  {
    scenarioKey: "m1-s1",
    lesson: "A one-time code is a key to your account: it's only for you to sign in.",
    framing: {
      appropriate:
        "You kept the code to yourself in the story. Here's what to do if a real message like this ever reaches you, or if a code has already been shared.",
      affected:
        "In the story, the code let someone else sign in to the account. Here's what you could do if that ever happened for real.",
    },
    steps: [
      {
        id: "keep_code",
        kind: "practice",
        text: "Don't share the code with anyone, even someone who says they're support. End the conversation.",
      },
      {
        id: "check_app",
        kind: "practice",
        text: "Open the official app yourself (not a link in the message) and check your recent activity and security settings.",
      },
      {
        id: "change_logins",
        kind: "paypal",
        lead: "If you think someone got into your account:",
        policyId: "report-fraud",
        factId: "change_logins",
      },
      {
        id: "check_info",
        kind: "paypal",
        lead: "Then look for changes you didn't make:",
        policyId: "report-fraud",
        factId: "check_changed_info",
      },
      {
        id: "report_txn",
        kind: "paypal",
        lead: "If a payment appears that you didn't make:",
        policyId: "report-fraud",
        factId: "report_unauthorized",
      },
      {
        id: "report_how",
        kind: "paypal",
        lead: "How to report it on the web:",
        policyId: "report-unauthorized-help",
        factId: "web_steps",
      },
      {
        id: "report_text",
        kind: "paypal",
        lead: "If a text claiming to be PayPal asked for the code:",
        policyId: "report-suspicious-messages",
        factId: "text_steps",
      },
    ],
    howPayPalMayHelp:
      "PayPal's official pages explain how to report suspicious messages and activity you didn't make or authorize. The User Agreement defines an unauthorized transaction and says PayPal covers it when its protection applies and you cooperate with PayPal's procedures.",
    policies: {
      core: ["report-suspicious-messages", "report-fraud", "user-agreement"],
      whenAffected: ["report-unauthorized-help"],
    },
    distinctions: [
      "authorized_vs_unauthorized",
      "report_message_vs_transaction",
      "training_funds",
      "educational_not_case",
    ],
  },
  {
    scenarioKey: "m1-s2",
    lesson:
      "Reach your accounts through an address you type or saved yourself, never through a message's link.",
    framing: {
      appropriate:
        "You didn't hand your details to the look-alike site in the story. Here's what to do with a message like this in real life, and what to do if you ever do enter details on a fake page.",
      affected:
        "In the story, the look-alike page was the scammer's. Here's what you could do if you ever entered details on a page like that for real.",
    },
    steps: [
      {
        id: "no_link",
        kind: "practice",
        text: "Don't use the message's link or button. Type the address you know, or use your saved bookmark or the official app.",
      },
      {
        id: "email_dont_click",
        kind: "paypal",
        lead: "For a suspicious email that claims to be PayPal:",
        policyId: "report-suspicious-messages",
        factId: "email_dont_click",
      },
      {
        id: "email_forward",
        kind: "paypal",
        lead: "To report it:",
        policyId: "report-suspicious-messages",
        factId: "email_forward",
      },
      {
        id: "change_logins",
        kind: "paypal",
        lead: "If you typed a password into a fake page:",
        policyId: "report-fraud",
        factId: "change_logins",
      },
      {
        id: "check_info",
        kind: "paypal",
        lead: "Then look for changes you didn't make:",
        policyId: "report-fraud",
        factId: "check_changed_info",
      },
      {
        id: "report_txn",
        kind: "paypal",
        lead: "If a payment appears that you didn't make:",
        policyId: "report-fraud",
        factId: "report_unauthorized",
      },
      {
        id: "report_how",
        kind: "paypal",
        lead: "How to report it on the web:",
        policyId: "report-unauthorized-help",
        factId: "web_steps",
      },
    ],
    howPayPalMayHelp:
      "PayPal's official pages explain how to report emails and texts that pretend to be PayPal, and how to report activity you didn't make or authorize.",
    policies: {
      core: ["report-suspicious-messages", "report-fraud"],
      whenAffected: ["report-unauthorized-help", "user-agreement"],
    },
    distinctions: [
      "report_message_vs_transaction",
      "authorized_vs_unauthorized",
      "training_funds",
      "educational_not_case",
    ],
  },
  {
    scenarioKey: "m2-s1",
    lesson: "Check a bill where you already know it's real, not in the message that delivered it.",
    framing: {
      appropriate:
        "You didn't pay the fake invoice in the story. Here's how to handle a suspicious invoice in real life, and what to do if one ever gets paid.",
      affected:
        "In the story, the payment went to the scammer. Here's what you could do if you ever paid an invoice like this for real.",
    },
    steps: [
      {
        id: "check_portal",
        kind: "practice",
        text: "Compare the invoice with your account on the supplier's real site, opened from your own bookmark.",
      },
      {
        id: "call_known",
        kind: "practice",
        text: "Contact the supplier using details you already had, not the phone number or bank details printed on the new invoice.",
      },
      {
        id: "email_dont_click",
        kind: "paypal",
        lead: "PayPal's advice for a suspicious email:",
        policyId: "report-suspicious-messages",
        factId: "email_dont_click",
      },
      {
        id: "contact_bank",
        kind: "paypal",
        lead: "If money left your bank account:",
        policyId: "report-fraud",
        factId: "contact_bank",
      },
      {
        id: "contact_card",
        kind: "paypal",
        lead: "If you paid by credit card:",
        policyId: "report-fraud",
        factId: "contact_card_issuer",
      },
      {
        id: "pp_scope",
        kind: "paypal",
        lead: "If you paid with PayPal, Purchase Protection covers specific problems only:",
        policyId: "purchase-protection",
        factId: "two_problems",
      },
      {
        id: "pp_friends_family",
        kind: "paypal",
        lead: "Some payments are never covered, for example:",
        policyId: "purchase-protection",
        factId: "friends_family",
      },
      {
        id: "ua_definition",
        kind: "paypal",
        lead: "A payment you approved yourself is different from an unauthorized one, which PayPal defines this way:",
        policyId: "user-agreement",
        factId: "definition",
      },
      {
        id: "gov_report",
        kind: "paypal",
        lead: "You can also report the scam:",
        policyId: "report-fraud",
        factId: "government_reporting",
      },
    ],
    howPayPalMayHelp:
      "PayPal's official pages cover reporting suspicious messages and fraud. Purchase Protection may apply to an item not received or not as described, under its own requirements and exclusions; the User Agreement's protection is for transactions you didn't authorize.",
    policies: {
      core: ["report-suspicious-messages", "report-fraud", "purchase-protection", "user-agreement"],
      whenPaid: ["dispute-filing-timeframes"],
    },
    distinctions: [
      "authorized_vs_unauthorized",
      "protection_not_guarantee",
      "sandbox_not_coverage",
      "training_funds",
      "educational_not_case",
    ],
  },
  {
    scenarioKey: "m2-s2",
    lesson: "Checking a seller can show you good reasons to go ahead, not only reasons to stop.",
    framing: {
      appropriate:
        "This was a genuine sale, and buying through the marketplace checkout was reasonable. Here's how to keep a good purchase protected, and what to do if a genuine purchase later runs into a problem.",
      affected:
        "This was a genuine sale: caution is good, but here the evidence supported buying. Here's how to buy safely next time, and what to do if a genuine purchase later runs into a problem.",
    },
    steps: [
      {
        id: "use_checkout",
        kind: "practice",
        text: "Pay through the marketplace's own checkout, not by sending money to the seller directly.",
      },
      {
        id: "keep_records",
        kind: "practice",
        text: "Keep the order confirmation, the listing, your messages with the seller, and the tracking details.",
      },
      {
        id: "seller_first",
        kind: "practice",
        text: "If the item is late or not as described, contact the seller through the marketplace first, and use its returns process.",
      },
      {
        id: "pp_contact_seller",
        kind: "paypal",
        lead: "If a PayPal purchase goes wrong, Purchase Protection asks you to:",
        policyId: "purchase-protection",
        factId: "contact_seller",
      },
      {
        id: "time_inr",
        kind: "paypal",
        lead: "If the item never arrives:",
        policyId: "dispute-filing-timeframes",
        factId: "inr_180",
      },
      {
        id: "time_snad",
        kind: "paypal",
        lead: "If it arrives but isn't as described:",
        policyId: "dispute-filing-timeframes",
        factId: "snad_30_180",
      },
      {
        id: "pp_not_snad",
        kind: "paypal",
        lead: "A change of mind isn't the same thing:",
        policyId: "purchase-protection",
        factId: "not_snad",
      },
    ],
    howPayPalMayHelp:
      "If you pay with PayPal, Purchase Protection may cover an item that doesn't arrive or isn't as described, when the payment and the dispute meet PayPal's requirements and timeframes. PayPal reviews each claim and decides the outcome.",
    policies: { core: ["purchase-protection", "dispute-filing-timeframes"] },
    distinctions: [
      "legit_problem_not_fraud",
      "protection_not_guarantee",
      "sandbox_not_coverage",
      "educational_not_case",
    ],
  },
  {
    scenarioKey: "m3-s1",
    lesson: "A job that asks you to pay before you start is asking for the wrong kind of money.",
    framing: {
      appropriate:
        "You didn't pay the 'deposit' in the story. Here's how to check a job offer in real life, and what to do if a payment like this is ever made.",
      affected:
        "In the story, the deposit went to the scammer. Here's what you could do if you ever paid one for real.",
    },
    steps: [
      {
        id: "no_upfront",
        kind: "practice",
        text: "Be wary of any job that asks you to pay for equipment, training, or 'onboarding' before you start.",
      },
      {
        id: "verify_company",
        kind: "practice",
        text: "Find the company's own careers page yourself and check that the role and the recruiter really exist.",
      },
      {
        id: "email_dont_click",
        kind: "paypal",
        lead: "PayPal's advice for a suspicious email:",
        policyId: "report-suspicious-messages",
        factId: "email_dont_click",
      },
      {
        id: "contact_bank",
        kind: "paypal",
        lead: "If money left your bank account:",
        policyId: "report-fraud",
        factId: "contact_bank",
      },
      {
        id: "pp_scope",
        kind: "paypal",
        lead: "If you paid with PayPal, Purchase Protection covers specific problems only:",
        policyId: "purchase-protection",
        factId: "two_problems",
      },
      {
        id: "pp_friends_family",
        kind: "paypal",
        lead: "Some payments are never covered, for example:",
        policyId: "purchase-protection",
        factId: "friends_family",
      },
      {
        id: "ua_definition",
        kind: "paypal",
        lead: "A payment you approved yourself is different from an unauthorized one, which PayPal defines this way:",
        policyId: "user-agreement",
        factId: "definition",
      },
      {
        id: "gov_report",
        kind: "paypal",
        lead: "You can also report the scam:",
        policyId: "report-fraud",
        factId: "government_reporting",
      },
    ],
    howPayPalMayHelp:
      "PayPal's official pages cover reporting suspicious messages and fraud. Purchase Protection may apply to an item not received or not as described, under its own requirements and exclusions; the User Agreement's protection is for transactions you didn't authorize.",
    policies: {
      core: ["report-suspicious-messages", "report-fraud", "purchase-protection", "user-agreement"],
      whenPaid: ["dispute-filing-timeframes"],
    },
    distinctions: [
      "authorized_vs_unauthorized",
      "protection_not_guarantee",
      "sandbox_not_coverage",
      "training_funds",
      "educational_not_case",
    ],
  },
  {
    scenarioKey: "m3-s2",
    lesson: "As a seller, ship only after the payment shows up in your own account.",
    framing: {
      appropriate:
        "You held the order in the story. Here's how to confirm a payment in real life before you ship, and where to read about Seller Protection.",
      affected:
        "In the story, the item shipped without a real payment. Here's what you could do differently, and where to read about Seller Protection.",
    },
    steps: [
      {
        id: "sign_in_check",
        kind: "practice",
        text: "Sign in to your payment account yourself and check that the payment is really there before you ship.",
      },
      {
        id: "ignore_screens",
        kind: "practice",
        text: "Don't treat a screenshot, a forwarded email, or a buyer's message as proof of payment.",
      },
      {
        id: "no_address_change",
        kind: "practice",
        text: "Be cautious when a buyer asks you to change the delivery address or rush the shipment through a message.",
      },
      {
        id: "email_forward",
        kind: "paypal",
        lead: "If a 'payment' email pretends to be from PayPal:",
        policyId: "report-suspicious-messages",
        factId: "email_forward",
      },
      {
        id: "sp_ship_address",
        kind: "paypal",
        lead: "Seller Protection requires you to ship to the right address:",
        policyId: "seller-protection",
        factId: "ship_to_address",
      },
      {
        id: "sp_redirect",
        kind: "paypal",
        lead: "And a parcel redirected later loses that protection:",
        policyId: "seller-protection",
        factId: "redirected",
      },
      {
        id: "sp_proof",
        kind: "paypal",
        lead: "Keep proof of delivery:",
        policyId: "seller-protection",
        factId: "proof_of_delivery",
      },
    ],
    howPayPalMayHelp:
      "PayPal's Seller Protection may let an eligible seller keep the payment when a buyer claims an unauthorized payment or an item not received, if the sale meets requirements such as shipping to the address on the Transaction Details page with valid proof of delivery. PayPal's security pages explain how to report fake emails and fraud.",
    policies: { core: ["seller-protection", "report-suspicious-messages", "report-fraud"] },
    distinctions: [
      "seller_payment_proof",
      "protection_not_guarantee",
      "training_funds",
      "educational_not_case",
    ],
  },
];

export const SCENARIO_PLAYBOOKS: Readonly<Record<ScenarioKey, ScenarioPlaybook>> = Object.fromEntries(
  RAW.map((r) => {
    const parsed = scenarioPlaybookSchema.parse(r);
    return [parsed.scenarioKey, parsed];
  }),
) as Record<ScenarioKey, ScenarioPlaybook>;
