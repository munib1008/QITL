"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "@/styles/qa.css";
import "@/styles/site-admin.css";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { siteAdminT } from "@/lib/i18n/modules/siteAdmin";
import { Markdown } from "@/components/ui/Markdown";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import {
  cleanTextValue,
  isTextKey,
  LANGS,
  MODULE_FLAG_RE,
  moduleFlagKey,
  NOTE_MAX,
  NOTE_MIN,
  ORDER_KEY,
  TEXT_KEY_LIST,
  TEXT_KEYS,
  type Lang,
  type TextKey,
} from "@/lib/site-config/config";

export interface SiteLink {
  href: string;
  label: string;
  locked: boolean;
}
type Fallbacks = Record<TextKey, Record<Lang, string>>;

interface Revision {
  id: number;
  kind: "setting" | "flag";
  key: string;
  version: number;
  value: Record<string, unknown>;
  note: string;
  changed_at: string;
}
interface Current {
  texts: Partial<Record<TextKey, { value: Partial<Record<Lang, string>>; version: number }>>;
  order: { hrefs: string[]; version: number } | null;
  flags: Record<string, { enabled: boolean; version: number }>;
}

const dirOf = (l: Lang) => (l === "en" ? "ltr" : "rtl");
const noteOk = (n: string) => n.trim().length >= NOTE_MIN && n.trim().length <= NOTE_MAX;

/**
 * /admin/site: edit the home wording and the order and visibility of sections in the menus, with a preview, a required
 * revision note, the history and a revert. Reads go through RLS as the signed-in administrator; every write goes through
 * /api/admin/site, which checks the role and the limits again. Hiding a section only removes it from the menus.
 */
export function AdminSite({ locale, links, fallbacks }: { locale: string; links: SiteLink[]; fallbacks: Fallbacks }) {
  const t = siteAdminT(locale);
  const [current, setCurrent] = useState<Current | null>(null);
  const [history, setHistory] = useState<Revision[]>([]);
  const [error, setError] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const [s, f, h] = await Promise.all([
      sb.from("site_settings").select("key, value, version"),
      sb.from("feature_flags").select("key, enabled, version").like("key", "module.%"),
      sb.from("site_config_revisions").select("id, kind, key, version, value, note, changed_at").order("id", { ascending: false }).limit(40),
    ]);
    if (s.error || f.error) {
      setError(true);
      return;
    }
    const cur: Current = { texts: {}, order: null, flags: {} };
    for (const r of (s.data ?? []) as Array<{ key: string; value: Record<string, unknown>; version: number }>) {
      if (isTextKey(r.key)) cur.texts[r.key] = { value: r.value as Partial<Record<Lang, string>>, version: r.version };
      else if (r.key === ORDER_KEY && Array.isArray(r.value.hrefs)) cur.order = { hrefs: r.value.hrefs as string[], version: r.version };
    }
    for (const r of (f.data ?? []) as Array<{ key: string; enabled: boolean; version: number }>) cur.flags[r.key] = { enabled: r.enabled, version: r.version };
    setCurrent(cur);
    setHistory(((h.data ?? []) as Revision[]).filter((r) => isTextKey(r.key) || r.key === ORDER_KEY || MODULE_FLAG_RE.test(r.key)));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async (body: Record<string, unknown>, okText: string) => {
    setMsg(null);
    try {
      await apiCall("/api/admin/site", "POST", body);
      setMsg({ tone: "ok", text: okText });
      await load();
      return true;
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
      return false;
    }
  };

  return (
    <div className="qa sa" data-testid="admin-site">
      <p className="qa-notice">{t.nothingPublishes}</p>
      <Feedback msg={msg} />
      {error ? (
        <p className="zq-error" role="alert">
          {t.loadError}
        </p>
      ) : !current ? (
        <Skeleton height={24} />
      ) : (
        <>
          <section className="qa-sec" aria-labelledby="sa-text-h">
            <h2 id="sa-text-h">{t.text.title}</h2>
            <p className="zq-meta">{t.text.lead}</p>
            {TEXT_KEY_LIST.map((key) => (
              <TextBlock key={`${key}-${current.texts[key]?.version ?? 0}`} locale={locale} k={key} current={current.texts[key]?.value ?? {}} fallback={fallbacks[key]} onSend={send} />
            ))}
          </section>
          <MenusEditor locale={locale} links={links} current={current} onSend={send} />
          <History locale={locale} links={links} history={history} current={current} onSend={send} />
        </>
      )}
    </div>
  );
}

function TextBlock({
  locale,
  k,
  current,
  fallback,
  onSend,
}: {
  locale: string;
  k: TextKey;
  current: Partial<Record<Lang, string>>;
  fallback: Record<Lang, string>;
  onSend: (body: Record<string, unknown>, ok: string) => Promise<boolean>;
}) {
  const t = siteAdminT(locale);
  const spec = TEXT_KEYS[k];
  const [draft, setDraft] = useState<Record<Lang, string>>({ en: current.en ?? "", ar: current.ar ?? "", ur: current.ur ?? "" });
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<Partial<Record<Lang, string>>>({});
  const [busy, setBusy] = useState(false);
  const id = k.replace(/\./g, "-");

  const save = async (value: Record<string, string>) => {
    const check = cleanTextValue(k, value);
    if (!check.ok) {
      setProblems({ [check.lang]: t.text.problems[check.problem] ?? t.text.problems.empty });
      return;
    }
    setProblems({});
    setBusy(true);
    await onSend({ action: "text", key: k, value: check.value, note: note.trim() }, t.saved);
    setBusy(false);
  };

  return (
    <fieldset className="qa-card sa-block" data-testid={`text-${k}`}>
      <legend>{t.text.blocks[k]}</legend>
      {k === "home.hero.lead" ? <p className="zq-meta">{t.text.honorific}</p> : null}
      {LANGS.map((l) => {
        const text = draft[l].trim();
        const shown = text || fallback[l];
        return (
          <div key={l} className="zq-field sa-lang">
            <label htmlFor={`${id}-${l}`}>{t.langs[l]}</label>
            <textarea
              id={`${id}-${l}`}
              className="zq-textarea"
              dir={dirOf(l)}
              lang={l}
              rows={spec.multiline ? 5 : 2}
              maxLength={spec.max}
              value={draft[l]}
              aria-invalid={problems[l] ? true : undefined}
              aria-describedby={`${id}-${l}-d`}
              onChange={(e) => setDraft((d) => ({ ...d, [l]: e.target.value }))}
            />
            <span className="zq-help" id={`${id}-${l}-d`}>
              {t.text.count(draft[l].length, spec.max)}
              {problems[l] ? ` · ${problems[l]}` : ""}
            </span>
            <details className="sa-preview">
              <summary>{t.text.preview}</summary>
              <div className="sa-preview-box" dir={dirOf(l)} lang={l}>
                {text ? (spec.multiline ? <Markdown source={shown} /> : <p>{shown}</p>) : <p>{t.text.previewEmpty}</p>}
              </div>
              <p className="zq-meta">
                <b>{t.text.builtIn}: </b>
                <span dir={dirOf(l)} lang={l}>
                  {fallback[l]}
                </span>
              </p>
            </details>
          </div>
        );
      })}
      <div className="zq-field">
        <label htmlFor={`${id}-note`}>{t.text.note}</label>
        <input id={`${id}-note`} className="zq-input" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} aria-describedby={`${id}-note-d`} />
        <span className="zq-help" id={`${id}-note-d`}>
          {t.text.noteHelp}
        </span>
      </div>
      <div className="qa-actions">
        <button type="button" className="zq-btn zq-btn-primary" disabled={busy || !noteOk(note)} onClick={() => save(draft)}>
          {t.text.save}
        </button>
        <button type="button" className="zq-btn zq-btn-quiet" disabled={busy || !noteOk(note)} onClick={() => save({})}>
          {t.text.useBuiltIn}
        </button>
      </div>
    </fieldset>
  );
}

function MenusEditor({ locale, links, current, onSend }: { locale: string; links: SiteLink[]; current: Current; onSend: (body: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const t = siteAdminT(locale);
  const start = useMemo(() => {
    const rank = new Map((current.order?.hrefs ?? []).map((h, i) => [h, i] as const));
    return [...links].sort((a, b) => (rank.get(a.href) ?? 1e6) - (rank.get(b.href) ?? 1e6) || links.indexOf(a) - links.indexOf(b));
  }, [links, current.order]);
  const hiddenNow = useMemo(() => new Set(links.filter((l) => !l.locked && current.flags[moduleFlagKey(l.href)]?.enabled === false).map((l) => l.href)), [links, current.flags]);
  const [order, setOrder] = useState<SiteLink[]>(start);
  const [hidden, setHidden] = useState<Set<string>>(hiddenNow);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const toggle = (href: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  const changed = order.map((l) => l.href).join() !== start.map((l) => l.href).join() || [...hidden].sort().join() !== [...hiddenNow].sort().join();

  return (
    <section className="qa-sec" aria-labelledby="sa-menu-h">
      <h2 id="sa-menu-h">{t.menus.title}</h2>
      <p className="zq-meta">{t.menus.lead}</p>
      <ul className="qa-list sa-menu" data-testid="menu-editor">
        {order.map((l, i) => (
          <li key={l.href} className="qa-card sa-row" data-hidden={hidden.has(l.href) || undefined}>
            <span className="sa-label">
              <b>{l.label}</b>
              <small dir="ltr">{l.href}</small>
            </span>
            <span className="qa-actions">
              <button type="button" className="zq-btn zq-btn-quiet sa-sq" aria-label={t.menus.up(l.label)} disabled={i === 0} onClick={() => move(i, -1)}>
                <span aria-hidden="true">↑</span>
              </button>
              <button type="button" className="zq-btn zq-btn-quiet sa-sq" aria-label={t.menus.down(l.label)} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                <span aria-hidden="true">↓</span>
              </button>
              {l.locked ? (
                <span className="qa-pill">{t.menus.always}</span>
              ) : (
                <button
                  type="button"
                  className="zq-btn zq-btn-secondary"
                  aria-pressed={hidden.has(l.href)}
                  aria-label={hidden.has(l.href) ? t.menus.show(l.label) : t.menus.hide(l.label)}
                  onClick={() => toggle(l.href)}
                >
                  {hidden.has(l.href) ? t.menus.hidden : t.menus.shown}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="qa-card">
        <h3>{t.menus.preview}</h3>
        <ol className="qa-limits" data-testid="menu-preview">
          {order
            .filter((l) => !hidden.has(l.href))
            .map((l) => (
              <li key={l.href}>{l.label}</li>
            ))}
        </ol>
      </div>
      <div className="zq-field">
        <label htmlFor="sa-menu-note">{t.menus.note}</label>
        <input id="sa-menu-note" className="zq-input" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} aria-describedby="sa-menu-note-d" />
        <span className="zq-help" id="sa-menu-note-d">
          {t.menus.noteHelp}
        </span>
      </div>
      {notice ? (
        <p role="status" className="zq-help">
          {notice}
        </p>
      ) : null}
      <div className="qa-actions">
        <button
          type="button"
          className="zq-btn zq-btn-primary"
          disabled={busy || !noteOk(note)}
          onClick={async () => {
            if (!changed) {
              setNotice(t.menus.unchanged);
              return;
            }
            setNotice(null);
            setBusy(true);
            await onSend({ action: "nav", hrefs: order.map((l) => l.href), hidden: [...hidden], note: note.trim() }, t.saved);
            setBusy(false);
          }}
        >
          {t.menus.save}
        </button>
      </div>
    </section>
  );
}

function History({
  locale,
  links,
  history,
  current,
  onSend,
}: {
  locale: string;
  links: SiteLink[];
  history: Revision[];
  current: Current;
  onSend: (body: Record<string, unknown>, ok: string) => Promise<boolean>;
}) {
  const t = siteAdminT(locale);
  const [note, setNote] = useState("");
  const labelOf = (key: string) => {
    if (isTextKey(key)) return t.text.blocks[key] ?? key;
    if (key === ORDER_KEY) return t.menus.title;
    return links.find((l) => moduleFlagKey(l.href) === key)?.label ?? key;
  };
  const versionNow = (r: Revision) => (r.kind === "flag" ? current.flags[r.key]?.version : r.key === ORDER_KEY ? current.order?.version : isTextKey(r.key) ? current.texts[r.key]?.version : undefined);
  const summary = (r: Revision) => {
    if (r.kind === "flag") return r.value.enabled === false ? t.history.valueHidden : t.history.valueShown;
    if (r.key === ORDER_KEY) return t.history.sections(Array.isArray(r.value.hrefs) ? r.value.hrefs.length : 0);
    const first = (["en", "ar", "ur"] as const).map((l) => r.value[l]).find((v): v is string => typeof v === "string");
    return first ? first.slice(0, 60) : t.text.previewEmpty;
  };
  return (
    <section className="qa-sec" aria-labelledby="sa-hist-h">
      <h2 id="sa-hist-h">{t.history.title}</h2>
      {!history.length ? (
        <p className="zq-meta">{t.history.empty}</p>
      ) : (
        <>
          <div className="zq-field">
            <label htmlFor="sa-revert-note">{t.history.revertNote}</label>
            <input id="sa-revert-note" className="zq-input" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
          </div>
          <ul className="qa-list" data-testid="site-history">
            {history.map((r) => {
              const isCurrent = versionNow(r) === r.version;
              return (
                <li key={r.id} className="qa-card">
                  <div className="qa-meta">
                    <span className="qa-pill">{t.history.kinds[r.kind]}</span>
                    <b>{labelOf(r.key)}</b>
                    <span>{t.history.version(r.version)}</span>
                    <span>{new Date(r.changed_at).toLocaleString(locale)}</span>
                  </div>
                  <p>{summary(r)}</p>
                  <p className="zq-meta">{r.note}</p>
                  {isCurrent ? (
                    <span className="qa-pill">{t.history.current}</span>
                  ) : (
                    <div className="qa-actions">
                      <button
                        type="button"
                        className="zq-btn zq-btn-secondary"
                        disabled={!noteOk(note)}
                        onClick={() => onSend({ action: "revert", kind: r.kind, key: r.key, version: r.version, note: note.trim() }, t.history.reverted)}
                      >
                        {t.history.revert}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
