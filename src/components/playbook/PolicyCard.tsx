import { Icon } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { formatDate, SourceLink } from "./SourceLink";

interface Item {
  id: string;
  text: string;
  quote: boolean;
}

export interface PolicyCardData {
  policyId: string;
  title: string;
  url: string;
  topic: string;
  verified: boolean;
  lastVerified: string | null;
  lastChecked: string;
  note: string;
  pageUpdated: string | null;
  facts: Item[];
  eligibility: Item[];
  procedures: Item[];
  exclusions: Item[];
  exclusionsNote: string | null;
}

function ItemList({ items, icon }: { items: Item[]; icon: "check" | "flag" | "arrow-right" }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5 text-small">
      {items.map((f) => (
        <li key={f.id} className="flex items-start gap-2">
          <Icon name={icon} className="mt-0.5 size-4 shrink-0" />
          <span>
            {f.text}
            {!f.quote && <span className="text-caption text-teal/80"> (summary of the page)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  items,
  icon,
}: {
  title: string;
  items: Item[];
  icon: "check" | "flag" | "arrow-right";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="font-heading text-small font-extrabold">{title}</p>
      <ItemList items={items} icon={icon} />
    </div>
  );
}

/**
 * One official PayPal source from the knowledge base. Verified pages show their checked facts, eligibility
 * requirements, process, and exclusions (verbatim quotes, or clearly labelled summaries); unverified pages show only
 * the link and the honest reason nothing is quoted (no eligibility, exclusion, or deadline is guessed).
 */
export function PolicyCard({ p, headingLevel = 3 }: { p: PolicyCardData; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  const hasContent = p.facts.length + p.eligibility.length + p.procedures.length + p.exclusions.length > 0;
  return (
    <article
      className="flex flex-col rounded-card border-2 border-teal/25 p-4"
      aria-labelledby={`policy-${p.policyId}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-eyebrow text-teal/80">{p.topic}</span>
        {p.verified ? (
          <Badge tone="teal" icon={<Icon name="check" className="size-3.5" />}>
            Verified {p.lastVerified ? formatDate(p.lastVerified) : ""}
          </Badge>
        ) : (
          <Badge tone="mist" icon={<Icon name="clock" className="size-3.5" />}>
            Not yet verified
          </Badge>
        )}
      </div>
      <H id={`policy-${p.policyId}`} className="mt-2 font-heading text-lg font-extrabold">
        {p.title}
      </H>
      {hasContent ? (
        <>
          <Section title="Key points" items={p.facts} icon="check" />
          <Section title="To be eligible" items={p.eligibility} icon="check" />
          <Section title="How it works" items={p.procedures} icon="arrow-right" />
          <Section title="Not covered or not counted" items={p.exclusions} icon="flag" />
          {p.exclusionsNote && <p className="mt-1.5 text-caption text-teal/85">{p.exclusionsNote}</p>}
        </>
      ) : (
        <p className="mt-2 text-small">{p.note}</p>
      )}
      <SourceLink className="mt-3" title={p.title} url={p.url} verified={p.lastVerified} />
      {p.verified && p.pageUpdated && (
        <p className="mt-1 text-caption text-teal/80">
          Page last updated by PayPal {formatDate(p.pageUpdated)}.
        </p>
      )}
      {!p.verified && (
        <p className="mt-1 text-caption text-teal/80">Last checked {formatDate(p.lastChecked)}.</p>
      )}
    </article>
  );
}
