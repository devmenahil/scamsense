import "server-only";
import type { AuthoredAnswerKeyInput } from "../templateSchema";

/** M3-S2 — The Seller's Dilemma. SERVER-ONLY answer key (R10, R15). */
export const answerKey: AuthoredAnswerKeyInput = {
  scenarioKey: "m3-s2",
  primaryCategory: "online_shopping_marketplace",
  secondaryCategoryTags: ["fake_invoices_impersonation", "phishing_fake_websites"],
  learningObjectives: [
    "An email, chat message, or screenshot is not proof of payment: check your own account directly.",
    "Keep sales and payments on the marketplace, where the order status shows whether you've been paid.",
    "Recognize stories that make shipping first seem normal (holds, tracking-number releases, couriers, forwarders).",
  ],
  activityTags: ["online_selling", "digital_wallet_usage"],
  contextTags: ["self_employed", "business_owner", "freelancer", "student", "general_consumer", "retired"],
  difficulty: {
    recommendedExperienceLevel: "frequent",
    interactionComplexity: "high",
    numberOfDecisionPoints: 4,
  },
  fixedScamStatus: "fraudulent",
  fixedCorrectDecisionRules: [
    {
      ruleId: "ship_only_when_paid",
      description:
        "Only ship once the payment appears in your own account and the marketplace order shows Paid. Hold the item and report the buyer.",
      decisionIds: ["hold_shipment", "report_buyer"],
    },
  ],
  evidenceDefinitions: [
    {
      evidenceId: "no_payment_in_account",
      targetElementId: "wallet_activity",
      evidenceType: "red_flag",
      title: "No payment in your TandemPay activity",
      explanation:
        "Your own app shows nothing from Jordan M. and nothing pending. If it isn't in your account, you haven't been paid.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 3,
      keywords: [
        "activity",
        "account",
        "app",
        "not there",
        "no payment",
        "pending: none",
        "balance",
        "checked my account",
      ],
    },
    {
      evidenceId: "order_awaiting_payment",
      targetElementId: "order_status",
      evidenceType: "red_flag",
      title: "The order still says Awaiting payment",
      explanation: "Tradepost itself recorded no payment for the order.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 3,
      keywords: ["awaiting payment", "order status", "seller hub", "not paid", "tradepost"],
    },
    {
      evidenceId: "release_condition",
      targetElementId: "payment_email_hold",
      evidenceType: "red_flag",
      title: '"Add tracking and the money will be released"',
      explanation:
        "This story asks you to ship first and get paid later. A real payment to you shows in your account; it doesn't wait for a tracking number.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 3,
      keywords: ["tracking", "on hold", "release", "pending release", "ship first"],
    },
    {
      evidenceId: "confirmation_sender",
      targetElementId: "payment_email_sender",
      evidenceType: "red_flag",
      title: "The payment email came from a look-alike domain",
      explanation:
        "tandempay-payments.example isn't tandempay.example, the domain of your genuine payment emails.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 2,
      keywords: ["sender", "email address", "domain", "tandempay-payments", "fake email", "look-alike"],
    },
    {
      evidenceId: "screenshot_not_proof",
      targetElementId: "shared_image",
      evidenceType: "worth_verifying",
      title: "A screenshot isn't a payment",
      explanation:
        "Anyone can make a picture of a receipt. Only your own account shows what you've received.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 2,
      keywords: ["screenshot", "picture", "proof", "image", "receipt"],
    },
    {
      evidenceId: "off_platform",
      targetElementId: "buyer_first_message",
      evidenceType: "red_flag",
      title: "Payment outside the marketplace",
      explanation:
        "Paying \"straight to your email\" skips Tradepost's checkout, so the order stays unpaid and its protections don't apply.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 2,
      keywords: [
        "outside",
        "off the platform",
        "straight to my email",
        "not through checkout",
        "faster than checkout",
      ],
    },
    {
      evidenceId: "forwarding_address",
      targetElementId: "shipping_address",
      evidenceType: "worth_verifying",
      title: "A freight-forwarding address",
      explanation:
        "Forwarders are legitimate businesses, but they make an item very hard to recover. Combined with the rest, it adds risk.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 1,
      keywords: ["forwarder", "forwarding", "address", "courier", "abroad"],
    },
    {
      evidenceId: "new_buyer",
      targetElementId: "buyer_profile",
      evidenceType: "worth_verifying",
      title: "A brand-new buyer account",
      explanation: "No purchases and no ratings isn't proof, but it means there's no history to rely on.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 1,
      keywords: ["new account", "last week", "no ratings", "no purchases", "buyer profile"],
    },
    {
      evidenceId: "rush",
      targetElementId: "buyer_second_message",
      evidenceType: "red_flag",
      title: "Pressure to ship today",
      explanation: 'A courier "collecting this afternoon" leaves no time to check your account.',
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 1,
      keywords: ["today", "courier", "this afternoon", "rush", "pressure", "quickly"],
    },
    {
      evidenceId: "platform_rule",
      targetElementId: "sale_email_body",
      evidenceType: "worth_verifying",
      title: "Tradepost's own instruction",
      explanation: "The marketplace's genuine email told you to ship once the order shows Paid.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["ship_only_when_paid"],
      weight: 1,
      keywords: ["tradepost email", "shows paid", "seller hub", "marketplace said"],
    },
  ],
  verificationActions: [
    { actionId: "check_payment_account", weight: 3 },
    { actionId: "view_order", weight: 3 },
    { actionId: "check_email_details", weight: 2 },
    { actionId: "check_buyer_profile", weight: 1 },
    { actionId: "open_earlier_payment_email", weight: 1 },
    { actionId: "open_platform_email", weight: 1 },
  ],
  unsafeActionIds: ["ship_item"],
  payableDecisionIds: [],
  paymentOutcome: "none",
  recoveryPolicyIds: ["protection", "disputes", "report-further"],
  fallbackContent: {
    outcomeByDecision: {
      ship_item:
        "In the story, the courier collected the item, no payment ever arrived, and the buyer's account disappeared.",
      hold_shipment:
        "In the story, no payment ever arrived, so you still had your item to sell to someone else.",
      report_buyer:
        "In the story, Tradepost closed the buyer's account after your report, and you still had your item.",
    },
    feedbackCorrect:
      "Superb. You trusted your own account over an email and a screenshot, and you kept your item until a real payment arrived.",
    feedbackIncorrect:
      "This one had a lot going on, and the pressure was real. The key check is your own account: no payment there means no payment at all.",
    safestNextStep:
      "Check your payment account and the marketplace order yourself. Ship only when the payment is there and the order shows Paid.",
    keyLessons: [
      "Emails, chats, and screenshots aren't proof of payment. Your own account is.",
      "Keep the sale and the payment on the marketplace.",
      '"Ship first and the money will be released" is never how real payments work.',
    ],
  },
};
