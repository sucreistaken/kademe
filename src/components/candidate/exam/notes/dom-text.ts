/**
 * DOM helpers for the notes: a container's text is the concatenation of its
 * text nodes, except text inside controls (options, chips, inputs), which is
 * never marked and so never shifts an offset.
 */
const SKIP = "button, input, textarea, select, label, [draggable='true'], [data-notes-skip]";

export function textNodesOf(root: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const parent = n.parentElement;
      if (!parent || (n as Text).length === 0) return NodeFilter.FILTER_REJECT;
      return parent.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** The text offset of a DOM boundary point, or null when it lies outside the root. */
export function offsetOfPoint(root: Element, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null;
  const at = document.createRange();
  try {
    at.setStart(node, offset);
  } catch {
    return null;
  }
  at.collapse(true);
  let acc = 0;
  for (const t of textNodesOf(root)) {
    if (t === node) return acc + Math.min(offset, t.length);
    if (at.comparePoint(t, t.length) < 0) acc += t.length;
    else if (at.comparePoint(t, 0) > 0) return acc;
    else return acc;
  }
  return acc;
}

/** Turn a text-offset range into a DOM range, or null when the text is shorter now. */
export function rangeOfOffsets(nodes: readonly Text[], start: number, end: number): Range | null {
  let acc = 0;
  let sNode: Text | null = null;
  let sOff = 0;
  let eNode: Text | null = null;
  let eOff = 0;
  for (const t of nodes) {
    const next = acc + t.length;
    if (!sNode && start < next) {
      sNode = t;
      sOff = Math.max(0, start - acc);
    }
    if (end <= next) {
      eNode = t;
      eOff = Math.max(0, end - acc);
      break;
    }
    acc = next;
  }
  if (!sNode || !eNode) return null;
  const r = document.createRange();
  r.setStart(sNode, sOff);
  r.setEnd(eNode, eOff);
  return r.collapsed ? null : r;
}

/** The text offset under a viewport point, via the caret APIs; null off the text. */
export function offsetAtPoint(root: Element, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let off = 0;
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) {
    node = pos.offsetNode;
    off = pos.offset;
  } else {
    const r = doc.caretRangeFromPoint?.(x, y);
    if (r) {
      node = r.startContainer;
      off = r.startOffset;
    }
  }
  return node ? offsetOfPoint(root, node, off) : null;
}
