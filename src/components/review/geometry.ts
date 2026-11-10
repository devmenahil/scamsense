/**
 * DOM geometry for Reveal the Red Flags markers (browser only). Finds an anchor's VISIBLE box relative to the review
 * container: hidden apps and closed panels have no box, and content scrolled out of an inner panel (a chat list, a
 * browser page) is clipped away, so a marker never floats over the wrong place.
 */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function union(rects: DOMRect[]): DOMRect | null {
  const r = rects.filter((x) => x.width > 0 || x.height > 0);
  if (r.length === 0) return null;
  const left = Math.min(...r.map((x) => x.left));
  const top = Math.min(...r.map((x) => x.top));
  const right = Math.max(...r.map((x) => x.right));
  const bottom = Math.max(...r.map((x) => x.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

/** The element's own box; for `display: contents` wrappers (key/value rows) the union of its children. */
export function elementRect(el: Element): DOMRect | null {
  if (getComputedStyle(el).display === "contents")
    return union([...el.children].map((c) => c.getBoundingClientRect()));
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0 ? r : null;
}

/** The element that can be scrolled into view (the first child of a `display: contents` wrapper). */
export function scrollTargetOf(el: Element): Element {
  return getComputedStyle(el).display === "contents" ? (el.firstElementChild ?? el) : el;
}

const CLIPS = /(auto|scroll|hidden|clip)/;

export function visibleBox(el: Element, container: Element): Box | null {
  const r = elementRect(el);
  if (!r) return null;
  let top = r.top;
  let left = r.left;
  let right = r.right;
  let bottom = r.bottom;
  for (let a = el.parentElement; a && a !== container; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (CLIPS.test(`${s.overflowX} ${s.overflowY}`)) {
      const c = a.getBoundingClientRect();
      top = Math.max(top, c.top);
      left = Math.max(left, c.left);
      right = Math.min(right, c.right);
      bottom = Math.min(bottom, c.bottom);
    }
  }
  if (bottom - top < 2 || right - left < 2) return null;
  const base = container.getBoundingClientRect();
  return { top: top - base.top, left: left - base.left, width: right - left, height: bottom - top };
}

/** The first rendered element carrying the anchor that is visible inside the container. */
export function findAnchor(container: Element, anchor: string): { el: Element; box: Box | null } | null {
  const all = container.querySelectorAll(`[data-sim-anchor="${CSS.escape(anchor)}"]`);
  let first: Element | null = null;
  for (const el of all) {
    const box = visibleBox(el, container);
    if (box) return { el, box };
    if (!first && elementRect(el)) first = el;
  }
  return first ? { el: first, box: null } : null;
}

export const MARKER_SIZE = 28;

/**
 * Marker positions at the top-left corner of each box, kept inside the container and nudged sideways so two
 * markers never sit on top of each other.
 */
export function placeMarkers(
  boxes: { id: string; box: Box }[],
  width: number,
): Record<string, { top: number; left: number }> {
  const out: Record<string, { top: number; left: number }> = {};
  const placed: { top: number; left: number }[] = [];
  const sorted = [...boxes].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  for (const { id, box } of sorted) {
    const top = Math.max(2, box.top - MARKER_SIZE / 2);
    let left = Math.min(Math.max(2, box.left - MARKER_SIZE / 2), Math.max(2, width - MARKER_SIZE - 2));
    for (let guard = 0; guard < 12; guard++) {
      const clash = placed.some(
        (p) => Math.abs(p.top - top) < MARKER_SIZE && Math.abs(p.left - left) < MARKER_SIZE,
      );
      if (!clash) break;
      left = left + MARKER_SIZE + 4 > width - MARKER_SIZE ? 2 : left + MARKER_SIZE + 4;
    }
    placed.push({ top, left });
    out[id] = { top, left };
  }
  return out;
}
