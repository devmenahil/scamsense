import "server-only";
import type { AuthoredAnswerKeyInput } from "../templateSchema";

/** M2-S1 — An Invoice Has Arrived. SERVER-ONLY answer key (R10, R15). */
export const answerKey: AuthoredAnswerKeyInput = {
  scenarioKey: "m2-s1",
  primaryCategory: "fake_invoices_impersonation",
  secondaryCategoryTags: ["phishing_fake_websites"],
  learningObjectives: [
    "Check an unexpected invoice in the supplier's own account portal before paying.",
    "Treat a change of payment details or payee as something to verify independently.",
    "Remember that a polished, correctly formatted invoice proves nothing on its own.",
  ],
  activityTags: ["receiving_invoices", "paying_invoices", "subscriptions", "business_purchasing"],
  contextTags: ["freelancer", "business_owner", "self_employed", "employed_professional", "general_consumer"],
  difficulty: {
    recommendedExperienceLevel: "occasional",
    interactionComplexity: "medium",
    numberOfDecisionPoints: 2,
  },
  fixedScamStatus: "fraudulent",
  fixedCorrectDecisionRules: [
    {
      ruleId: "verify_before_paying_invoice",
      description:
        "Don't pay an unexpected invoice or use the contact details in it. Report or delete it and check the account directly with the supplier.",
      decisionIds: ["report_invoice", "delete_invoice"],
    },
  ],
  evidenceDefinitions: [
    {
      evidenceId: "portal_has_no_invoice",
      targetElementId: "portal_invoices",
      evidenceType: "red_flag",
      title: "The invoice isn't in your Brightline account",
      explanation:
        "Your real account lists only the usual monthly receipts, shows no balance due, and still has you on the Starter plan.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 3,
      keywords: [
        "portal",
        "account",
        "billing page",
        "not listed",
        "no invoice",
        "balance",
        "starter",
        "bookmark",
      ],
    },
    {
      evidenceId: "sender_domain",
      targetElementId: "sender_address",
      evidenceType: "red_flag",
      title: "brightline-cloud.example, not brightlinecloud.example",
      explanation:
        "The new email came from a hyphenated look-alike domain, and replies go to yet another domain. Your genuine receipts came from brightlinecloud.example.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 3,
      keywords: ["sender", "domain", "hyphen", "brightline-cloud", "email address", "reply-to", "reply to"],
    },
    {
      evidenceId: "new_payment_details",
      targetElementId: "processor_paragraph",
      evidenceType: "red_flag",
      title: '"New payment processor": pay a different company',
      explanation:
        "Asking you to stop using your saved card and pay a different company by link or bank transfer is a classic sign of invoice fraud.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 3,
      keywords: [
        "payment processor",
        "bank transfer",
        "new payment",
        "different company",
        "card can't",
        "billing services",
      ],
    },
    {
      evidenceId: "unrequested_upgrade",
      targetElementId: "upgrade_paragraph",
      evidenceType: "red_flag",
      title: "An upgrade you never made",
      explanation:
        "Plan changes are made by you in the portal. An invoice for an upgrade you don't remember is a reason to check, never to pay.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 2,
      keywords: ["upgrade", "didn't order", "never ordered", "business plan", "didn't request"],
    },
    {
      evidenceId: "call_this_number",
      targetElementId: "invoice_phone_note",
      evidenceType: "red_flag",
      title: "A phone number to call within 24 hours",
      explanation:
        "The number on the invoice differs from the support number in your account. Calling it would connect you to the sender, not the supplier.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 2,
      keywords: ["phone", "call", "number", "555-0164", "24 hours"],
    },
    {
      evidenceId: "amount_differs",
      targetElementId: "invoice_total",
      evidenceType: "worth_verifying",
      title: "Much more than your usual charge",
      explanation:
        "The total is several times your normal monthly payment. A big change is worth confirming with the supplier directly.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 2,
      keywords: ["amount", "total", "more than usual", "higher", "expensive", "previous"],
    },
    {
      evidenceId: "due_pressure",
      targetElementId: "due_paragraph",
      evidenceType: "red_flag",
      title: "Pay within 3 days or lose access",
      explanation: "A short deadline with a threat is there to make you pay before you check.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 1,
      keywords: ["3 days", "due", "interruption", "deadline", "urgent"],
    },
    {
      evidenceId: "polished_invoice",
      targetElementId: "invoice_document",
      evidenceType: "worth_verifying",
      title: "A professional-looking invoice",
      explanation:
        "The invoice is well formatted and its number follows the usual pattern. That's easy to copy, so it can't confirm the invoice is real.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 1,
      keywords: ["professional", "looks real", "format", "invoice number", "logo", "layout"],
    },
    {
      evidenceId: "autopay_note",
      targetElementId: "receipt_footer",
      evidenceType: "worth_verifying",
      title: "Your plan normally renews automatically",
      explanation:
        "Last month's genuine receipt shows payments are taken automatically with your saved card, so an emailed invoice to pay by hand is unusual.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["verify_before_paying_invoice"],
      weight: 1,
      keywords: ["automatic", "saved card", "renews", "last month", "receipt"],
    },
  ],
  verificationActions: [
    { actionId: "open_brightline_bookmark", weight: 3 },
    { actionId: "check_sender_details", weight: 2 },
    { actionId: "open_previous_receipt", weight: 2 },
    { actionId: "check_portal_support", weight: 1 },
  ],
  unsafeActionIds: ["pay_invoice"],
  payableDecisionIds: ["pay_invoice"],
  paymentOutcome: "fraud_loss",
  recoveryPolicyIds: ["unauthorized-activity", "disputes", "report-further"],
  fallbackContent: {
    outcomeByDecision: {
      pay_invoice:
        "In the story, the payment went to Brightline Billing Services LLC, which has nothing to do with your real supplier.",
      report_invoice:
        "In the story, the email was reported and your real Brightline account was never involved.",
      delete_invoice: "In the story, nothing was owed: your real account had no outstanding invoice.",
    },
    feedbackCorrect:
      "Great call. You didn't let a professional invoice rush you, and nothing left your Training Funds for a bill you didn't owe.",
    feedbackIncorrect:
      "This invoice looked convincing, which is exactly why checking the supplier's own portal matters. The real account showed nothing owed.",
    safestNextStep:
      "Open the supplier's account through your own bookmark or app, compare the invoice, and contact them using the details in that account.",
    keyLessons: [
      "A polished invoice proves nothing. Check it in the supplier's own account.",
      "New payment details or a new payee are a reason to verify, not to pay.",
      "Never call the phone number printed on an unexpected invoice.",
    ],
  },
};
