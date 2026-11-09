"use client";

import type { InvoiceContent } from "@/content/scenarios/schema";
import { anchor, useAvailableDecisions } from "./SimContext";
import { DecisionButton } from "./primitives";

/**
 * Environment C (invoice and payment request): a professionally laid-out invoice document. Deliberately polished:
 * realistic invoices aren't full of mistakes, so the player has to check the details (Step 6 brief §3C).
 */
export function InvoiceView({ invoice }: { invoice: InvoiceContent }) {
  const decisions = useAvailableDecisions(invoice.decisionIds);
  return (
    <article
      aria-label={`Invoice ${invoice.number}`}
      className="mx-auto w-full max-w-2xl rounded-tile border-2 border-teal/20 bg-white p-5 text-teal sm:p-8"
      {...anchor(invoice.anchor)}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div {...anchor(invoice.issuer.anchor)}>
          <p className="font-heading text-xl font-black">{invoice.issuer.name}</p>
          {invoice.issuer.lines.map((l) => (
            <p key={l} className="text-small break-words">
              {l}
            </p>
          ))}
        </div>
        <div className="sm:text-right">
          <p className="font-heading text-2xl font-black tracking-wide uppercase">Invoice</p>
          <p className="text-small" {...anchor(invoice.numberAnchor)}>
            No. <span className="font-semibold">{invoice.number}</span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 border-y-2 border-mist py-4 text-small sm:grid-cols-3">
        <div>
          <p className="text-caption font-semibold uppercase">Bill to</p>
          <p className="font-semibold">{invoice.billTo.name}</p>
          {invoice.billTo.lines.map((l) => (
            <p key={l} className="break-words">
              {l}
            </p>
          ))}
        </div>
        <div>
          <p className="text-caption font-semibold uppercase">Issued</p>
          <p>{invoice.issueDate}</p>
          {invoice.reference && (
            <>
              <p className="mt-2 text-caption font-semibold uppercase">Reference</p>
              <p>{invoice.reference}</p>
            </>
          )}
        </div>
        <div {...anchor(invoice.dueAnchor)}>
          <p className="text-caption font-semibold uppercase">Due</p>
          <p className="font-semibold">{invoice.dueDate}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-small">
          <thead>
            <tr className="border-b-2 border-mist text-caption uppercase">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Description
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.description} className="border-b-2 border-mist align-top">
                <td className="py-2 pr-3">
                  <p className="font-semibold">{it.description}</p>
                  {it.detail && <p className="text-caption">{it.detail}</p>}
                </td>
                <td className="py-2 pr-3 text-right">{it.quantity}</td>
                <td className="py-2 text-right whitespace-nowrap">{it.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-small">
        <dt>Subtotal</dt>
        <dd className="text-right">{invoice.subtotal}</dd>
        <dt>Tax</dt>
        <dd className="text-right">{invoice.tax}</dd>
        <dt className="border-t-2 border-teal pt-1 font-heading font-extrabold">Total due</dt>
        <dd
          className="border-t-2 border-teal pt-1 text-right font-heading font-extrabold"
          {...anchor(invoice.totalAnchor)}
        >
          {invoice.total}
        </dd>
      </dl>

      <section
        className="mt-6 rounded-tile bg-mist p-4 text-small"
        {...anchor(invoice.paymentInstructions.anchor)}
      >
        <h4 className="font-heading font-extrabold">{invoice.paymentInstructions.title}</h4>
        {invoice.paymentInstructions.lines.map((l) => (
          <p key={l} className="mt-1 break-words">
            {l}
          </p>
        ))}
      </section>

      {invoice.notes.map((n) => (
        <p key={n.text} className="mt-3 text-caption" {...anchor(n.anchor)}>
          {n.text}
        </p>
      ))}

      {decisions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t-2 border-mist pt-4">
          {decisions.map((d) => (
            <DecisionButton key={d.id} decision={d} variant="solid" />
          ))}
        </div>
      )}
    </article>
  );
}
