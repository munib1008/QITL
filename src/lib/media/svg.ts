/**
 * SVG sanitiser for the Media Library (pure; no DOM). An allowlist, not a blocklist: the document is tokenised,
 * only known drawing elements and safe attributes are kept, and the result is re-serialised from scratch.
 *
 * Removed: <script>, <foreignObject>, <style>, <image>, animation elements (they can rewrite href), <iframe>/<embed>/
 * <object>, event handlers (on*), any href that is not an in-document #fragment, url(...) that is not url(#id),
 * xml:base, comments, processing instructions and CDATA. Refused outright: DOCTYPE / ENTITY declarations (XXE),
 * unknown entities, unquoted attributes, malformed nesting, a root that is not <svg>.
 */

const ELEMENTS = new Set(
  [
    "svg", "g", "defs", "symbol", "use", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "textPath", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "marker", "filter",
    "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap",
    "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feMerge",
    "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence",
  ],
);
/** Elements dropped together with everything inside them. */
const DROP_WITH_CONTENT = new Set(
  ["script", "foreignObject", "style", "image", "iframe", "embed", "object", "audio", "video", "canvas", "animate", "animateMotion",
    "animateTransform", "set", "discard", "handler", "listener", "metadata", "switch", "font", "font-face", "cursor"].map((s) => s.toLowerCase()),
);
/** Elements whose tag is removed but whose children are kept. */
const UNWRAP = new Set(["a"]);

const NAMESPACES: Record<string, string> = {
  xmlns: "http://www.w3.org/2000/svg",
  "xmlns:xlink": "http://www.w3.org/1999/xlink",
};

const ENTITY_RE = /&(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|amp|lt|gt|quot|apos);/g;

export class SvgRejected extends Error {}

function decodeEntities(s: string): string {
  if (/&(?!(#[0-9]{1,7}|#x[0-9a-fA-F]{1,6}|amp|lt|gt|quot|apos);)/.test(s)) throw new SvgRejected("unknown entity");
  return s.replace(ENTITY_RE, (_, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!cp || cp > 0x10ffff) throw new SvgRejected("bad character reference");
      return String.fromCodePoint(cp);
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e as "amp"];
  });
}

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

/** Does a value reference anything outside the document (url(...) not #, javascript:, data:, http...)? */
function externalRef(v: string): boolean {
  const compact = v.replace(/[\s\u0000-\u001f]+/g, "").toLowerCase();
  if (/javascript:|vbscript:|data:|expression\(|@import|behavior:|-moz-binding/.test(compact)) return true;
  const urls = compact.match(/url\(([^)]*)\)/g) ?? [];
  return urls.some((u) => !/^url\((['"]?)#[a-z0-9_.:-]+\1\)$/.test(u));
}

function safeAttr(name: string, raw: string, removed: Set<string>): [string, string] | null {
  const lname = name.toLowerCase();
  const value = decodeEntities(raw);
  if (lname.startsWith("on")) return removed.add(`event handler ${name}`), null;
  if (lname === "xmlns" || lname === "xmlns:xlink") {
    if (value !== NAMESPACES[lname]) return removed.add(`namespace ${name}`), null;
    return [lname, value];
  }
  if (lname.startsWith("xmlns:") || lname === "xml:base" || lname.startsWith("xml:") && lname !== "xml:space" && lname !== "xml:lang") {
    return removed.add(`attribute ${name}`), null;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*(:[a-zA-Z][a-zA-Z0-9_.-]*)?$/.test(name)) return removed.add(`attribute ${name}`), null;
  if (lname === "href" || lname === "xlink:href" || lname === "src" || lname === "action" || lname === "formaction") {
    if (lname !== "src" && /^#[A-Za-z0-9_.:-]+$/.test(value.trim())) return [name, value.trim()];
    return removed.add(`external reference ${name}`), null;
  }
  if (externalRef(value)) return removed.add(`external reference in ${name}`), null;
  return [name, value];
}

export interface SanitisedSvg {
  svg: string;
  /** What was removed, for the upload report (deduplicated). */
  removed: string[];
}

/** Sanitise an SVG document. Throws SvgRejected when the input cannot be made safe. */
export function sanitizeSvg(input: string): SanitisedSvg {
  const src = input.replace(/^﻿/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) throw new SvgRejected("DOCTYPE and ENTITY declarations are not allowed");
  const removed = new Set<string>();
  const out: string[] = [];
  const stack: Array<{ name: string; mode: "keep" | "drop" | "unwrap" }> = [];
  let dropDepth = 0;
  let sawRoot = false;
  let rootClosed = false;
  let i = 0;
  const tagRe = /^<(\/?)([A-Za-z][A-Za-z0-9_.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/;
  const attrRe = /\s+([^\s=/>]+)\s*=\s*("([^"<]*)"|'([^'<]*)')/g;

  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      if (end < 0) throw new SvgRejected("unterminated comment");
      removed.add("comment");
      i = end + 3;
      continue;
    }
    if (src.startsWith("<![CDATA[", i)) {
      const end = src.indexOf("]]>", i);
      if (end < 0) throw new SvgRejected("unterminated CDATA");
      removed.add("CDATA section");
      i = end + 3;
      continue;
    }
    if (src.startsWith("<?", i)) {
      const end = src.indexOf("?>", i);
      if (end < 0) throw new SvgRejected("unterminated processing instruction");
      if (!/^<\?xml\s/i.test(src.slice(i, end))) removed.add("processing instruction");
      i = end + 2;
      continue;
    }
    if (src[i] === "<") {
      const m = tagRe.exec(src.slice(i));
      if (!m) throw new SvgRejected("malformed tag");
      const [whole, closing, name, attrs, selfClosing] = m as unknown as [string, string, string, string, string];
      i += whole.length;
      const lname = name.toLowerCase();
      if (closing) {
        const top = stack.pop();
        if (!top || top.name !== name) throw new SvgRejected("mismatched closing tag");
        if (top.mode === "drop") dropDepth--;
        else if (top.mode === "keep" && dropDepth === 0) out.push(`</${name}>`);
        if (!stack.length) rootClosed = true;
        continue;
      }
      if (rootClosed) throw new SvgRejected("content after the root element");
      if (!sawRoot) {
        if (name !== "svg") throw new SvgRejected("the root element must be <svg>");
        sawRoot = true;
      }
      let mode: "keep" | "drop" | "unwrap";
      if (dropDepth > 0 || DROP_WITH_CONTENT.has(lname) || (!ELEMENTS.has(name) && !UNWRAP.has(lname))) {
        mode = "drop";
        if (dropDepth === 0) removed.add(`<${name}>`);
      } else if (UNWRAP.has(lname)) {
        mode = "unwrap";
        removed.add(`<${name}> link`);
      } else {
        mode = "keep";
      }
      if (mode === "keep") {
        const kept: string[] = [];
        for (const a of attrs.matchAll(attrRe)) {
          const r = safeAttr(a[1]!, a[3] ?? a[4] ?? "", removed);
          if (r) kept.push(` ${r[0]}="${escAttr(r[1])}"`);
        }
        out.push(`<${name}${kept.join("")}${selfClosing ? "/" : ""}>`);
      }
      if (!selfClosing) {
        stack.push({ name, mode });
        if (mode === "drop") dropDepth++;
      } else if (!stack.length) {
        rootClosed = true;
      }
      continue;
    }
    const next = src.indexOf("<", i);
    const text = src.slice(i, next < 0 ? src.length : next);
    i = next < 0 ? src.length : next;
    if (!stack.length) {
      if (text.trim()) throw new SvgRejected("text outside the root element");
      continue;
    }
    if (dropDepth === 0) out.push(escText(decodeEntities(text)));
  }
  if (!sawRoot) throw new SvgRejected("no <svg> element");
  if (stack.length) throw new SvgRejected("unclosed elements");
  let svg = out.join("");
  if (!/^<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) svg = svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  return { svg, removed: [...removed] };
}
