import { getModule, type ModuleKey } from "@/content/modules";
import { PAYPAL_CURRENCIES } from "@/lib/domain/currency";
import type { CurrentWallet } from "@/lib/domain/progress";
import type { LedgerEntry, PaymentClassification, WalletSummary } from "@/lib/domain/wallet";
import { formatMinorUnits } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";

/**
 * Training Funds display (R18–R20). Always labelled "Training Funds" — never a PayPal balance. Every number comes
 * from the ledger (or, before a module starts, from the deterministic preview calculation).
 */

/** Formats any PayPal currency, including one that has since been removed from the user-selectable allowlist. */
export function money(amountMinor: number, currency: string): string {
  const digits = PAYPAL_CURRENCIES.find((c) => c.code === currency)?.minorUnitDigits ?? 2;
  return formatMinorUnits(amountMinor, currency, digits);
}

const FICTIONAL_NOTE =
  "Fictional practice money. It isn't your PayPal balance and resets at the start of each module.";

function headline(wallet: CurrentWallet) {
  const m = getModule(wallet.moduleKey)!;
  switch (wallet.kind) {
    case "active":
      return {
        amount: money(wallet.summary.balanceMinor, wallet.summary.currency),
        caption: `Module ${m.order} · started with ${money(wallet.summary.startingMinor, wallet.summary.currency)}`,
      };
    case "preview":
      return {
        amount: money(wallet.funds.startingFundsMinor, wallet.funds.currency),
        caption:
          `Ready for Module ${m.order}. ` +
          (wallet.funds.basis === "income_bracket"
            ? "Based on your income range."
            : "Default training budget (no income range shared).") +
          (wallet.funds.currency !== "USD"
            ? ` Converted from a US$${wallet.funds.baselineUsd.toLocaleString("en-US")} baseline at a fixed reference rate.`
            : ""),
      };
    case "closed":
      return {
        amount: money(wallet.summary.balanceMinor, wallet.summary.currency),
        caption: `Final balance after Module ${m.order}`,
      };
  }
}

export function WalletBreakdown({ summary, onDark = false }: { summary: WalletSummary; onDark?: boolean }) {
  const rows: { label: string; value: number; icon: IconName; show: boolean }[] = [
    { label: "Spent on purchases", value: summary.spendingMinor, icon: "marketplace", show: true },
    { label: "Lost to scams", value: summary.fraudLossMinor, icon: "flag", show: true },
    {
      label: "Awaiting scenario results",
      value: summary.pendingMinor,
      icon: "clock",
      show: summary.pendingMinor > 0,
    },
  ];
  return (
    <dl className={cn("grid gap-2 text-small", onDark ? "text-white" : "text-teal")}>
      {rows
        .filter((r) => r.show)
        .map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2">
              <Icon name={r.icon} className="size-4" />
              {r.label}
            </dt>
            <dd className="font-heading font-extrabold tabular-nums">{money(r.value, summary.currency)}</dd>
          </div>
        ))}
    </dl>
  );
}

/** Full card for the dashboard sidebar (desktop) and module pages. */
export function TrainingFundsCard({ wallet, className }: { wallet: CurrentWallet; className?: string }) {
  const h = headline(wallet);
  return (
    <Card tone="teal" as="section" aria-labelledby="training-funds-heading" className={className}>
      <div className="flex items-center gap-3">
        <IconTile name="wallet" tone="teal" accent={false} size="sm" />
        <h2 id="training-funds-heading" className="font-heading text-lg font-extrabold">
          Training Funds
        </h2>
      </div>
      <p className="mt-4 font-heading text-[2rem] leading-none font-black tabular-nums">{h.amount}</p>
      <p className="mt-2 text-caption text-white/90">{h.caption}</p>
      {wallet.kind !== "preview" && (
        <div className="mt-4 border-t-2 border-white/25 pt-4">
          <WalletBreakdown summary={wallet.summary} onDark />
        </div>
      )}
      <p className="mt-4 text-caption text-white/90">{FICTIONAL_NOTE}</p>
    </Card>
  );
}

/** Compact strip for small screens, shown at the top of the dashboard. */
export function TrainingFundsStrip({ wallet, className }: { wallet: CurrentWallet; className?: string }) {
  const h = headline(wallet);
  return (
    <section
      aria-label="Training Funds"
      className={cn(
        "on-dark flex items-center gap-3 rounded-card border-2 border-teal bg-teal px-4 py-3 text-white shadow-edge-shade",
        className,
      )}
    >
      <IconTile name="wallet" tone="teal" accent={false} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium text-white/90">Training Funds</p>
        <p className="font-heading text-xl leading-7 font-black tabular-nums">{h.amount}</p>
      </div>
      <p className="max-w-[9rem] text-right text-caption text-white/90">
        {wallet.kind === "preview" ? "Set when the module starts" : "Fictional practice money"}
      </p>
    </section>
  );
}

const CLASSIFICATION: Record<PaymentClassification, { label: string; icon: IconName }> = {
  pending: { label: "Awaiting results", icon: "clock" },
  spending: { label: "Purchase", icon: "marketplace" },
  fraud_loss: { label: "Lost to a scam", icon: "flag" },
};

/** The module's ledger, oldest first: every change to Training Funds is its own row. */
export function LedgerHistory({
  entries,
  moduleKey,
}: {
  entries: readonly LedgerEntry[];
  moduleKey: ModuleKey;
}) {
  const m = getModule(moduleKey)!;
  if (entries.length === 0) return null;
  return (
    <ol className="flex flex-col divide-y-2 divide-mist" aria-label={`Training Funds history for ${m.title}`}>
      {entries.map((e, i) => {
        const c = e.classification ? CLASSIFICATION[e.classification] : null;
        return (
          <li
            key={e.idempotencyKey ?? `start-${i}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-heading font-extrabold">
                {e.entryType === "MODULE_START" ? `Module ${m.order} training funds` : "Scenario payment"}
              </span>
              {c ? (
                <Badge tone="mist" icon={<Icon name={c.icon} className="size-3.5" />} className="mt-1">
                  {c.label}
                </Badge>
              ) : (
                <span className="text-caption text-teal/85">Starting balance</span>
              )}
            </span>
            <span className="text-right">
              <span className="block font-heading font-extrabold tabular-nums">
                {e.amountMinor > 0 ? "+" : ""}
                {money(e.amountMinor, e.currency)}
              </span>
              <span className="block text-caption text-teal/85 tabular-nums">
                Balance {money(e.balanceAfterMinor, e.currency)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
