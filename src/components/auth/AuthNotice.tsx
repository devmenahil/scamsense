import { FeedbackBanner, type FeedbackTone } from "@/components/ui/FeedbackBanner";

/** Calm notices shown on the auth pages after redirects (`?notice=`). Unknown keys are ignored. */
const NOTICES = {
  signed_out: { tone: "info", title: "You're signed out.", body: "See you next time." },
  expired: { tone: "info", title: "Your session has ended.", body: "Please sign in again to continue." },
  link_invalid: {
    tone: "look-again",
    title: "That link didn't work.",
    body: "It may have expired or already been used. Sign in, or request a new link.",
  },
  password_updated: { tone: "success", title: "Password updated.", body: "You're all set." },
  unavailable: {
    tone: "look-again",
    title: "Accounts are temporarily unavailable.",
    body: "Please try again later.",
  },
} as const satisfies Record<string, { tone: FeedbackTone; title: string; body: string }>;

export type NoticeKey = keyof typeof NOTICES;

export function toNoticeKey(value: unknown): NoticeKey | undefined {
  return typeof value === "string" && value in NOTICES ? (value as NoticeKey) : undefined;
}

export function AuthNotice({ notice, className }: { notice: NoticeKey; className?: string }) {
  const n = NOTICES[notice];
  return (
    <div className={className}>
      <FeedbackBanner tone={n.tone} title={n.title} live>
        {n.body}
      </FeedbackBanner>
    </div>
  );
}
