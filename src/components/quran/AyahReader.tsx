"use client";

import "@/styles/reader.css";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import { useSession } from "@/components/account/useSession";
import { Icon } from "@/components/ui/icons";
import { interpretationT } from "@/lib/i18n/modules/interpretation";
import { quranReaderStrings, type QuranReaderStrings } from "@/lib/i18n/modules/quranReader";
import { ayahAtLine, ayahShareText, readLocalProgress, saveLocalProgress, type AyahMarker } from "@/lib/quran-reader";
import { StudyLayout, type StudyTarget } from "./StudyPanel";
import { parseAyahHash, useAyahHighlight } from "./useAyahHighlight";

const SIZES = [24, 28, 32, 38, 44, 48];
/** Ayat are grouped in chunks; a chunk's controls mount when it nears the viewport (see the component's note). */
export const CHUNK = 20;
const NEAR = "1200px 0px";
/** Where the eye reads: ayat above this line (px from the top, below the sticky header and the anchors' scroll margin) count as read past. */
const READ_LINE = 160;

type Links = Record<number, Array<{ id: string; name: string }>>;

interface Props {
  surah: number;
  surahName: string;
  verses: Array<{ ayah: number; text: string }>;
  links: Links;
  locale?: string;
  /** Juz / hizb / page starts in this surah (empty when the divisions were not imported). */
  markers?: Record<number, AyahMarker>;
  /** The Tanzil attribution line carried with every copied or shared ayah. */
  attribution: string;
}

/**
 * The ayah reader. Arabic is user-scalable 24–48px (remembered per reader), never truncated or letter-spaced, and is
 * copied or shared exactly as served. Each ayah keeps a persistent anchor (#ayah-N), a citation, a "Study" button
 * (the Interpretation Explorer), a bookmark, copy and, where the browser offers it, share.
 *
 * Long surahs: every ayah's Arabic, anchor and citation are in the HTML (anchors, find-in-page and the 3-second
 * highlight work for all of them), but the browser skips layout and paint off screen (content-visibility, reader.css)
 * and an ayah's controls (study, bookmark, copy, share) mount by chunks of CHUNK ayat when the chunk nears the
 * viewport, receives focus or is targeted by #ayah-N. The first chunk is complete in the server HTML.
 *
 * Keys (outside text fields): J next ayah, K previous ayah (G focuses "Go to an ayah"). Reading progress: after the
 * reader scrolls, the ayah under the reading line is kept on this device, and in the account when signed in.
 */
export function AyahReader({ surah, surahName, verses, links, locale = "en", markers = {}, attribution }: Props) {
  const [size, setSize] = useState(32);
  const [study, setStudy] = useState<StudyTarget | null>(null);
  const [copied, setCopied] = useState<{ ayah: number; ok: boolean } | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [active, setActive] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [resume, setResume] = useState<number | null>(null);
  const t = interpretationT(locale);
  const r = useMemo(() => quranReaderStrings(locale), [locale]);
  const session = useSession();
  const list = useRef<HTMLOListElement>(null);
  const signedIn = useRef(false);
  signedIn.current = session.status === "signed_in";
  const last = verses.length;
  useAyahHighlight();

  const activate = useCallback((ayah: number) => {
    const c = Math.floor((ayah - 1) / CHUNK);
    setActive((s) => (s.has(c) ? s : new Set([...s, c])));
  }, []);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("qitl-quran-size"));
      if (SIZES.includes(v)) setSize(v);
    } catch {
      // storage unavailable
    }
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    // Offer to resume where this reader left off, unless the link already names an ayah.
    if (!parseAyahHash(window.location.hash)) {
      const p = readLocalProgress().surahs[String(surah)];
      if (p && p.ayah > 1 && p.ayah <= last) setResume(p.ayah);
    }
  }, [surah, last]);

  // Before the first paint: a linked ayah's chunk is complete before the highlight (deferred a frame) scrolls to it.
  useLayoutEffect(() => {
    const h = parseAyahHash(window.location.hash);
    if (h) {
      activate(h.from);
      activate(h.to);
    }
  }, [activate]);

  // Mount the controls of chunks near the viewport, of a targeted ayah and of anything focused.
  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const fromHash = () => {
      const h = parseAyahHash(window.location.hash);
      if (h) {
        activate(h.from);
        activate(h.to);
      }
    };
    fromHash();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) activate(Number((e.target as HTMLElement).dataset.ayah));
      },
      { rootMargin: NEAR },
    );
    for (const li of ol.querySelectorAll<HTMLElement>("li[data-ayah]")) io.observe(li);
    const onFocus = (e: FocusEvent) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-ayah]");
      if (li) activate(Number(li.dataset.ayah));
    };
    ol.addEventListener("focusin", onFocus);
    window.addEventListener("hashchange", fromHash);
    return () => {
      io.disconnect();
      ol.removeEventListener("focusin", onFocus);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [activate]);

  /** The ayah under the reading line now. */
  const currentAyah = useCallback((): number | null => {
    const ol = list.current;
    if (!ol) return null;
    const rects = [...ol.querySelectorAll<HTMLElement>("li[data-ayah]")].map((li) => {
      const b = li.getBoundingClientRect();
      return { ayah: Number(li.dataset.ayah), top: b.top, bottom: b.bottom };
    });
    return ayahAtLine(rects, READ_LINE);
  }, []);

  // Reading progress: recorded only after the reader scrolls (opening a surah and leaving keeps the old place).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = "";
    let serverTimer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const a = currentAyah();
      if (!a) return;
      saveLocalProgress(surah, a);
      setResume(null);
      if (!signedIn.current) return;
      const key = `${surah}:${a}`;
      if (key === sent) return;
      clearTimeout(serverTimer);
      serverTimer = setTimeout(() => {
        sent = key;
        void fetch("/api/me/quran-progress", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ surah, ayah: a }), keepalive: true }).catch(() => {
          sent = "";
        });
      }, 1500);
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(save, 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      clearTimeout(serverTimer);
    };
  }, [surah, currentAyah]);

  // J / K: next / previous ayah, from the highlighted (or focused, or top) ayah. Moves the hash, so the highlight runs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "j" && e.key !== "k") || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      const focused = el?.closest?.<HTMLElement>("li[data-ayah]");
      const h = parseAyahHash(window.location.hash);
      const target = h ? document.getElementById(`ayah-${h.to}`)?.getBoundingClientRect() : undefined;
      const targetVisible = !!target && target.bottom > 0 && target.top < window.innerHeight;
      const from = focused ? Number(focused.dataset.ayah) : targetVisible ? h!.to : (currentAyah() ?? 0);
      const to = Math.min(last, Math.max(1, from + (e.key === "j" ? 1 : -1)));
      if (to === from && focused) return;
      e.preventDefault();
      goTo(to);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [last, currentAyah]);

  const set = (v: number) => {
    setSize(v);
    try {
      localStorage.setItem("qitl-quran-size", String(v));
    } catch {
      // ignore
    }
  };

  const onStudy = useCallback((ayah: number, text: string) => setStudy({ surah, ayah, arabic: text, related: links[ayah] ?? [] }), [surah, links]);

  const onCopy = useCallback(
    async (ayah: number, text: string) => {
      const payload = ayahShareText({ arabic: text, surah, ayah, surahName, attribution, url: ayahUrl(ayah) });
      let ok = true;
      try {
        await navigator.clipboard.writeText(payload);
      } catch {
        ok = false;
      }
      setCopied({ ayah, ok });
      setTimeout(() => setCopied((c) => (c?.ayah === ayah ? null : c)), ok ? 2000 : 5000);
    },
    [surah, surahName, attribution],
  );

  const onShare = useCallback(
    async (ayah: number, text: string) => {
      try {
        await navigator.share({ title: r.actions.shareTitle(`Q ${surah}:${ayah}`), text: ayahShareText({ arabic: text, surah, ayah, surahName, attribution }), url: ayahUrl(ayah) });
      } catch {
        // dismissed by the reader, or not allowed: nothing to do
      }
    },
    [surah, surahName, attribution, r],
  );

  const i = SIZES.indexOf(size);
  return (
    <StudyLayout target={study} locale={locale} onClose={() => setStudy(null)}>
      <section aria-label={`Surah ${surahName}, Arabic text`}>
        <div className="zq-filters" role="group" aria-label="Arabic text size" style={{ marginBottom: 12 }}>
          <span className="zq-eyebrow">Text size</span>
          <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => set(SIZES[Math.max(0, i - 1)]!)} disabled={i <= 0} aria-label="Smaller Arabic text">
            A−
          </button>
          <output className="zq-order" aria-live="polite">
            {size}px
          </output>
          <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => set(SIZES[Math.min(SIZES.length - 1, i + 1)]!)} disabled={i >= SIZES.length - 1} aria-label="Larger Arabic text">
            A+
          </button>
        </div>
        <p className="qr-keys" id="qr-keys">
          <span className="qr-sr">{r.keys.title}: </span>
          <kbd>J</kbd> {r.keys.next} · <kbd>K</kbd> {r.keys.prev} · <kbd>G</kbd> {r.jump.title}
        </p>
        {resume ? (
          <div className="qr-resume" data-testid="resume-banner">
            <p>{r.progress.resumeHere(`Q ${surah}:${resume}`)}</p>
            <a className="zq-btn zq-btn-primary zq-btn-sm" href={`#ayah-${resume}`} onClick={() => setResume(null)}>
              {r.progress.resume}
            </a>
          </div>
        ) : null}
        <ol ref={list} className="qr-list" style={{ listStyle: "none", margin: 0, padding: 0, "--qr-size": `${size}px` } as CSSProperties}>
          {verses.map((v) => (
            <AyahItem
              key={v.ayah}
              surah={surah}
              ayah={v.ayah}
              text={v.text}
              marker={markers[v.ayah]}
              links={links[v.ayah]}
              live={active.has(Math.floor((v.ayah - 1) / CHUNK))}
              studied={study?.ayah === v.ayah}
              copied={copied?.ayah === v.ayah ? copied.ok : null}
              canShare={canShare}
              studyLabel={t.study}
              studyAria={t.studyAyah(`Q ${surah}:${v.ayah}`)}
              r={r}
              onStudy={onStudy}
              onCopy={onCopy}
              onShare={onShare}
            />
          ))}
        </ol>
      </section>
    </StudyLayout>
  );
}

function ayahUrl(ayah: number): string {
  return `${window.location.origin}${window.location.pathname}#ayah-${ayah}`;
}

/** Move to an ayah: replace the hash (no history entry per key press) and let the highlight bring it into view. */
function goTo(ayah: number) {
  history.replaceState(history.state, "", `#ayah-${ayah}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  document.getElementById(`ayah-${ayah}`)?.focus({ preventScroll: true });
}

interface ItemProps {
  surah: number;
  ayah: number;
  text: string;
  marker: AyahMarker | undefined;
  links: Links[number] | undefined;
  live: boolean;
  studied: boolean;
  copied: boolean | null;
  canShare: boolean;
  studyLabel: string;
  studyAria: string;
  r: QuranReaderStrings;
  onStudy: (ayah: number, text: string) => void;
  onCopy: (ayah: number, text: string) => void;
  onShare: (ayah: number, text: string) => void;
}

const AyahItem = memo(function AyahItem({ surah, ayah, text, marker, links, live, studied, copied, canShare, studyLabel, studyAria, r, onStudy, onCopy, onShare }: ItemProps) {
  const related = (links ?? []).map((l) => (
    <Link key={l.id} className="zq-iconbtn" href={`/prophets/${l.id}`} prefetch={false}>
      {l.name} →
    </Link>
  ));
  // A plain same-page anchor: the highlight hook replays it on click; no router work per ayah.
  const cite = (
    <a className="zq-chip" href={`#ayah-${ayah}`} data-citation="">
      <span dir="ltr">{`Q ${surah}:${ayah}`}</span>
    </a>
  );
  return (
    <li id={`ayah-${ayah}`} className="zq-ayah" data-ayah={ayah} data-light={live ? undefined : ""} tabIndex={-1} aria-label={`Q ${surah}:${ayah}`}>
      {marker ? <Markers m={marker} r={r} /> : null}
      <p className="zq-ar-quran" lang="ar" dir="rtl">
        {text}
      </p>
      {live ? (
        <div className="zq-actions" role="group" aria-label={`Ayah ${ayah}`}>
          {cite}
          <button type="button" className="zq-iconbtn qs-study-btn" aria-haspopup="dialog" aria-pressed={studied} aria-label={studyAria} onClick={() => onStudy(ayah, text)}>
            <Icon.source />
            {studyLabel}
          </button>
          <BookmarkButton target={{ type: "quran_verse", id: `${surah}:${ayah}` }} variant="icon" />
          <button type="button" className="zq-iconbtn" data-copy-ayah={ayah} onClick={() => onCopy(ayah, text)}>
            {copied ? <Icon.check /> : <Icon.copy />}
            {copied === true ? r.actions.copied : r.actions.copy}
          </button>
          {canShare ? (
            <button type="button" className="zq-iconbtn" onClick={() => onShare(ayah, text)}>
              <Icon.share />
              {r.actions.share}
            </button>
          ) : null}
          {related}
          {copied === false ? (
            <span role="alert" className="zq-error">
              {r.actions.copyFailed}
            </span>
          ) : copied === true ? (
            <span role="status" className="qr-sr">
              {r.actions.copied}
            </span>
          ) : null}
        </div>
      ) : (
        // Far from the viewport: the citation (focusable, so Tab reaches it and mounts the rest) and related links only.
        <div className="zq-actions" role="group" aria-label={`Ayah ${ayah}`}>
          {cite}
          {related}
        </div>
      )}
    </li>
  );
});

function Markers({ m, r }: { m: AyahMarker; r: QuranReaderStrings }) {
  return (
    <ul className="qr-markers" aria-label={r.markers.label}>
      {m.juz ? (
        <li className="qr-marker" data-kind="juz">
          {r.markers.juz(m.juz)}
        </li>
      ) : null}
      {m.hizb ? (
        <li className="qr-marker" data-kind="hizb">
          {r.markers.hizb(m.hizb.hizb, m.hizb.quarter)}
        </li>
      ) : null}
      {m.page ? (
        <li className="qr-marker" data-kind="page">
          {r.markers.page(m.page)}
        </li>
      ) : null}
    </ul>
  );
}
