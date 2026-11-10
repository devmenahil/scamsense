/**
 * Recovery Playbook — authored "conditions and limitations" (Step 9 brief §12). These are ScamSense's own statements
 * about how to READ PayPal's guidance (and about ScamSense itself). They contain no deadline, procedure, refund
 * condition, or outcome; where they mention a PayPal term (the Unauthorized Transaction definition, "sole
 * discretion"), it is one verified in policies.ts on 2026-11-10. Only the facts in policies.ts are PayPal's words.
 */
export const DISTINCTIONS = {
  authorized_vs_unauthorized: {
    title: "Unauthorized vs. a payment you were tricked into approving",
    text: "PayPal's User Agreement defines an Unauthorized Transaction as money sent from your account that you did not authorize and that did not benefit you, such as a payment made by someone who stole your password. A payment you approved yourself, even because someone deceived you, isn't the situation that definition describes. For a purchase, Purchase Protection may be relevant instead, under its own requirements and exclusions.",
  },
  report_message_vs_transaction: {
    title: "Reporting a message vs. reporting a payment",
    text: "Forwarding a suspicious email or text to phishing@paypal.com reports the message. It doesn't report or dispute a payment: a transaction you didn't make or authorize is reported separately, in PayPal's Resolution Center.",
  },
  protection_not_guarantee: {
    title: "Protection programs aren't guarantees",
    text: "Purchase Protection and Seller Protection have their own eligibility requirements and exclusions, set by PayPal in the official terms, and PayPal decides each claim in its sole discretion. Reporting a problem or opening a dispute never guarantees a refund or reimbursement.",
  },
  seller_payment_proof: {
    title: "A payment claim isn't a payment",
    text: "A screenshot, an email, or a message saying you've been paid doesn't prove the money arrived. Sign in to your payment account yourself (not through a link in the message) and check that the payment is really there before you ship.",
  },
  legit_problem_not_fraud: {
    title: "A problem isn't always a scam",
    text: "If something goes wrong with a genuine purchase, such as a delivery delay or a faulty item, that's a problem to resolve with the seller and the marketplace, not proof that the seller was dishonest.",
  },
  sandbox_not_coverage: {
    title: "Sandbox checkout isn't real coverage",
    text: "Your ScamSense checkout used PayPal Sandbox test money. A successful Sandbox payment says nothing about whether a real payment would qualify for any PayPal protection.",
  },
  training_funds: {
    title: "Training Funds aren't real money",
    text: "Training Funds are fictional. Nothing you spent or lost in ScamSense was real money, and nothing here can be recovered or refunded.",
  },
  educational_not_case: {
    title: "Education, not a case decision",
    text: "This Playbook is education based on U.S. PayPal guidance. ScamSense isn't a PayPal support channel: it can't report, dispute, or file anything for you, and it can't tell you how PayPal would decide a real case.",
  },
} as const;

export type DistinctionId = keyof typeof DISTINCTIONS;
export const DISTINCTION_IDS = Object.keys(DISTINCTIONS) as DistinctionId[];
