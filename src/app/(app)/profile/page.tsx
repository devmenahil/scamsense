import type { Metadata } from "next";
import { DEMO_USER } from "@/lib/demo/demoData";
import { Icon } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "My Profile" };

const ROWS: { label: string; value: string }[] = [
  { label: "Display name", value: DEMO_USER.displayName },
  { label: "Age bracket", value: DEMO_USER.ageBracket },
  { label: "Profession or life stage", value: DEMO_USER.lifeStage },
  { label: "Digital payment experience", value: DEMO_USER.paymentExperience },
  { label: "Financial goal", value: DEMO_USER.financialGoal },
  { label: "Income bracket", value: DEMO_USER.incomeBracket },
];

export default function ProfilePage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6" />
      <PageHeader
        eyebrow="My Profile"
        title={DEMO_USER.displayName}
        description="These details personalise your scenarios and feedback. They never change what counts as the right decision."
        actions={
          <ButtonLink
            href="/onboarding"
            variant="secondary"
            iconLeft={<Icon name="user" className="size-5" />}
          >
            Edit profile
          </ButtonLink>
        }
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card as="section" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-subheading font-bold">
            About you
          </h2>
          <dl className="mt-4 divide-y-2 divide-mist">
            {ROWS.map((r) => (
              <div key={r.label} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
                <dt className="text-small font-semibold">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
            <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="text-small font-semibold">Financial activities</dt>
              <dd className="flex flex-wrap gap-2">
                {DEMO_USER.financialActivities.map((a) => (
                  <Badge key={a} tone="mist">
                    {a}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="flex flex-col gap-5">
          <Card tone="mist" as="section" aria-labelledby="currency-heading">
            <h2 id="currency-heading" className="font-heading text-lg font-extrabold">
              Preferred currency
            </h2>
            <p className="mt-2 font-heading text-[1.75rem] leading-9 font-black">{DEMO_USER.currency}</p>
            <p className="mt-2 text-small">
              Changes apply from the next module you start. A module already in progress keeps its currency.
            </p>
          </Card>
          <Card as="section" aria-labelledby="privacy-heading">
            <h2 id="privacy-heading" className="flex items-center gap-2 font-heading text-lg font-extrabold">
              <Icon name="shield" className="size-5" />
              Your privacy
            </h2>
            <p className="mt-2 text-small text-teal/90">
              ScamSense collects only what it needs to personalise training. It never asks for real passwords,
              one-time codes, card numbers, or bank details.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
