import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_ATTEMPT_ID, DEMO_WALLET } from "@/lib/demo/demoData";
import { formatMinorUnits } from "@/lib/format";
import {
  EVIDENCE_META,
  EvidenceLabel,
  EvidenceMarker,
  type EvidenceClass,
} from "@/components/feedback/EvidenceLabel";
import { Icon } from "@/components/icons/Icon";
import { LogoSymbol } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Scenario results" };

type Props = { params: Promise<{ attemptId: string }> };

/**
 * DEMONSTRATION evidence for the results shell. Real evidence comes from the server-only answer key and is only
 * served once an attempt is COMPLETED (Phase 7). Wording avoids asserting that the demo message is fraudulent.
 */
const DEMO_EVIDENCE: {
  n: number;
  kind: EvidenceClass;
  title: string;
  explanation: string;
  mentioned: boolean;
}[] = [
  {
    n: 1,
    kind: "verify",
    title: "Sender address",
    explanation:
      "Display names are easy to set. Opening the details to compare the address with ones you've seen before is a good habit.",
    mentioned: true,
  },
  {
    n: 2,
    kind: "verify",
    title: "Pay button inside the email",
    explanation:
      "Paying from an email link is convenient, but you can always go to the provider's site or app yourself instead.",
    mentioned: false,
  },
  {
    n: 3,
    kind: "positive",
    title: "Specific, consistent details",
    explanation:
      "The amount, due date, and account ending match each other, with no pressure to act right away.",
    mentioned: true,
  },
];

export default async function ResultsPage({ params }: Props) {
  const { attemptId } = await params;
  if (attemptId !== DEMO_ATTEMPT_ID) notFound();
  const mentioned = DEMO_EVIDENCE.filter((e) => e.mentioned).length;
  const balance = formatMinorUnits(
    DEMO_WALLET.balanceMinor,
    DEMO_WALLET.currency,
    DEMO_WALLET.minorUnitDigits,
  );

  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6">
        This results screen is a design shell. The decision, feedback, and evidence shown are examples only.
      </DemoNotice>
      <PageHeader eyebrow="Spot the Trap · Scenario 2 (demo)" title="Your results" />

      {/* Praise first (R37) */}
      <FeedbackBanner tone="success" title="Nice thinking!" className="mt-6">
        You explained your decision clearly. You spotted {mentioned} of {DEMO_EVIDENCE.length} key clues.
      </FeedbackBanner>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="label-eyebrow text-teal/80">Your decision</p>
          <p className="mt-1 flex items-center gap-2 font-heading text-subheading font-bold">
            <Icon name="lock" className="size-5" />
            Report message
          </p>
          <p className="mt-3 text-teal/90">
            Outcome text for the chosen decision appears here. It is authored with each scenario and decided
            by the answer key, never by AI.
          </p>
        </Card>
        <Card tone="mist">
          <p className="label-eyebrow text-teal/80">Training funds</p>
          <p className="mt-1 font-heading text-[1.75rem] leading-9 font-black">{balance}</p>
          <p className="mt-2 text-small">No change in this scenario. Fictional money only.</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-subheading font-bold">Feedback on your reasoning</h2>
          <p className="mt-3 text-teal/90">
            Personalised feedback on your reasoning appears here, grounded in this scenario&apos;s fixed
            evidence. If AI feedback is unavailable, authored feedback is shown instead.
          </p>
        </Card>
        {/* Humour is a separate field, shown separately (R14). */}
        <Card tone="teal" className="flex items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-tile bg-white">
            <LogoSymbol className="w-7" />
          </span>
          <div>
            <p className="font-heading font-extrabold">Sensei Kenshi says</p>
            <p className="mt-1 text-small text-white/90">
              A short, light-hearted comment written just for you lands here.
            </p>
          </div>
        </Card>
      </div>

      <Card tone="yellow-tint" className="mt-5 flex items-start gap-3">
        <Icon name="shield" className="mt-0.5 size-6" />
        <div>
          <h2 className="font-heading text-lg font-extrabold">Safest next step</h2>
          <p className="mt-1 text-small">
            When a bill arrives by email, open the provider&apos;s website or app yourself to check and pay
            it.
          </p>
        </div>
      </Card>

      {/* Reveal the Red Flags (R15, R16) */}
      <section aria-labelledby="reveal-title" className="mt-12">
        <h2 id="reveal-title" className="text-heading font-extrabold">
          Reveal the Red Flags
        </h2>
        <p className="mt-2 max-w-2xl text-teal/90">
          Here&apos;s the scenario again with every piece of evidence marked. Not every observation is proof
          of fraud, so each one is labelled.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Evidence labels">
          {(Object.keys(EVIDENCE_META) as EvidenceClass[]).map((k) => (
            <li key={k} className="flex items-center gap-2 text-caption">
              <EvidenceLabel kind={k} />
              <span className="hidden sm:inline">{EVIDENCE_META[k].description}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* Re-rendered environment (static) with numbered markers */}
          <div className="self-start rounded-panel border-2 border-teal bg-white p-5 sm:p-6">
            <p className="font-heading text-lg font-extrabold">Your October statement is ready</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-small">
              <span className="font-semibold">Maple Street Utilities</span>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-mist px-2 py-0.5 break-all">
                statements@maplestreet-utilities.example
              </span>
              <EvidenceMarker n={1} kind="verify" />
            </div>
            <p className="mt-4 flex items-start gap-2">
              <span>
                The amount due this month is $72.40, payable by November 20, for the account ending 2048.
              </span>
              <EvidenceMarker n={3} kind="positive" />
            </p>
            <div className="mt-5 flex items-center gap-2">
              <span className="inline-flex min-h-11 items-center rounded-[6px] bg-teal-shade px-5 font-semibold text-white">
                Pay bill
              </span>
              <EvidenceMarker n={2} kind="verify" />
            </div>
          </div>

          <ol className="flex flex-col gap-3">
            {DEMO_EVIDENCE.map((e) => (
              <li key={e.n} className="rounded-card border-2 border-teal/25 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <EvidenceMarker n={e.n} kind={e.kind} />
                  <span className="font-heading font-extrabold">{e.title}</span>
                  <EvidenceLabel kind={e.kind} />
                  {e.mentioned && (
                    <Badge tone="mist" icon={<Icon name="chat" className="size-3.5" />}>
                      You mentioned this
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-small text-teal/90">{e.explanation}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Recovery Playbook */}
      <Card tone="mist" className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
        <IconTile name="book" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-extrabold">Your Recovery Playbook</h2>
          <p className="text-small text-teal/90">
            The sections most relevant to this scenario will be listed here, from verified U.S. PayPal
            sources.
          </p>
        </div>
        <Link
          href="/playbook"
          className="inline-flex min-h-11 items-center gap-1.5 font-heading font-extrabold underline decoration-2 underline-offset-4"
        >
          Open the Playbook
        </Link>
      </Card>

      <div className="mt-10 flex justify-center">
        <ButtonLink
          href="/modules/spot-the-trap"
          size="lg"
          iconRight={<Icon name="arrow-right" className="size-5" />}
        >
          Back to module
        </ButtonLink>
      </div>
    </div>
  );
}
