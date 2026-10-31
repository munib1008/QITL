import "@/styles/qa.css";
import { apiErrorText } from "@/lib/i18n/modules/api";

/**
 * Same-origin JSON call used by the Q&A and dream client components. Throws the error for the response's code in the
 * page's interface language (html lang; the server's English message in English).
 */
export async function apiCall<T = Record<string, unknown>>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!r.ok) throw new Error(apiErrorText(document.documentElement.lang, d));
  return d;
}

export type Msg = { tone: "ok" | "err"; text: string } | null;

export function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
      {msg.text}
    </p>
  );
}
