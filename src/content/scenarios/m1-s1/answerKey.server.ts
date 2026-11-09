import "server-only";
import type { AuthoredAnswerKeyInput } from "../templateSchema";

/** M1-S1 — The Security Check. SERVER-ONLY answer key: never sent to the browser before completion (R10, R15). */
export const answerKey: AuthoredAnswerKeyInput = {
  scenarioKey: "m1-s1",
  primaryCategory: "otp_social_engineering",
  secondaryCategoryTags: ["fake_invoices_impersonation"],
  learningObjectives: [
    "Never share a one-time verification code with anyone, including someone who says they are support staff.",
    "Check an unexpected account alert yourself in the official app or through its listed contact details.",
    "Recognize time pressure as a way to stop you from checking.",
  ],
  activityTags: ["digital_wallet_usage", "account_security"],
  contextTags: [
    "general_consumer",
    "student",
    "employed_professional",
    "retired",
    "freelancer",
    "business_owner",
    "self_employed",
    "job_seeker",
  ],
  difficulty: { recommendedExperienceLevel: "new", interactionComplexity: "low", numberOfDecisionPoints: 2 },
  fixedScamStatus: "fraudulent",
  fixedCorrectDecisionRules: [
    {
      ruleId: "never_share_codes",
      description:
        "Verification codes are only for signing in yourself. Don't share the code; end the conversation and check through the official app.",
      decisionIds: ["block_report", "delete_conversation"],
    },
  ],
  evidenceDefinitions: [
    {
      evidenceId: "asked_for_code",
      targetElementId: "code_request",
      evidenceType: "red_flag",
      title: "Someone asked for your verification code",
      explanation:
        "A one-time code lets someone finish signing in to your account. Genuine support teams don't need you to read a code back to them.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 3,
      keywords: ["code", "otp", "verification", "one-time", "share the code", "asked for"],
    },
    {
      evidenceId: "code_purpose",
      targetElementId: "code_text",
      evidenceType: "red_flag",
      title: "The code was for signing in on a new device",
      explanation:
        "The text with the code says it's for a sign-in on a new device, not for cancelling a payment. The story in the chat doesn't match what the code does.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 3,
      keywords: ["sign in", "new device", "never call", "never message", "doesn't match", "code message"],
    },
    {
      evidenceId: "signin_attempt",
      targetElementId: "security_event",
      evidenceType: "red_flag",
      title: "Your app showed a sign-in attempt",
      explanation:
        "The TandemPay app shows someone tried to sign in from a new device at the same time. Sharing the code would have let them in.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 3,
      keywords: ["sign-in attempt", "security", "new device", "chrome", "someone tried", "login attempt"],
    },
    {
      evidenceId: "no_payment_in_app",
      targetElementId: "account_activity",
      evidenceType: "red_flag",
      title: "No such payment in your own activity",
      explanation:
        "Your app's activity and pending payments show no transfer to L. Novak. Checking the official app is the quickest way to test a claim like this.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 2,
      keywords: ["activity", "no payment", "pending", "app", "checked the app", "balance"],
    },
    {
      evidenceId: "unknown_number",
      targetElementId: "sender_number",
      evidenceType: "worth_verifying",
      title: "An unsaved number started the conversation",
      explanation:
        "Anyone can name a chat 'Support'. A message from a number you haven't saved is worth checking against the contact details in the official app.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 2,
      keywords: ["number", "unknown", "not saved", "contacted me", "unsolicited", "random"],
    },
    {
      evidenceId: "time_pressure",
      targetElementId: "followup_message",
      evidenceType: "red_flag",
      title: "A five-minute deadline",
      explanation:
        "Pressure to act within minutes leaves no time to check. A genuine team can still help after you call the official number.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 2,
      keywords: ["5 minutes", "five minutes", "urgent", "pressure", "hurry", "quick", "deadline"],
    },
    {
      evidenceId: "discouraged_checking",
      targetElementId: "callback_reply",
      evidenceType: "red_flag",
      title: "They discouraged you from calling the official number",
      explanation:
        "Steering you away from the official contact route is a strong sign the person doesn't want you to check.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 2,
      keywords: ["call", "official number", "queue", "didn't want", "discouraged", "no time"],
    },
    {
      evidenceId: "claimed_payment",
      targetElementId: "payment_details_reply",
      evidenceType: "worth_verifying",
      title: "A payment you didn't recognize",
      explanation:
        "An alert about an unknown payment is worth taking seriously, but check it yourself in the app instead of inside the conversation.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["never_share_codes"],
      weight: 1,
      keywords: ["payment", "transfer", "l. novak", "recipient"],
    },
  ],
  verificationActions: [
    { actionId: "open_tandempay_app", weight: 2 },
    { actionId: "check_security_activity", weight: 3 },
    { actionId: "check_sender_details", weight: 1 },
    { actionId: "open_app_help", weight: 1 },
  ],
  unsafeActionIds: ["send_code"],
  payableDecisionIds: [],
  paymentOutcome: "none",
  recoveryPolicyIds: ["secure-account", "unauthorized-activity"],
  fallbackContent: {
    outcomeByDecision: {
      send_code:
        "In the story, the code let the other person finish signing in to your TandemPay account from their device.",
      block_report:
        "In the story, the conversation stopped and nobody got into your account. Reporting the number helps protect others.",
      delete_conversation:
        "In the story, the sign-in attempt failed without the code, and your account stayed yours.",
    },
    feedbackCorrect:
      "Well done. You kept your verification code to yourself, which is exactly what protects your account when someone else is trying to sign in.",
    feedbackIncorrect:
      "This one was tricky because the message sounded helpful. A verification code is only for you to sign in. Anyone asking for it can use it to get into your account.",
    safestNextStep:
      "End the conversation, open the official app yourself, review your security activity, and contact support only through the details listed in the app.",
    keyLessons: [
      "Never share a one-time code, even with someone who says they work for the company.",
      "Check alerts in the official app instead of replying in the message.",
      "Deadlines measured in minutes are designed to stop you from checking.",
    ],
  },
};
