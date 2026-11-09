"use client";

import type { SiteBlockContent } from "@/content/scenarios/schema";
import { Icon } from "@/components/icons/Icon";
import { anchor, useAvailableDecisions, useSim } from "./SimContext";
import { Avatar, DecisionButton, KvList, SimButton } from "./primitives";

/** Renders the typed content blocks of a fictional website or app screen. */
export function SiteBlocks({
  blocks,
  onNavigate,
}: {
  blocks: readonly SiteBlockContent[];
  onNavigate?: (pageId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b, i) => (
        <SiteBlock key={i} block={b} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function SiteBlock({
  block: b,
  onNavigate,
}: {
  block: SiteBlockContent;
  onNavigate?: (pageId: string) => void;
}) {
  const { record } = useSim();
  const go = (pageId?: string, actionId?: string) => {
    record(actionId);
    if (pageId) onNavigate?.(pageId);
  };

  switch (b.type) {
    case "hero":
      return (
        <div {...anchor(b.anchor)}>
          <h4 className="font-heading text-2xl leading-8 font-black break-words">{b.title}</h4>
          {b.text && <p className="mt-1 text-teal/90">{b.text}</p>}
        </div>
      );
    case "notice":
      return (
        <div
          className="flex items-start gap-3 rounded-tile border-2 border-teal/30 bg-mist p-4"
          {...anchor(b.anchor)}
        >
          <Icon name="info" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-heading font-extrabold">{b.title}</p>
            <p className="mt-1 text-small">{b.text}</p>
          </div>
        </div>
      );
    case "text":
      return (
        <section {...anchor(b.anchor)}>
          {b.title && <h5 className="font-heading text-lg font-extrabold">{b.title}</h5>}
          {b.paras.map((p) => (
            <p key={p} className="mt-1 text-small break-words">
              {p}
            </p>
          ))}
        </section>
      );
    case "list":
      return (
        <section {...anchor(b.anchor)}>
          {b.title && <h5 className="font-heading text-lg font-extrabold">{b.title}</h5>}
          <ul className="mt-2 divide-y-2 divide-mist rounded-tile border-2 border-mist">
            {b.items.map((it) => {
              const body = (
                <>
                  <span className="block font-semibold">{it.title}</span>
                  {it.text && <span className="mt-0.5 block text-small">{it.text}</span>}
                  {it.meta && <span className="mt-0.5 block text-caption text-teal/80">{it.meta}</span>}
                </>
              );
              return (
                <li key={it.title} {...anchor(it.anchor)}>
                  {it.pageId || it.actionId ? (
                    <button
                      type="button"
                      onClick={() => go(it.pageId, it.actionId)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-mist"
                    >
                      <span className="min-w-0">{body}</span>
                      <Icon name="arrow-right" className="size-4 shrink-0" />
                    </button>
                  ) : (
                    <div className="px-3 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      );
    case "kv":
      return (
        <section className="rounded-tile border-2 border-mist p-4" {...anchor(b.anchor)}>
          {b.title && <h5 className="mb-2 font-heading text-lg font-extrabold">{b.title}</h5>}
          <KvList rows={b.rows} />
        </section>
      );
    case "table":
      return (
        <section {...anchor(b.anchor)}>
          {b.title && <h5 className="font-heading text-lg font-extrabold">{b.title}</h5>}
          <div className="mt-2 overflow-x-auto rounded-tile border-2 border-mist">
            <table className="w-full min-w-[22rem] text-left text-small">
              <thead className="bg-mist text-caption uppercase">
                <tr>
                  {b.columns.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri} className="border-t-2 border-mist">
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    case "actions":
      return <ActionsBlock block={b} onNavigate={onNavigate} />;
    case "search":
      return (
        <section>
          <p className="flex items-center gap-2 rounded-pill border-2 border-teal/25 px-4 py-2 text-small">
            <Icon name="search" className="size-4" />
            <span className="sr-only">Search: </span>
            {b.query}
          </p>
          <ol className="mt-4 flex flex-col gap-4">
            {b.results.map((r) => (
              <li key={r.url} {...anchor(r.anchor)}>
                <p className="text-caption break-all text-teal/80">{r.url}</p>
                <button
                  type="button"
                  onClick={() => go(r.pageId, r.actionId)}
                  className="text-left font-heading text-lg font-extrabold underline-offset-2 hover:underline"
                >
                  {r.title}
                </button>
                <p className="text-small">{r.snippet}</p>
              </li>
            ))}
          </ol>
        </section>
      );
    case "profile":
      return (
        <section
          className="flex flex-col gap-4 rounded-tile border-2 border-mist p-4 sm:flex-row"
          {...anchor(b.anchor)}
        >
          <Avatar initials={b.initials} className="size-16 text-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-xl font-black">{b.name}</p>
            <p className="text-small">{b.headline}</p>
            <KvList rows={b.rows} className="mt-3" />
          </div>
        </section>
      );
  }
}

function ActionsBlock({
  block,
  onNavigate,
}: {
  block: Extract<SiteBlockContent, { type: "actions" }>;
  onNavigate?: (pageId: string) => void;
}) {
  const { record } = useSim();
  const available = useAvailableDecisions(block.items.flatMap((i) => (i.decisionId ? [i.decisionId] : [])));
  return (
    <div className="flex flex-wrap gap-2">
      {block.items.map((it) => {
        if (it.decisionId) {
          const d = available.find((x) => x.id === it.decisionId);
          return d ? (
            <DecisionButton
              key={it.label}
              decision={{ ...d, label: it.label }}
              variant={it.variant === "primary" ? "solid" : "outline"}
              anchorId={it.anchor}
            />
          ) : null;
        }
        return (
          <SimButton
            key={it.label}
            variant={it.variant === "primary" ? "solid" : "outline"}
            onClick={() => {
              record(it.actionId);
              if (it.pageId) onNavigate?.(it.pageId);
            }}
            {...anchor(it.anchor)}
          >
            {it.label}
          </SimButton>
        );
      })}
    </div>
  );
}
