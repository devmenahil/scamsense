import "server-only";
import type { AuthoredAnswerKeyInput } from "../templateSchema";

/** M3-S1 — The Job Opportunity. SERVER-ONLY answer key (R10, R15). */
export const answerKey: AuthoredAnswerKeyInput = {
  scenarioKey: "m3-s1",
  primaryCategory: "advance_fee_job_investment",
  secondaryCategoryTags: ["fake_invoices_impersonation"],
  learningObjectives: [
    "Recognize an upfront fee as the price of a job, contract, or prize as a defining sign of advance-fee fraud.",
    "Verify an employer independently through its own website and official contact details.",
    "Notice how several small inconsistencies add up: a different role, a new profile, and no contact with the employer.",
  ],
  activityTags: ["job_seeking", "freelancing", "digital_wallet_usage"],
  contextTags: ["job_seeker", "student", "freelancer", "self_employed", "general_consumer"],
  difficulty: {
    recommendedExperienceLevel: "frequent",
    interactionComplexity: "high",
    numberOfDecisionPoints: 3,
  },
  fixedScamStatus: "fraudulent",
  fixedCorrectDecisionRules: [
    {
      ruleId: "no_fee_for_jobs",
      description:
        "Don't pay to receive a job, contract, or equipment. Decline or report, and contact the employer directly through its own website.",
      decisionIds: ["decline_offer", "report_recruiter"],
    },
  ],
  evidenceDefinitions: [
    {
      evidenceId: "upfront_fee",
      targetElementId: "onboarding_message",
      evidenceType: "red_flag",
      title: "A fee before you get a contract",
      explanation:
        'Being asked to pay before you\'re employed, even as a "refundable deposit", is the core of advance-fee job fraud.',
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 3,
      keywords: ["fee", "deposit", "pay to", "upfront", "refundable", "equipment", "payment request"],
    },
    {
      evidenceId: "contract_after_payment",
      targetElementId: "contract_reply",
      evidenceType: "red_flag",
      title: "The contract only comes after you pay",
      explanation: "A genuine employer gives you the contract to read before anything else happens.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 3,
      keywords: ["contract", "after paying", "no contract", "before paying", "generated"],
    },
    {
      evidenceId: "company_process",
      targetElementId: "company_hiring",
      evidenceType: "red_flag",
      title: "The company says it hires differently",
      explanation:
        "Meridian's own careers page says candidates meet the hiring manager on video, offers come from its own domain, and equipment is free.",
      educationalImportance: "core",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 3,
      keywords: [
        "careers page",
        "company website",
        "official site",
        "video call",
        "no cost",
        "free equipment",
        "hiring process",
      ],
    },
    {
      evidenceId: "role_not_listed",
      targetElementId: "company_roles",
      evidenceType: "red_flag",
      title: "The remote role isn't on the company's site",
      explanation:
        "Meridian lists only on-site and hybrid roles. The offered remote role doesn't appear at all.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 2,
      keywords: ["not listed", "open roles", "remote", "isn't on", "doesn't exist", "job list"],
    },
    {
      evidenceId: "role_mismatch",
      targetElementId: "application_details",
      evidenceType: "worth_verifying",
      title: "A different job from the one you applied for",
      explanation:
        "You applied for an on-site Operations Assistant role, but the offer is for a remote role at a much higher salary.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 2,
      keywords: ["applied", "application", "different role", "operations assistant", "on-site", "mismatch"],
    },
    {
      evidenceId: "no_manager",
      targetElementId: "manager_reply",
      evidenceType: "red_flag",
      title: "No way to speak to the employer",
      explanation: "Every route to the actual company was blocked, and only the recruiter speaks for it.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 2,
      keywords: ["hiring manager", "video call", "travelling", "can't speak", "only the recruiter"],
    },
    {
      evidenceId: "pressure",
      targetElementId: "confirm_paragraph",
      evidenceType: "red_flag",
      title: "A 24-hour hold on the offer",
      explanation: '"Confirm today" and "spots are filling fast" are there to stop you from checking.',
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 2,
      keywords: ["24 hours", "today", "filling fast", "pressure", "deadline", "urgent"],
    },
    {
      evidenceId: "recruiter_domain",
      targetElementId: "recruiter_address",
      evidenceType: "worth_verifying",
      title: "The offer didn't come from the company",
      explanation:
        "The email came from a staffing-agency domain, not meridianlogistics.example. Agencies are real, but the employer should be able to confirm them.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 1,
      keywords: ["email address", "domain", "talentbridge", "agency", "not the company"],
    },
    {
      evidenceId: "new_profiles",
      targetElementId: "chat_contact",
      evidenceType: "worth_verifying",
      title: "Brand-new accounts",
      explanation:
        "The chat account and the public profile were both created three weeks ago. New isn't proof, but it's worth weighing with everything else.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 1,
      keywords: ["new account", "3 weeks", "profile", "connections", "created"],
    },
    {
      evidenceId: "high_salary",
      targetElementId: "offer_paragraph",
      evidenceType: "worth_verifying",
      title: "Generous pay after a text-only interview",
      explanation:
        "An attractive offer after a short text chat is worth checking, not celebrating straight away.",
      educationalImportance: "supporting",
      associatedCorrectDecisionRules: ["no_fee_for_jobs"],
      weight: 1,
      keywords: ["salary", "pay", "too good", "text interview", "high"],
    },
  ],
  verificationActions: [
    { actionId: "open_company_careers", weight: 3 },
    { actionId: "check_recruiter_details", weight: 2 },
    { actionId: "open_application_email", weight: 2 },
    { actionId: "ask_contract_first", weight: 1 },
    { actionId: "ask_hiring_manager", weight: 1 },
    { actionId: "check_chat_profile", weight: 1 },
    { actionId: "open_recruiter_profile", weight: 1 },
  ],
  unsafeActionIds: ["pay_fee"],
  payableDecisionIds: ["pay_fee"],
  paymentOutcome: "fraud_loss",
  recoveryPolicyIds: ["unauthorized-activity", "disputes", "report-further"],
  fallbackContent: {
    outcomeByDecision: {
      pay_fee:
        "In the story, the deposit went to ProEquip Onboarding Services, the recruiter stopped replying, and no contract ever arrived.",
      decline_offer: "In the story, you kept your money. Meridian Logistics had never heard of the offer.",
      report_recruiter:
        "In the story, the account was reported and removed, and other job seekers didn't receive the same offer.",
    },
    feedbackCorrect:
      "Excellent judgment. You didn't pay to get a job, and you looked past an attractive offer to how the employer really hires.",
    feedbackIncorrect:
      "Job offers can feel exciting, and this one was built to. A real employer gives you a contract before asking for anything, and never charges you to start.",
    safestNextStep:
      "Contact the company through its own website or main phone line, and don't pay anything until you have a signed contract from the employer.",
    keyLessons: [
      "Never pay to get a job, a contract, or work equipment.",
      "Check the role on the employer's own website, not through the recruiter.",
      "Several small inconsistencies together are strong evidence.",
    ],
  },
};
