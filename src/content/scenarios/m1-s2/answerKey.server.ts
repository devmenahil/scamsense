import "server-only";
import type { AuthoredAnswerKeyInput } from "../templateSchema";

/** M1-S2 — Your Account Needs Attention. SERVER-ONLY answer key (R10, R15). */
export const answerKey: AuthoredAnswerKeyInput = {
  scenarioKey: "m1-s2",
  primaryCategory: "phishing_fake_websites",
  secondaryCategoryTags: ["otp_social_engineering"],
  learningObjectives: [
    "Read the full web address and sender address instead of trusting a familiar logo or name.",
    "Open your bank yourself (saved shortcut, typed address, or app) instead of using a link in an unexpected email.",
    "Notice deadlines and threats that push you to act before checking.",
  ],
  // "subscriptions": an account notification email (Step 8 routing: subscriptions → account notifications).
  activityTags: ["digital_wallet_usage", "account_security", "subscriptions"],
  contextTags: [
    "general_consumer",
    "student",
    "employed_professional",
    "retired",
    "job_seeker",
    "freelancer",
    "business_owner",
    "self_employed",
  ],
  difficulty: {
    recommendedExperienceLevel: "new",
    interactionComplexity: "medium",
    numberOfDecisionPoints: 2,
  },
  fixedScamStatus: "fraudulent",
  fixedCorrectDecisionRules: [
    {
      ruleId: "use_official_channel",
      description:
        "Don't act through an unexpected email link. Report or delete the email and check your account through the bank's own site or app.",
      decisionIds: ["report_email", "delete_email"],
    },
  ],
  evidenceDefinitions: [
    {
      evidenceId: "lookalike_domain",
      targetElementId: "displayed_domain",
      evidenceType: "red_flag",
      title: "spasebank.example is not spacebank.example",
      explanation:
        "The page from the email uses a web address one letter away from the bank's real one. The logo and colours can be copied; the real address can't.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 3,
      keywords: [
        "spasebank",
        "address bar",
        "web address",
        "url",
        "domain",
        "misspelled",
        "spelling",
        "one letter",
      ],
    },
    {
      evidenceId: "sender_domain",
      targetElementId: "sender_address",
      evidenceType: "red_flag",
      title: "The email came from the same look-alike domain",
      explanation:
        "The sender address uses spasebank.example. Your genuine statement email came from spacebank.example.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 3,
      keywords: ["sender", "email address", "from address", "alerts@", "spasebank"],
    },
    {
      evidenceId: "official_status",
      targetElementId: "account_status",
      evidenceType: "red_flag",
      title: "Your real account showed no restriction",
      explanation:
        "On the bank's own site the account was active, transfers were available, and there were no messages. The claim in the email didn't hold up.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 3,
      keywords: [
        "real site",
        "official site",
        "bookmark",
        "shortcut",
        "no messages",
        "active",
        "no restriction",
      ],
    },
    {
      evidenceId: "deadline",
      targetElementId: "restore_timeframe",
      evidenceType: "red_flag",
      title: "A 24-hour deadline and a threat",
      explanation: "Threatening suspension within hours is a common way to rush people past checking.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 2,
      keywords: ["24 hours", "deadline", "suspended", "urgent", "threat", "pressure"],
    },
    {
      evidenceId: "link_in_email",
      targetElementId: "email_button",
      evidenceType: "red_flag",
      title: "A sign-in style link inside the email",
      explanation:
        "The button sends you to a page chosen by the sender. Going to the bank yourself avoids that entirely.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 2,
      keywords: ["link", "button", "restore access", "clicked", "click"],
    },
    {
      evidenceId: "bank_link_policy",
      targetElementId: "statement_footer",
      evidenceType: "worth_verifying",
      title: "Your bank's earlier email said it never sends sign-in links",
      explanation: "Comparing with a message you already know is genuine is a strong, quick check.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 2,
      keywords: ["earlier email", "statement", "never contain", "compared", "previous email"],
    },
    {
      evidenceId: "generic_greeting",
      targetElementId: "greeting",
      evidenceType: "worth_verifying",
      title: '"Dear customer" instead of your name',
      explanation: "A generic greeting isn't proof on its own, but your bank's real emails used your name.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["use_official_channel"],
      weight: 1,
      keywords: ["dear customer", "generic", "my name", "didn't use my name"],
    },
  ],
  verificationActions: [
    { actionId: "check_sender_details", weight: 2 },
    { actionId: "inspect_address", weight: 3 },
    { actionId: "open_bank_bookmark", weight: 3 },
    { actionId: "check_bank_messages", weight: 1 },
    { actionId: "open_previous_email", weight: 1 },
  ],
  unsafeActionIds: ["continue_verification"],
  payableDecisionIds: [],
  paymentOutcome: "none",
  recoveryPolicyIds: ["secure-account", "unauthorized-activity", "report-further"],
  fallbackContent: {
    outcomeByDecision: {
      continue_verification:
        "In the story, the page went on to ask for your online banking details, which would have gone to whoever runs spasebank.example.",
      report_email:
        "In the story, the email was reported and removed, and your real account was never affected.",
      delete_email: "In the story, nothing happened to your real account: it had never been restricted.",
    },
    feedbackCorrect:
      "Nice work. You didn't let a familiar name and logo decide for you, and you kept your bank details away from a page you didn't open yourself.",
    feedbackIncorrect:
      "Look again at the web address: it was one letter off. Look-alike pages copy the logo and wording perfectly, so the address is what counts.",
    safestNextStep:
      "Report the email, then open your bank through a saved shortcut, a typed address, or its app to check for any real notices.",
    keyLessons: [
      "Read the whole web address. One changed letter makes it someone else's site.",
      "Open your bank yourself instead of following a link in an unexpected email.",
      "A padlock means the connection is encrypted, not that the site belongs to your bank.",
    ],
  },
};
