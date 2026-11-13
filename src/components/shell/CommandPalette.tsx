"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { hudStrings } from "@/lib/i18n/modules/hud";
import { searchStrings } from "@/lib/i18n/modules/search";
import type { SearchHit } from "@/lib/search";
import { useLocale } from "@/lib/i18n/useLocale";
import { OPEN_SEARCH_EVENT } from "./SearchTrigger";

interface QuickLink {
  href: string;
  label: string;
}
interface Row {
  id: string;
  href: string;
  title: string;
  titleAr?: string;
  tag?: string;
}

const MAX_ROWS = 8;

/**
 * The command palette: Ctrl/Cmd+K anywhere, or the search buttons in the header and the mobile bar. It queries the same
 * unified index as /search (/api/search) and shows only each result's own title, its Arabic title and its type; the full
 * page remains one Enter away. Combobox pattern: focus stays in the input, arrows move the active option (aria-activedescendant),
 * Esc closes, and focus returns to the control that opened it. With nothing typed it lists the sections.
 */
export function CommandPalette({ quick }: { quick: QuickLink[] }) {
  const locale = useLocale();
  const t = hudStrings(locale).search;
  const facets = searchStrings(locale).facets as Record<string, string>;
  const router = useRouter();
  const uid = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits(null);
    setState("idle");
    setActive(0);
    opener.current?.focus();
  }, []);

  // Open: Ctrl/Cmd+K toggles; the header and mobile-bar buttons dispatch OPEN_SEARCH_EVENT.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("locked");
    input.current?.focus();
    return () => document.body.classList.remove("locked");
  }, [open]);

  // Debounced query against the existing unified index.
  useEffect(() => {
    const term = q.trim();
    if (!open || !term) {
      setHits(null);
      setState("idle");
      return;
    }
    setState("loading");
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&locale=${locale}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results?: SearchHit[] };
        setHits((data.results ?? []).slice(0, MAX_ROWS));
        setState("idle");
        setActive(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, open, locale]);

  const term = q.trim();
  const rows: Row[] = term
    ? (hits ?? []).map((h) => ({ id: `${h.type}-${h.id}`, href: h.url, title: h.title, titleAr: h.titleAr, tag: h.kind ? (searchStrings(locale).types as Record<string, string>)[h.kind] : facets[h.facet] }))
    : quick.map((l) => ({ id: l.href, href: l.href, title: l.label }));
  const fullHref = `/search?q=${encodeURIComponent(term)}`;
  const optionId = (i: number) => `${uid}-opt-${i}`;
  const go = (href: string) => {
    close();
    router.push(href);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (rows.length ? (a + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (term && !rows.length) go(fullHref);
      else if (rows[active]) go(rows[active].href);
      else if (term) go(fullHref);
    } else if (e.key === "Tab" && dialog.current) {
      // Focus trap: input, then the buttons and the full-results link.
      const f = Array.from(dialog.current.querySelectorAll<HTMLElement>("input, button, a[data-trap]"));
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  if (!open) return null;
  const status = state === "loading" ? t.searching : state === "error" ? t.failed : term ? (hits ? (hits.length === 1 ? t.count.one : t.count.many.replace("{n}", String(hits.length))) : "") : "";
  return (
    <div className="dialogback palette" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-label={t.title} onKeyDown={onKeyDown}>
        <div className="dialoghead">
          <label className="searchfield" htmlFor={`${uid}-q`}>
            <Icon.search />
            <span className="sr-only">{t.label}</span>
            <input
              ref={input}
              id={`${uid}-q`}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={`${uid}-list`}
              aria-activedescendant={rows.length ? optionId(active) : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button type="button" className="iconbtn" onClick={close} aria-label={t.close}>
            <Icon.close />
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
        <p className="palette-label" aria-hidden="true">
          {term ? t.results : t.quick}
        </p>
        <ul id={`${uid}-list`} role="listbox" aria-label={term ? t.results : t.quick} className="palette-list">
          {rows.map((r, i) => (
            <li key={r.id} id={optionId(i)} role="option" aria-selected={i === active} className="result" data-active={i === active || undefined} onMouseMove={() => setActive(i)}>
              <Link href={r.href} tabIndex={-1} onClick={() => close()}>
                <b>{r.title}</b>
                {r.titleAr ? (
                  <span lang="ar" dir="rtl" className="arabic">
                    {r.titleAr}
                  </span>
                ) : null}
                {r.tag ? <small>{r.tag}</small> : null}
              </Link>
            </li>
          ))}
        </ul>
        {term && state === "idle" && hits && !hits.length ? <p className="empty">{t.none.replace("{q}", term)}</p> : null}
        {state === "error" ? <p className="empty">{t.failed}</p> : null}
        <div className="palette-foot">
          <span aria-hidden="true">{t.hint}</span>
          {term ? (
            <Link href={fullHref} data-trap onClick={() => close()} className="textlink">
              {t.all.replace("{q}", term)}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
