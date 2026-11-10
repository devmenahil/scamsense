import type { Metadata } from "next";
import { DISTINCTIONS } from "@/content/playbook/distinctions";
import { POLICY_KB_VERSION, POLICY_RECORDS, POLICY_TOPICS, TOPIC_LABELS } from "@/content/playbook/policies";
import { policyView } from "@/lib/recovery/playbook";
import { PolicyCard } from "@/components/playbook/PolicyCard";
import { Icon } from "@/components/icons/Icon";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Your Recovery Playbook" };

/**
 * Public Recovery Playbook (R21, R30): the versioned U.S. PayPal knowledge base (src/content/playbook), grouped by
 * topic. Verified pages show their transcribed facts with the verification date; pages ScamSense couldn't verify
 * show only their official link. No scenario-specific content (that is shown per completed attempt).
 */
export default function PlaybookPage() {
  const general = (
    [
      "report_message_vs_transaction",
      "authorized_vs_unauthorized",
      "protection_not_guarantee",
      "seller_payment_proof",
      "educational_not_case",
    ] as const
  ).map((id) => ({ id, ...DISTINCTIONS[id] }));
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Your Recovery Playbook"
        title="If something goes wrong, here's your plan"
        description="Calm, practical pointers for U.S. PayPal users, linked to PayPal's own pages. Each source shows when ScamSense last verified it."
      />

      <p className="mt-5 inline-flex items-center gap-2 rounded-pill bg-mist px-3 py-1.5 text-caption font-semibold">
        <Icon name="info" className="size-4" />
        Based on U.S. PayPal policies. Eligibility and terms apply.
      </p>

      <FeedbackBanner tone="info" title="Need help with a real problem?" className="mt-5">
        Contact PayPal through its official app or a website address you type in yourself. ScamSense is an
        educational simulator: it can&apos;t file reports or disputes for you and never promises a refund.
      </FeedbackBanner>

      {POLICY_TOPICS.map((topic) => {
        const records = POLICY_RECORDS.filter((r) => r.topic === topic);
        if (records.length === 0) return null;
        return (
          <section key={topic} id={topic} className="mt-10" aria-labelledby={`topic-${topic}`}>
            <h2 id={`topic-${topic}`} className="text-subheading font-bold">
              {TOPIC_LABELS[topic]}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {records.map((r) => (
                <PolicyCard key={r.policyId} p={policyView(r)} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="mt-10" aria-labelledby="good-to-know">
        <h2 id="good-to-know" className="text-subheading font-bold">
          Good to know
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {general.map((l) => (
            <details key={l.id} className="group rounded-card border-2 border-teal/25 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-heading font-extrabold">
                {l.title}
                <Icon name="arrow-right" className="size-4 shrink-0 rotate-90 group-open:-rotate-90" />
              </summary>
              <p className="mt-2 text-small">{l.text}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-8 text-caption text-teal/85">Knowledge base version {POLICY_KB_VERSION}.</p>
    </div>
  );
}
