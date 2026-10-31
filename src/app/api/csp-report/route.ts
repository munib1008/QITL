import type { NextRequest } from "next/server";
import { logWarn } from "@/lib/observability/errors";

/**
 * Browser Content-Security-Policy violation reports (report-uri in src/lib/security/csp.ts). Logged as one scrubbed
 * line: the violated directive, the blocked origin (or "inline"/"eval") and the page path. Never the sample, the
 * referrer or the full URL. Rate limited per IP by the middleware; bodies over 16 KB are ignored.
 */
export async function POST(req: NextRequest) {
  const text = await req.text().catch(() => "");
  if (text.length > 16_384) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  // application/csp-report: { "csp-report": {...} }; application/reports+json: [{ type, body: {...} }].
  const reports: Array<Record<string, unknown>> = Array.isArray(body)
    ? body.map((r) => (r as { body?: Record<string, unknown> })?.body ?? {}).slice(0, 20)
    : [((body as { "csp-report"?: Record<string, unknown> })?.["csp-report"] ?? {}) as Record<string, unknown>];
  for (const r of reports) {
    const directive = String(r["effective-directive"] ?? r["effectiveDirective"] ?? r["violated-directive"] ?? "").split(" ")[0] ?? "";
    const blocked = String(r["blocked-uri"] ?? r["blockedURL"] ?? "");
    const page = String(r["document-uri"] ?? r["documentURL"] ?? "");
    let path = "";
    try {
      path = new URL(page).pathname;
    } catch {
      path = "";
    }
    logWarn("csp_violation", { directive: directive.slice(0, 40), blocked, path, kind: String(r["disposition"] ?? "") });
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
