import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FeedbackBanner } from "@/components/ui/FeedbackBanner";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Your Recovery Playbook" };

/**
 * Recovery Playbook shell (R21, R30). Only section TOPICS are listed (PRODUCT_SPEC §6). No policy statements,
 * timelines, statistics, or guarantees appear until each section is transcribed from official U.S. PayPal sources
 * with a source URL and a "last verified" date (Phase 10).
 */
const SECTIONS: { id: string; title: string; summary: string; icon: IconName }[] = [
  {
    id: "unauthorized-activity",
    title: "Report unauthorized activity",
    summary: "What to do first if you notice a payment or login you don't recognise.",
    icon: "report",
  },
  {
    id: "disputes",
    title: "Disputes and the Resolution Center",
    summary: "How to raise a problem with a purchase or a payment.",
    icon: "chat",
  },
  {
    id: "protection",
    title: "Purchase Protection and Seller Protection",
    summary: "What these programs do and don't cover.",
    icon: "shield",
  },
  {
    id: "secure-account",
    title: "Secure your account",
    summary: "Steps to lock things down after a scare.",
    icon: "lock",
  },
  {
    id: "report-further",
    title: "Law enforcement and federal reporting",
    summary: "When and where to report a scam beyond PayPal.",
    icon: "flag",
  },
];

export default function PlaybookPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Your Recovery Playbook"
        title="If something goes wrong, here's your plan"
        description="Calm, practical steps for U.S. PayPal users who think they've been scammed. Every statement will link to its official PayPal source and show when it was last checked."
      />

      <FeedbackBanner tone="info" title="Content is being verified." className="mt-6">
        Each section is filled in only after it is checked against official U.S. PayPal sources. Until then,
        if you need help right now, contact PayPal through the official app or the website you normally type
        in yourself.
      </FeedbackBanner>

      <ul className="mt-8 grid gap-5 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card as="li" key={s.id} id={s.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <IconTile name={s.icon} accent={false} />
              <Badge tone="mist" icon={<Icon name="clock" className="size-3.5" />}>
                Pending verification
              </Badge>
            </div>
            <h2 className="mt-4 text-subheading font-bold">{s.title}</h2>
            <p className="mt-1 text-teal/90">{s.summary}</p>
            <p className="mt-4 border-t-2 border-mist pt-3 text-caption text-teal/85">
              Source and last-verified date will appear here.
            </p>
          </Card>
        ))}
      </ul>
    </div>
  );
}
