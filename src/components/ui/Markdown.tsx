import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for editorial prose: paragraphs, ## / ### headings, - and 1. lists,
 * **bold**, *italic* and [links](/internal-or-https). It builds React elements, so raw HTML in the source is
 * shown as text and never executed. Links to other origins open with rel="noopener noreferrer".
 */
export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t.startsWith("### ")) return <h3 key={i}>{inline(t.slice(4))}</h3>;
        if (t.startsWith("## ")) return <h2 key={i}>{inline(t.slice(3))}</h2>;
        const lines = t.split("\n");
        if (lines.every((l) => /^- /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        if (lines.every((l) => /^\d+\. /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}</ol>;
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j ? <br /> : null}{inline(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

/**
 * Links allowed in rendered Markdown: same-site paths, in-page anchors and https URLs. Everything else is dropped
 * (the link text stays as plain text): javascript:, data:, vbscript:, http:, protocol-relative "//host", and
 * backslash or control-character tricks such as "/\host" that browsers treat as another origin.
 */
export function safeHref(href: string): string | null {
  if (/[\\\u0000-\u001f\u007f]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  try {
    const u = new URL(href);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k++}>{m[2]}</em>);
    else {
      const href = safeHref(m[4]!);
      out.push(
        href ? (
          <a key={k++} href={href} {...(href.startsWith("http") ? { rel: "noopener noreferrer", target: "_blank" } : {})}>
            {m[3]}
          </a>
        ) : (
          m[3]
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
