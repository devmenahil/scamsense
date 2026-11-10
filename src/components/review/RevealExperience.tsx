"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ReviewEvidence, ReviewView } from "@/lib/review/view";
import { cn } from "@/lib/cn";
import { EVIDENCE_META, EvidenceLabel } from "@/components/feedback/EvidenceLabel";
import { Icon } from "@/components/icons/Icon";
import { SimProvider, type SimApi } from "@/components/scenario/sim/SimContext";
import { Workspace } from "@/components/scenario/sim/Workspace";
import { findAnchor, MARKER_SIZE, placeMarkers, scrollTargetOf, type Box } from "./geometry";

/** Border treatments differ per type (solid / dashed / double) so meaning never depends on colour (R35). */
const RING: Record<ReviewEvidence["kind"], string> = {
  red_flag: "border-yellow-shade border-solid",
  verify: "border-teal border-dashed",
  positive: "border-teal border-double",
};
const MARKER: Record<ReviewEvidence["kind"], string> = {
  red_flag: "bg-yellow text-teal-shade border-yellow-shade border-solid",
  verify: "bg-white text-teal border-teal border-dashed",
  positive: "bg-teal text-white border-teal-shade border-double",
};

const POPOVER_WIDTH = 352;
const noop = () => undefined;

/**
 * Reveal the Red Flags (Step 9): the learner's own scenario, re-rendered READ-ONLY, with every authored piece of
 * evidence outlined and numbered. Markers are real buttons (keyboard and screen-reader operable); one explanation is
 * open at a time and can be closed. The environment's `record`/`decide` are no-ops and decisions stay disabled, so
 * nothing here can create an attempt, change a decision or explanation, record actions, start a checkout, move
 * Training Funds, or touch scores and progress. Nothing is sent to the server from this component at all.
 */
export function RevealExperience({ review }: { review: ReviewView }) {
  const [activeAppId, setActiveAppId] = useState(review.render.startAppId);
  const [reveal, setReveal] = useState<SimApi["reveal"]>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);
  const popoverHeading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const pendingScroll = useRef<string | null>(null);

  const evidence = review.evidence;
  const selected = evidence.find((e) => e.id === selectedId) ?? null;

  const sim: SimApi = useMemo(
    () => ({
      recorded: review.revealActions,
      record: noop,
      decide: noop,
      decisions: review.render.decisions,
      interactive: false,
      readOnly: true,
      openApp: (appId) => setActiveAppId(appId),
      navRequest: null,
      reveal,
    }),
    [review, reveal],
  );

  /* ------------------------------------------------------------------ marker geometry */
  const measure = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const next: Record<string, Box> = {};
    for (const e of evidence) {
      const found = findAnchor(c, e.anchor);
      if (found?.box) next[e.id] = found.box;
    }
    setBoxes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    setWidth(c.clientWidth);
    setHeight(c.clientHeight);
  }, [evidence]);

  useLayoutEffect(() => {
    const c = containerRef.current;
    const apps = appsRef.current;
    if (!c || !apps) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(c);
    // Only the environment is observed (never the overlay), so drawing markers can't re-trigger measuring.
    const mutations = new MutationObserver(schedule);
    mutations.observe(apps, { subtree: true, childList: true, attributes: true, characterData: true });
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [measure]);

  const markers = useMemo(
    () =>
      placeMarkers(
        Object.entries(boxes).map(([id, box]) => ({ id, box })),
        width,
      ),
    [boxes, width],
  );

  /* ------------------------------------------------------------------ selection */
  const select = useCallback((e: ReviewEvidence, opts: { navigate: boolean; from?: HTMLElement | null }) => {
    returnFocus.current = opts.from ?? null;
    setSelectedId(e.id);
    if (opts.navigate && e.location) {
      setActiveAppId(e.location.appId);
      setReveal((r) => ({
        appId: e.location!.appId,
        target: e.location!.target,
        nonce: (r?.nonce ?? 0) + 1,
      }));
      pendingScroll.current = e.anchor;
    }
  }, []);

  // After a navigation, bring the evidence into view (inner panels and the page), then focus the explanation.
  useEffect(() => {
    const anchor = pendingScroll.current;
    if (!anchor) return;
    let f2 = 0;
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => {
        pendingScroll.current = null;
        const found = containerRef.current && findAnchor(containerRef.current, anchor);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (found)
          scrollTargetOf(found.el).scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        measure();
        popoverHeading.current?.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(f1);
      cancelAnimationFrame(f2);
    };
  }, [reveal, measure]);

  // Focus the explanation when it opens from a marker (no navigation needed).
  useEffect(() => {
    if (selectedId && !pendingScroll.current) popoverHeading.current?.focus({ preventScroll: true });
  }, [selectedId]);

  function close() {
    setSelectedId(null);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back && document.contains(back)) back.focus();
  }

  function step(delta: number) {
    if (!selected) return;
    const i = evidence.findIndex((e) => e.id === selected.id);
    const next = evidence[(i + delta + evidence.length) % evidence.length]!;
    select(next, { navigate: true, from: returnFocus.current });
  }

  /* ------------------------------------------------------------------ popover position */
  const popWidth = Math.max(220, Math.min(POPOVER_WIDTH, width - 16));
  const box = selected ? boxes[selected.id] : undefined;
  let popStyle: CSSProperties = { width: popWidth, top: 8, left: Math.max(8, (width - popWidth) / 2) };
  if (box) {
    const below = box.top + box.height + 10;
    const placeAbove = below + 260 > Math.max(height, 400) && box.top > 280;
    popStyle = {
      width: popWidth,
      left: Math.min(Math.max(8, box.left), Math.max(8, width - popWidth - 8)),
      top: placeAbove ? box.top - 10 : below,
      transform: placeAbove ? "translateY(-100%)" : undefined,
    };
  }

  const counts = {
    red_flag: evidence.filter((e) => e.kind === "red_flag").length,
    verify: evidence.filter((e) => e.kind === "verify").length,
    positive: evidence.filter((e) => e.kind === "positive").length,
  };

  return (
    <div>
      {/* Legend + quick access (icon, words, and border style per type; never colour alone). */}
      <section aria-labelledby="evidence-legend" className="mb-4 rounded-card border-2 border-mist p-4">
        <h2 id="evidence-legend" className="font-heading text-lg font-extrabold">
          {evidence.length} pieces of evidence in this scenario
        </h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-small">
          {(["red_flag", "verify", "positive"] as const).map((k) =>
            counts[k] > 0 ? (
              <li key={k} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("inline-block size-5 rounded-pill border-[3px]", MARKER[k])}
                />
                <span>
                  <span className="font-semibold">{EVIDENCE_META[k].label}</span> ({counts[k]}) ·{" "}
                  {EVIDENCE_META[k].description}
                </span>
              </li>
            ) : null,
          )}
        </ul>
        <p className="mt-2 text-caption text-teal/85">
          Select a numbered marker in the scenario, or a number below, to read why it matters. Use the app
          dock to look around: everything is read-only.
        </p>
        <ol aria-label="Jump to evidence" className="mt-3 flex flex-wrap gap-2">
          {evidence.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={(ev) => select(e, { navigate: true, from: ev.currentTarget })}
                aria-label={`Show evidence ${e.number}: ${EVIDENCE_META[e.kind].label}, ${e.title}`}
                aria-pressed={selectedId === e.id}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-pill border-[3px] font-heading font-black",
                  MARKER[e.kind],
                  selectedId === e.id && "ring-4 ring-teal/40",
                )}
              >
                {e.number}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div ref={containerRef} className="relative">
        <div ref={appsRef}>
          <SimProvider value={sim}>
            <Workspace apps={review.render.apps} activeAppId={activeAppId} onSelectApp={setActiveAppId} />
          </SimProvider>
        </div>

        {/* Overlay: outlines never take pointer events; only the numbered markers do. */}
        <div className="pointer-events-none absolute inset-0">
          {evidence.map((e) => {
            const b = boxes[e.id];
            if (!b) return null;
            return (
              <div
                key={`ring-${e.id}`}
                aria-hidden="true"
                className={cn(
                  "absolute rounded-tile",
                  RING[e.kind],
                  selectedId === e.id ? "border-[5px]" : "border-[3px]",
                )}
                style={{ top: b.top - 4, left: b.left - 4, width: b.width + 8, height: b.height + 8 }}
              />
            );
          })}
          {evidence.map((e) => {
            const m = markers[e.id];
            if (!m) return null;
            return (
              <button
                key={`marker-${e.id}`}
                type="button"
                onClick={(ev) =>
                  selectedId === e.id ? close() : select(e, { navigate: false, from: ev.currentTarget })
                }
                aria-label={`Evidence ${e.number}: ${EVIDENCE_META[e.kind].label}. ${e.title}`}
                aria-expanded={selectedId === e.id}
                aria-controls={selectedId === e.id ? "evidence-explanation" : undefined}
                className={cn(
                  "pointer-events-auto absolute inline-flex items-center justify-center rounded-pill border-[3px] font-heading text-small font-black shadow-edge-shade",
                  MARKER[e.kind],
                  selectedId === e.id && "ring-4 ring-teal/40",
                )}
                style={{ top: m.top, left: m.left, width: MARKER_SIZE, height: MARKER_SIZE }}
              >
                {e.number}
              </button>
            );
          })}

          {selected && (
            <section
              id="evidence-explanation"
              role="dialog"
              aria-modal="false"
              aria-labelledby="evidence-explanation-title"
              onKeyDown={(ev) => {
                if (ev.key === "Escape") {
                  ev.stopPropagation();
                  close();
                }
              }}
              className="pointer-events-auto absolute z-10 rounded-card border-2 border-teal bg-white p-4 text-teal shadow-edge"
              style={popStyle}
            >
              <div className="flex items-start justify-between gap-2">
                <EvidenceLabel kind={selected.kind} />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close explanation"
                  className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-pill hover:bg-mist"
                >
                  <Icon name="close" className="size-4" />
                </button>
              </div>
              <h3
                id="evidence-explanation-title"
                ref={popoverHeading}
                tabIndex={-1}
                className="mt-2 font-heading text-lg leading-6 font-extrabold"
              >
                <span className="sr-only">Evidence </span>
                {selected.number}. {selected.title}
              </h3>
              <p className="mt-1.5 text-small">{selected.explanation}</p>
              {!box && (
                <p className="mt-2 flex items-start gap-1.5 text-caption">
                  <Icon name="info" className="mt-0.5 size-3.5 shrink-0" />
                  This part isn&apos;t on screen right now.{" "}
                  <button
                    type="button"
                    onClick={() => select(selected, { navigate: true, from: returnFocus.current })}
                    className="font-semibold underline underline-offset-2"
                  >
                    Show it
                  </button>
                </p>
              )}
              {!selected.seenDuringAttempt && (
                <p className="mt-2 flex items-start gap-1.5 text-caption">
                  <Icon name="info" className="mt-0.5 size-3.5 shrink-0" />
                  You didn&apos;t open this part during your attempt. It&apos;s shown here so you can see it
                  now.
                </p>
              )}
              <ReasoningNote reasoning={selected.reasoning} />
              <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-mist pt-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-pill px-2 text-small font-semibold hover:bg-mist"
                >
                  <Icon name="arrow-right" className="size-4 rotate-180" />
                  Previous
                </button>
                <span className="text-caption">
                  {selected.number} of {evidence.length}
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-pill px-2 text-small font-semibold hover:bg-mist"
                >
                  Next
                  <Icon name="arrow-right" className="size-4" />
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-caption text-teal/85">
        Review mode · fictional scenario · decisions are locked and nothing here is saved.
      </p>

      <section aria-labelledby="evidence-list-heading" className="mt-8">
        <h2 id="evidence-list-heading" className="text-subheading font-bold">
          Evidence guide
        </h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-2">
          {evidence.map((e) => (
            <li key={e.id} className="flex items-start gap-3 rounded-card border-2 border-teal/25 p-3">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-pill border-[3px] font-heading text-small font-black",
                  MARKER[e.kind],
                )}
              >
                {e.number}
              </span>
              <div className="min-w-0 flex-1">
                <EvidenceLabel kind={e.kind} />
                <p className="mt-1 font-semibold">
                  <span className="sr-only">Evidence {e.number}: </span>
                  {e.title}
                </p>
                {e.reasoning === "mentioned" && (
                  <p className="mt-0.5 flex items-center gap-1 text-caption">
                    <Icon name="check" className="size-3.5" /> You mentioned this
                  </p>
                )}
                {e.reasoning === "missed" && (
                  <p className="mt-0.5 flex items-center gap-1 text-caption">
                    <Icon name="flag" className="size-3.5" /> Worth a second look
                  </p>
                )}
                <button
                  type="button"
                  onClick={(ev) => select(e, { navigate: true, from: ev.currentTarget })}
                  className="mt-1 inline-flex min-h-9 items-center gap-1 text-small font-semibold underline underline-offset-2"
                >
                  Show in scenario
                  <Icon name="arrow-right" className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** The learner's reasoning, kept apart from the authoritative explanation (it never changes it or the score). */
function ReasoningNote({ reasoning }: { reasoning: ReviewEvidence["reasoning"] }) {
  if (!reasoning) return null;
  const text =
    reasoning === "mentioned"
      ? "Your explanation mentioned this. Nice catch."
      : reasoning === "missed"
        ? "Your explanation didn't mention this one. Worth a second look next time."
        : "Your explanation didn't point to this. That's fine: not every detail needs mentioning.";
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 rounded-tile p-2 text-caption",
        reasoning === "missed" ? "bg-yellow-tint" : "bg-mist",
      )}
    >
      <Icon
        name={reasoning === "mentioned" ? "check" : reasoning === "missed" ? "flag" : "info"}
        className="mt-0.5 size-3.5 shrink-0"
      />
      <span>
        <span className="font-semibold">Your reasoning: </span>
        {text}
      </span>
    </p>
  );
}
