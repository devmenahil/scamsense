/** Sensei Kenshi API types shared by the server and the chat UI (Step 10). Client-safe: no answer-key data. */

/** An official U.S. PayPal page from the Step 9 knowledge base, attached by the server (never typed by the model). */
export interface KenshiSource {
  policyId: string;
  title: string;
  url: string;
  verified: boolean;
  lastVerified: string | null;
}

export type KenshiContextLabel =
  | { mode: "general" }
  | { mode: "attempt"; attemptId: string; title: string; isPractice: boolean; attemptNumber: number };

export interface KenshiReply {
  reply: string;
  sources: KenshiSource[];
  followUps: string[];
  context: KenshiContextLabel;
}

/** A completed attempt the learner can choose to discuss (titles and ids only). */
export interface DiscussableAttempt {
  attemptId: string;
  title: string;
  isPractice: boolean;
  attemptNumber: number;
}
