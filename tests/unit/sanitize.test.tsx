import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Markdown, safeHref } from "@/components/ui/Markdown";
import { jsonForScript } from "@/lib/security/html";

/**
 * XSS payloads against every way editor and user text reaches the page: the Markdown renderer (stories, creation,
 * lifestyle evidence, interpretations, mufti answers, dream responses, the admin previews) and inline JSON-LD.
 * The renderer builds React elements, so HTML in the source must come out as text, and only same-site or https
 * links survive.
 */
const PAYLOADS = [
  "<script>window.__xss=1</script>",
  "<img src=x onerror=window.__xss=1>",
  '<a href="javascript:window.__xss=1">x</a>',
  "<svg/onload=window.__xss=1>",
  '<iframe src="javascript:alert(1)"></iframe>',
  "<style>@import 'https://evil.example/x.css'</style>",
  '"><script>alert(1)</script>',
  "<details open ontoggle=alert(1)>",
  "</p><script>alert(1)</script><p>",
];

const BAD_LINKS = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "javascript&colon;alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "http://insecure.example",
  "//evil.example/path",
  "/\\evil.example",
  "\\\\evil.example",
  "/\t/evil.example",
  "java\u0000script:alert(1)",
];

function dangerous(container: HTMLElement): string[] {
  const out: string[] = [];
  for (const el of Array.from(container.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();
    if (["script", "iframe", "object", "embed", "style", "svg", "img", "details", "form", "input", "link", "meta"].includes(tag)) out.push(`<${tag}>`);
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name)) out.push(`${tag}[${a.name}]`);
      if ((a.name === "href" || a.name === "src") && !/^(\/(?![/\\])|#|https:\/\/)/.test(a.value)) out.push(`${tag}[${a.name}=${a.value}]`);
    }
  }
  return out;
}

describe("Markdown renderer: raw HTML is text, never markup", () => {
  test.each(PAYLOADS)("payload %s renders as text", (p) => {
    const { container } = render(<Markdown source={`## Heading ${p}\n\nIntro ${p} and **bold ${p}** and *em ${p}*\n\n- item ${p}\n- [link ${p}](/ok)\n\n1. one ${p}`} />);
    expect(dangerous(container)).toEqual([]);
    expect(container.textContent).toContain(p.replace(/\t/g, " ").slice(0, 10));
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  test.each(BAD_LINKS)("link target %j is dropped and its text kept", (href) => {
    const { container } = render(<Markdown source={`see [the label](${href}) here`} />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("the label");
  });

  test("same-site paths, anchors and https links survive; external ones open safely", () => {
    const { container } = render(<Markdown source="[a](/prophets/yusuf) [b](#refs) [c](https://tanzil.net/docs)" />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/prophets/yusuf", "#refs", "https://tanzil.net/docs"]);
    expect(links[2]!.getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[0]!.getAttribute("target")).toBeNull();
  });

  test("safeHref is the single allow-list", () => {
    for (const h of BAD_LINKS) expect(safeHref(h)).toBeNull();
    expect(safeHref("/a/b?c=1")).toBe("/a/b?c=1");
    expect(safeHref("https://example.org/x")).toBe("https://example.org/x");
  });

  test("a very long or deeply nested input still renders quickly (no pathological regex)", () => {
    const evil = `${"*".repeat(5000)}${"[".repeat(5000)}${"](".repeat(2000)}`;
    const t = Date.now();
    render(<Markdown source={evil} />);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe("inline JSON-LD", () => {
  test("cannot close its script element or break out of the string", () => {
    const s = jsonForScript({ name: "</script><script>alert(1)</script>", other: "a & b > c  " });
    expect(s).not.toMatch(/<\/?script/i);
    expect(s).not.toContain("<");
    expect(s).not.toContain(" ");
    expect(JSON.parse(s)).toEqual({ name: "</script><script>alert(1)</script>", other: "a & b > c  " });
  });
});
