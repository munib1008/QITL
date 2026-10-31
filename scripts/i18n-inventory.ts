/**
 * Interface-string inventory (docs/LOCALISATION_STATUS.md).
 *
 *   pnpm tsx scripts/i18n-inventory.ts            # prints the report
 *   pnpm tsx scripts/i18n-inventory.ts --write    # writes docs/LOCALISATION_STATUS.md
 *   pnpm tsx scripts/i18n-inventory.ts --json     # machine-readable
 *
 * A heuristic scan of src with the TypeScript parser. It finds English interface text that is still typed into a
 * component instead of coming from a strings file: JSX text, interface attributes (aria-label, placeholder, title, alt,
 * label...), string literals rendered from JSX expressions, metadata titles and descriptions, user-facing messages
 * (setError("..."), { error: "..." } in API routes, validation messages). Content (src/content: editorial pages, the
 * journey) and data are not interface text and are listed apart. It is a heuristic: it errs on reporting.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

export interface Finding {
  file: string;
  line: number;
  kind: "jsx-text" | "attr" | "expr" | "metadata" | "message" | "api" | "validation";
  text: string;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

/** Attributes whose string value is shown to (or read out for) the reader. */
const UI_ATTRS = new Set(["aria-label", "aria-description", "aria-roledescription", "placeholder", "title", "alt", "label", "lead", "eyebrow", "description", "hint", "summary", "caption", "heading", "note", "emptyText", "emptyLabel", "confirm", "legend", "subtitle"]);
/** Attributes whose value is never interface text. */
const CODE_ATTRS = new Set(["className", "href", "id", "key", "style", "type", "role", "name", "src", "rel", "target", "method", "action", "as", "lang", "dir", "variant", "size", "kind", "tone", "autoComplete", "inputMode", "d", "fill", "viewBox", "stroke", "htmlFor", "pattern", "accept", "hrefLang", "data-testid", "status", "mode", "layout", "points", "transform", "xmlns", "aria-controls", "aria-labelledby", "aria-describedby", "aria-current", "aria-live", "aria-hidden", "aria-expanded", "aria-haspopup", "aria-pressed", "aria-selected", "aria-modal", "enterKeyHint", "sizes", "loading", "decoding", "fetchPriority", "crossOrigin", "form", "scope", "headers", "wrap", "encType", "list", "spellCheck", "translate", "preload", "media", "integrity", "nonce", "charSet", "content", "property", "itemProp", "itemType", "strokeLinecap", "strokeLinejoin", "textAnchor", "dominantBaseline", "fontFamily", "fontWeight", "fontSize", "clipPath", "mask", "filter", "gradientUnits", "markerEnd", "markerStart", "vectorEffect", "paintOrder", "shapeRendering", "preserveAspectRatio", "fillRule", "clipRule", "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "x2", "y1", "y2", "width", "height", "value", "defaultValue", "slug", "icon", "tab", "section", "anchor", "locale", "edition", "field", "column", "table", "view", "ui", "theme", "align", "side", "placement", "position", "shape", "level", "tag", "track", "layer", "sort", "order", "group", "path", "file", "token", "code", "format", "unit", "step", "min", "max", "minLength", "maxLength", "rows", "cols", "start", "span"]);
/** Object keys whose string value is interface text when found in a component or page. */
const UI_KEYS = new Set(["label", "title", "lead", "note", "description", "placeholder", "hint", "eyebrow", "heading", "caption", "empty", "emptyText", "message", "error", "help", "subtitle", "cta", "text", "aria", "ariaLabel", "confirm", "body", "button", "legend", "tooltip"]);
const MESSAGE_CALL = /^set(Error|Err|Msg|Message|Status|Notice|Note|Info|Feedback|Problem|Saved|Result|Flash|Toast)\b/;

const ENGLISH = /[A-Za-z]{2,}/;
/** Codes, paths, identifiers, CSS: not interface text. */
const CODEY = /^(?:[a-z0-9_\-.:/#?=&%@[\]()+*,]+|[A-Z0-9_]+|#[0-9a-fA-F]{3,8}|var\(.*\)|https?:\/\/\S+|\/\S*|[a-z]+(?:[A-Z][a-z]+)+|[\w-]+\s*:\s*[\w-]+.*;?)$/;
/** Strings that are names, symbols or brands rather than text to translate. */
const KEEP = new Set(["QITL", "Quran in Timeline", "English", "Supabase", "OK", "AI", "ID", "URL", "PDF", "JSON", "CSV", "SQL", "RLS", "API", "MP3", "UTF-8", "Lara", "Claude", "GitHub", "AH", "CE", "BCE", "AD", "BC", "Esc", "Tab", "Enter"]);

function isText(s: string): boolean {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t || !ENGLISH.test(t)) return false;
  if (KEEP.has(t)) return false;
  if (CODEY.test(t) && !/\s/.test(t) && !/^[A-Z][a-z]{2,}$/.test(t)) return false;
  if (/^[\w-]+(\s[\w-]+)*$/.test(t) && /^(zq-|qitl-|data-|aria-|sb-)/.test(t)) return false;
  if (/^(?:[a-z][\w-]*\s)+[a-z][\w-]*$/.test(t) && /(-|_)/.test(t)) return false; // class lists
  return true;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(e.name) && !e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Files that are not interface code at all (strings, generated tokens, test fixtures, data importers). */
export function skipFile(rel: string): boolean {
  return (
    rel.startsWith("src/lib/i18n/") ||
    rel.startsWith("src/styles/") ||
    rel.includes(".generated.") ||
    rel.startsWith("src/lib/importers/") ||
    rel === "src/lib/e2e-fixtures.ts" ||
    rel.startsWith("src/lib/player/fixture") ||
    rel.includes("/player-fixture/")
  );
}

/** Editorial content and data: reviewed text, not interface strings (tracked by the content review, not here). */
export function isContent(rel: string): boolean {
  return rel.startsWith("src/content/") || rel.startsWith("src/lib/data/") || /src\/lib\/(guidance\/topics|qiraat\/data|lifestyle\/data)\.ts$/.test(rel);
}

function attrName(n: ts.JsxAttribute): string {
  return ts.isIdentifier(n.name) ? n.name.text : n.name.getText();
}

function propName(n: ts.PropertyAssignment): string | null {
  if (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) return n.name.text;
  return null;
}

/** Literal strings inside an expression that end up rendered (ternaries, ||, ??, template heads, array of strings). */
function renderedLiterals(e: ts.Node, out: ts.Node[]) {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) out.push(e);
  else if (ts.isTemplateExpression(e)) {
    out.push(e.head);
    for (const s of e.templateSpans) out.push(s.literal);
  }
  else if (ts.isConditionalExpression(e)) {
    renderedLiterals(e.whenTrue, out);
    renderedLiterals(e.whenFalse, out);
  }
  else if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.PlusToken].includes(e.operatorToken.kind)) {
    renderedLiterals(e.left, out);
    renderedLiterals(e.right, out);
  }
  else if (ts.isParenthesizedExpression(e)) renderedLiterals(e.expression, out);
}

function literalText(n: ts.Node): string {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) return n.text;
  return "";
}

/** True inside a lang="ar"/"ur" element or a non-UI call (console, classnames, fetch, throw new Error for logs). */
function excludedContext(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const c = p.expression.getText();
      if (/^(console\.|cn$|clsx$|fetch$|URL|new URL|encodeURIComponent|searchParams\.|url\.searchParams|params\.|\w+\.(from|select|eq|in|order|rpc|storage|channel|neq|is|or|match|ilike|like|filter|single|maybeSingle|upsert|insert|update|delete|range|limit|contains)$|document\.|localStorage|sessionStorage|querySelector|z\.|require$|import$|headers\.|cookies\.|redirect$|notFound$|revalidatePath$|sb\.|supabase\.|new Intl|Intl\.|toLocale)/.test(c)) return true;
    }
    if (ts.isNewExpression(p) && /Error|URL|RegExp|Intl/.test(p.expression.getText())) return true;
    if (ts.isJsxAttribute(p) && CODE_ATTRS.has(attrName(p))) return true;
    if (ts.isPropertyAssignment(p)) {
      const k = propName(p);
      if (k && (CODE_ATTRS.has(k) || /^(className|href|style|key|id|slug|kind|status|type|role|lang|dir|tone|variant|icon|path|table|column|field|select|order|code|value|color|bg|font|from|to)$/.test(k))) return true;
    }
    if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return true;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return true;
    if (ts.isTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isJsxElement(p)) {
      const lang = p.openingElement.attributes.properties.find((a) => ts.isJsxAttribute(a) && attrName(a) === "lang");
      if (lang && ts.isJsxAttribute(lang) && lang.initializer && /"(ar|ur)"/.test(lang.initializer.getText())) return true;
    }
  }
  return false;
}

export function scanFile(abs: string): Finding[] {
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  const src = fs.readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true, abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Finding[] = [];
  const isApi = rel.startsWith("src/app/api/") || rel.startsWith("src/app/auth/");
  const isPageOrLayout = /\/(page|layout)\.tsx$/.test(rel);
  const isTsx = rel.endsWith(".tsx");
  const add = (n: ts.Node, kind: Finding["kind"], text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!isText(t)) return;
    if (excludedContext(n)) return;
    const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    out.push({ file: rel, line, kind, text: t.length > 90 ? `${t.slice(0, 87)}...` : t });
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) add(n, "jsx-text", n.text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    else if (ts.isJsxAttribute(n)) {
      const name = attrName(n);
      const init = n.initializer;
      if (init && (UI_ATTRS.has(name) || !CODE_ATTRS.has(name))) {
        const lits: ts.Node[] = [];
        if (ts.isStringLiteral(init)) lits.push(init);
        else if (ts.isJsxExpression(init) && init.expression) renderedLiterals(init.expression, lits);
        if (UI_ATTRS.has(name)) for (const l of lits) add(l, "attr", literalText(l));
        else for (const l of lits) if (/\s/.test(literalText(l).trim()) || /^[A-Z][a-z]+/.test(literalText(l))) add(l, "attr", literalText(l));
      }
    }
    else if (ts.isJsxExpression(n) && n.expression && !(n.parent && ts.isJsxAttribute(n.parent))) {
      const lits: ts.Node[] = [];
      renderedLiterals(n.expression, lits);
      for (const l of lits) add(l, "expr", literalText(l));
    }
    else if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer) || ts.isTemplateExpression(n.initializer) || ts.isConditionalExpression(n.initializer))) {
      const k = propName(n);
      const lits: ts.Node[] = [];
      renderedLiterals(n.initializer, lits);
      if (isApi && (k === "error" || k === "message")) for (const l of lits) add(l, "api", literalText(l));
      else if (isPageOrLayout && (k === "title" || k === "description") && inMetadata(n)) for (const l of lits) add(l, "metadata", literalText(l));
      else if (k === "message" && rel === "src/lib/validation.ts") for (const l of lits) add(l, "validation", literalText(l));
      else if (isTsx && k && UI_KEYS.has(k)) for (const l of lits) add(l, "expr", literalText(l));
    }
    else if (ts.isCallExpression(n)) {
      const callee = n.expression.getText();
      if (MESSAGE_CALL.test(callee)) for (const a of n.arguments) {
        const lits: ts.Node[] = [];
        renderedLiterals(a, lits);
        for (const l of lits) add(l, "message", literalText(l));
      }
      if (rel === "src/lib/validation.ts" && /\.(min|max|regex|refine|email|url|length)$/.test(callee)) for (const a of n.arguments.slice(1)) if (ts.isStringLiteral(a)) add(a, "validation", a.text);
      if (isApi && /(^|\.)json$|^(fail|error|bad|deny|problem|reject)\w*$/.test(callee)) for (const a of n.arguments) if (ts.isStringLiteral(a)) add(a, "api", a.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  // One finding per line and text.
  const seen = new Set<string>();
  return out.filter((f) => (seen.has(`${f.line}|${f.text}`) ? false : (seen.add(`${f.line}|${f.text}`), true)));
}

function inMetadata(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && p.name.getText() === "metadata") return true;
    if (ts.isFunctionDeclaration(p) && p.name?.text === "generateMetadata") return true;
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return false;
  }
  return false;
}

/** The module (route or component area) a file belongs to, for the per-module table. */
export function moduleOf(rel: string): string {
  const r = rel.replace(/^src\//, "");
  if (r.startsWith("app/api/") || r.startsWith("app/auth/")) return "api";
  if (/^app\/\[locale\]\/admin|^components\/admin/.test(r)) return "admin";
  if (/^app\/\[locale\]\/(layout|error|not-found|offline)|^app\/\[locale\]\/\[\.\.\.rest\]|^components\/(shell|ui|i18n)\/|^app\/(manifest|sitemap|robots)/.test(r)) return "shell";
  if (/^app\/\[locale\]\/page\.tsx|^components\/journey\//.test(r)) return "home";
  if (/^app\/\[locale\]\/(about|accessibility|contact|corrections|privacy|terms|methodology|review-board)\//.test(r)) return "info";
  if (/^app\/\[locale\]\/(account|sign-in)\/|^components\/account\//.test(r)) return "account";
  if (/^app\/\[locale\]\/(community\/questions|mufti)|^components\/mufti\//.test(r)) return "mufti";
  if (/^app\/\[locale\]\/community|^components\/community\//.test(r)) return "community";
  if (/^app\/\[locale\]\/(dreams)|^components\/dreams\//.test(r)) return "dreams";
  if (/^app\/\[locale\]\/(life-through-ages)|^components\/lifestyle\/|^lib\/lifestyle\//.test(r)) return "lifestyle";
  if (/^app\/\[locale\]\/(stories|prophets)|^components\/story\//.test(r)) return "stories";
  if (/^components\/player\/|^lib\/player\//.test(r)) return "player";
  if (/^components\/quran\/(StudyPanel)|^lib\/interpretation\//.test(r)) return "interpretation";
  if (/^app\/\[locale\]\/quran|^components\/quran\//.test(r)) return "quran";
  const m = /^app\/\[locale\]\/([^/]+)/.exec(r) ?? /^components\/([^/]+)\//.exec(r) ?? /^lib\/([^/.]+)/.exec(r);
  return m ? m[1]! : "other";
}

export function scan(): { findings: Finding[]; content: Finding[] } {
  const findings: Finding[] = [];
  const content: Finding[] = [];
  for (const abs of walk(SRC)) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    if (skipFile(rel)) continue;
    const f = scanFile(abs);
    (isContent(rel) ? content : findings).push(...f);
  }
  return { findings, content };
}

// ---- coverage of the strings files ---------------------------------------------------------------------------------

type Leaves = Array<[string, string]>;
function leaves(o: unknown, prefix = ""): Leaves {
  if (typeof o === "string") return [[prefix, o]];
  if (typeof o !== "object" || o === null) return [];
  return Object.entries(o).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

/** EN leaves, and how many of them render in Arabic and Urdu (a leaf equal to the English one with Latin text is not). */
export function stringCoverage(get: (l: string) => unknown) {
  const en = leaves(get("en"));
  const count = (l: string) => {
    const m = new Map(leaves(get(l)));
    return en.filter(([k, v]) => {
      const t = m.get(k);
      if (t === undefined) return false;
      if (t !== v) return true;
      return !ENGLISH.test(v) || KEEP.has(v.trim()) || /^[\s\d%·—–:,.()/{}$#+-]*$/.test(v) || /^\{?\w+\}?$/.test(v) && !/[a-z]{3}/i.test(v);
    }).length;
  };
  return { en: en.length, ar: count("ar"), ur: count("ur") };
}

async function main() {
  const { findings, content } = scan();
  const { STRING_FILES } = await import("../src/lib/i18n/registry");
  const modules = new Map<string, { hard: Finding[]; en: number; ar: number; ur: number; files: string[] }>();
  const mod = (k: string) => modules.get(k) ?? (modules.set(k, { hard: [], en: 0, ar: 0, ur: 0, files: [] }), modules.get(k)!);
  for (const f of findings) mod(moduleOf(f.file)).hard.push(f);
  for (const s of STRING_FILES) {
    const c = stringCoverage(s.get);
    const m = mod(s.module);
    m.en += c.en;
    m.ar += c.ar;
    m.ur += c.ur;
    m.files.push(s.file);
  }
  const rows = [...modules.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ modules: Object.fromEntries(rows.map(([k, v]) => [k, { strings: v.en, ar: v.ar, ur: v.ur, hardcoded: v.hard.length }])), findings, content: content.length }, null, 1));
    return;
  }
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "n/a");
  const tot = rows.reduce((a, [, v]) => ({ en: a.en + v.en, ar: a.ar + v.ar, ur: a.ur + v.ur, h: a.h + v.hard.length }), { en: 0, ar: 0, ur: 0, h: 0 });
  const lines: string[] = [];
  lines.push("# Localisation status");
  lines.push("");
  lines.push("Generated by `pnpm tsx scripts/i18n-inventory.ts --write` (a heuristic scan with the TypeScript parser, see the");
  lines.push("script's header). Re-run it after adding interface text; `tests/unit/i18n-inventory.test.ts` fails when a module");
  lines.push("gains hard-coded English beyond its recorded budget.");
  lines.push("");
  lines.push("**All Arabic and Urdu interface strings are drafts that need review by a qualified translator** (`draftArabicUi`,");
  lines.push("`draftUrduUi`). Religious content (Quran, hadith, scholarly text, editorial pages) is not interface text and is not");
  lines.push("translated here: in the Arabic and Urdu interfaces it is shown as it is and marked `lang=\"en\" dir=\"ltr\"`.");
  lines.push("");
  lines.push("## Coverage per module");
  lines.push("");
  lines.push("UI strings = keys in the module's strings files + English strings still hard-coded in its files. EN is the share");
  lines.push("that comes from a strings file (all of it renders in English); AR and UR are the share that renders in that language.");
  lines.push("");
  lines.push("| Module | String files | UI strings | EN (externalised) | AR | UR | Hard-coded left |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const [k, v] of rows) {
    const total = v.en + v.hard.length;
    lines.push(`| ${k} | ${v.files.map((f) => `\`${f}\``).join(", ") || "none"} | ${total} | ${pct(v.en, total)} | ${pct(v.ar, total)} | ${pct(v.ur, total)} | ${v.hard.length} |`);
  }
  const all = tot.en + tot.h;
  lines.push(`| **all** | | **${all}** | **${pct(tot.en, all)}** | **${pct(tot.ar, all)}** | **${pct(tot.ur, all)}** | **${tot.h}** |`);
  lines.push("");
  lines.push(`Content strings in src/content and src/lib/data (editorial, not interface; not counted above): ${content.length}.`);
  lines.push("");
  lines.push("## Hard-coded English left, by module");
  lines.push("");
  lines.push("`kind`: jsx-text (text between tags), attr (an interface attribute), expr (a literal rendered from an expression or");
  lines.push("an interface object key), metadata (page title or description), message (a status or error shown to the reader),");
  lines.push("api (an API error message), validation (a form validation message).");
  for (const [k, v] of rows) {
    if (!v.hard.length) continue;
    lines.push("");
    lines.push(`### ${k} (${v.hard.length})`);
    lines.push("");
    lines.push("| File:line | Kind | Text |");
    lines.push("| --- | --- | --- |");
    for (const f of v.hard.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) lines.push(`| \`${f.file}:${f.line}\` | ${f.kind} | ${f.text.replace(/\|/g, "\\|")} |`);
  }
  lines.push("");
  const text = lines.join("\n");
  if (process.argv.includes("--write")) {
    const doc = path.join(ROOT, "docs", "LOCALISATION_STATUS.md");
    const prev = fs.existsSync(doc) ? fs.readFileSync(doc, "utf8") : "";
    const keep = /<!-- before -->[\s\S]*<!-- \/before -->/.exec(prev)?.[0];
    fs.writeFileSync(doc, keep ? text.replace("## Coverage per module", `${keep}\n\n## Coverage per module`) : text);
    console.log(`wrote ${path.relative(ROOT, doc)}: ${tot.h} hard-coded strings`);
  }
  else console.log(text);
}

if (process.argv[1] && /i18n-inventory/.test(process.argv[1])) void main();
