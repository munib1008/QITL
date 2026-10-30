"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type Msg = { tone: "ok" | "err"; text: string } | null;

export async function call(url: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : `Request failed (${r.status})`);
  return d;
}

export const sb = () => getBrowserSupabase();

/** Load rows once (and on reload) through the browser client: RLS shows producers what they may see. */
export function useRows<T>(load: () => PromiseLike<{ data: unknown; error: { message: string } | null }> | null, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const q = load();
    if (!q) return setError("Not configured");
    const res = await q;
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setRows((res.data as T[] | null) ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, error, reload };
}

export function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
      {msg.text}
    </p>
  );
}

export function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <label className="zq-field">
      <span>{label}</span>
      {children}
      {help ? <span className="zq-help">{help}</span> : null}
    </label>
  );
}

export function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="pp-card st-panel" aria-labelledby={id}>
      <h2 id={id} className="st-h">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Run an action with feedback; "not_configured" is shown plainly. */
export function useAction() {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>, ok: string, after?: () => unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: ok });
      await after?.();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }, []);
  return { msg, busy, run, setMsg };
}
