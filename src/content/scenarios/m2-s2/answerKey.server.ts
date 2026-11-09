import "server-only";
import type { AuthoredAnswerKeyInput } from "../templateSchema";

/**
 * M2-S2 — The Laptop Purchase. SERVER-ONLY answer key (R10, R15). The LEGITIMATE scenario (R17): legitimacy holds
 * only within the fiction; nothing claims a real-world seller has been verified.
 */
export const answerKey: AuthoredAnswerKeyInput = {
  scenarioKey: "m2-s2",
  primaryCategory: "online_shopping_marketplace",
  learningObjectives: [
    "Recognize positive evidence: a long seller history, consistent details, clear returns, and payment that stays in the marketplace's checkout.",
    "Check the seller, reviews, and web address before buying, without treating every imperfection as fraud.",
    "Pay through a protected checkout instead of directly to a seller.",
  ],
  activityTags: ["online_shopping", "digital_wallet_usage"],
  contextTags: [
    "student",
    "employed_professional",
    "general_consumer",
    "freelancer",
    "job_seeker",
    "retired",
  ],
  difficulty: {
    recommendedExperienceLevel: "occasional",
    interactionComplexity: "medium",
    numberOfDecisionPoints: 2,
  },
  fixedScamStatus: "legitimate",
  fixedCorrectDecisionRules: [
    {
      ruleId: "buy_after_checking",
      description:
        "The listing, seller, and checkout are consistent and stay inside the marketplace, so buying through the marketplace checkout is appropriate.",
      decisionIds: ["place_order"],
    },
  ],
  evidenceDefinitions: [
    {
      evidenceId: "seller_history",
      targetElementId: "seller_information",
      evidenceType: "positive_verification_evidence",
      title: "A long, well-rated selling history",
      explanation:
        "Keystone has sold on the marketplace since 2019 with thousands of recent ratings, which is hard to fake quickly.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["buy_after_checking"],
      weight: 3,
      keywords: ["seller", "since 2019", "ratings", "positive", "history", "profile", "reputation"],
    },
    {
      evidenceId: "on_platform_payment",
      targetElementId: "seller_payment_policy",
      evidenceType: "positive_verification_evidence",
      title: "Payment only through the marketplace checkout",
      explanation:
        "The seller keeps payment inside Circuitry Market (and said so when asked about paying directly), so your purchase keeps the marketplace's return process.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["buy_after_checking"],
      weight: 3,
      keywords: [
        "checkout",
        "through the site",
        "pay directly",
        "on the platform",
        "marketplace checkout",
        "paypal",
      ],
    },
    {
      evidenceId: "returns_and_tracking",
      targetElementId: "return_policy",
      evidenceType: "positive_verification_evidence",
      title: "Clear returns and tracked delivery",
      explanation:
        "A 30-day return window through the marketplace and tracked shipping are signs of an ordinary sale.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["buy_after_checking"],
      weight: 2,
      keywords: ["return", "30 days", "tracking", "tracked", "delivery", "warranty"],
    },
    {
      evidenceId: "consistent_price",
      targetElementId: "product_price",
      evidenceType: "positive_verification_evidence",
      title: "A price in line with similar laptops",
      explanation:
        "The Aster 14 costs about the same as comparable laptops on the same market. Nothing about the price is too good to be true.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["buy_after_checking"],
      weight: 2,
      keywords: ["price", "compared", "similar", "reasonable", "not too cheap", "other laptops"],
    },
    {
      evidenceId: "real_domain",
      targetElementId: "displayed_domain",
      evidenceType: "positive_verification_evidence",
      title: "The address is the marketplace you meant to use",
      explanation: "The address bar shows circuitrymarket.example, the marketplace itself, not a look-alike.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["buy_after_checking"],
      weight: 1,
      keywords: ["address", "url", "domain", "web address", "circuitrymarket"],
    },
    {
      evidenceId: "mixed_reviews",
      targetElementId: "product_reviews",
      evidenceType: "worth_verifying",
      title: "Mostly good reviews, with an honest complaint",
      explanation:
        "A low review about a courier delay isn't a warning sign. Real listings have mixed reviews; reading a few, including the negative ones, is good practice.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["buy_after_checking"],
      weight: 1,
      keywords: ["reviews", "2 stars", "delay", "negative review", "mixed"],
    },
  ],
  verificationActions: [
    { actionId: "view_seller_profile", weight: 3 },
    { actionId: "read_reviews", weight: 2 },
    { actionId: "inspect_address", weight: 1 },
    { actionId: "ask_direct_payment", weight: 1 },
  ],
  unsafeActionIds: [],
  payableDecisionIds: ["place_order"],
  paymentOutcome: "spending",
  recoveryPolicyIds: ["protection", "disputes"],
  fallbackContent: {
    outcomeByDecision: {
      place_order:
        "In the story, the laptop shipped the same day with tracking and arrived as described: an ordinary purchase.",
      skip_purchase:
        "In the story, you kept your money, but this was a genuine listing, so you missed a laptop that met your needs.",
      report_listing:
        "In the story, the marketplace reviewed the listing and found nothing wrong. Reporting is useful, but this seller was genuine.",
    },
    feedbackCorrect:
      "Nicely done. You checked the seller and the checkout and recognized the signs of a genuine sale. Spotting what's right matters as much as spotting what's wrong.",
    feedbackIncorrect:
      "Being careful is a good instinct. This time the evidence pointed the other way: long seller history, consistent price, and payment kept in the marketplace checkout.",
    safestNextStep:
      "Buy through the marketplace's own checkout, keep the order confirmation, and use its return process if anything goes wrong.",
    keyLessons: [
      "Not every purchase is risky: look for positive evidence as well as warning signs.",
      "Keep payment inside the marketplace's checkout.",
      "A single negative review about delivery isn't proof of anything.",
    ],
  },
};
