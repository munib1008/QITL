"use client";

import "@/styles/reader.css";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { quranReaderStrings } from "@/lib/i18n/modules/quranReader";

interface Bookmark {
  id: string;
  target_type: string;
  target_id: string;
  created_at: string;
}
interface Verse {
  id: string;
  surah: number;
  ayah: number;
}

/** How many saved verses show their Arabic (each is one cached request to /api/quran/S/A); the rest are links. */
const WITH_TEXT = 12;

/**
 * "Saved verses" in /account: the reader's quran_verse bookmarks, newest first, each opening the ayah with its
 * highlight. The Arabic comes from the verified source through /api/quran (never stored with the bookmark) and is
 * shown with the Tanzil attribution passed in by the page.
 */
export function SavedVerses({ names, locale = "en", attribution }: { names: Record<number, string>; locale?: string; attribution: ReactNode }) {
  const t = quranReaderStrings(locale).saved;
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/me/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { bookmarks: Bookmark[] }) => {
        if (!live) return;
        const vs = d.bookmarks
          .filter((b) => b.target_type === "quran_verse" && /^\d{1,3}:\d{1,3}$/.test(b.target_id))
          .map((b) => {
            const [s, a] = b.target_id.split(":").map(Number);
            return { id: b.id, surah: s!, ayah: a! };
          });
        setVerses(vs);
        for (const v of vs.slice(0, WITH_TEXT))
          fetch(`/api/quran/${v.surah}/${v.ayah}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((x: { arabic?: string } | null) => {
              if (live && x?.arabic) setText((m) => ({ ...m, [`${v.surah}:${v.ayah}`]: x.arabic! }));
            })
            .catch(() => {});
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  const remove = async (v: Verse) => {
    const r = await fetch("/api/me/bookmarks", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "quran_verse", id: `${v.surah}:${v.ayah}` }) });
    if (r.ok) setVerses((xs) => xs?.filter((x) => x.id !== v.id) ?? null);
  };

  return (
    <section aria-labelledby="qr-saved-h" data-testid="saved-verses">
      <h2 id="qr-saved-h" className="zq-eyebrow">
        {t.title}
      </h2>
      {error ? (
        <p className="zq-error" role="alert">
          {t.loadError}
        </p>
      ) : verses == null ? (
        <Skeleton height={18} />
      ) : verses.length ? (
        <>
          <ul className="qr-saved">
            {verses.map((v) => {
              const ref = `Q ${v.surah}:${v.ayah}`;
              const ar = text[`${v.surah}:${v.ayah}`];
              return (
                <li key={v.id}>
                  <div className="qr-saved-head">
                    <Link href={`/quran/${v.surah}#ayah-${v.ayah}`} aria-label={t.open(ref)}>
                      <b dir="ltr">{ref}</b> {names[v.surah] ? <span className="zq-meta">{names[v.surah]}</span> : null}
                    </Link>
                    <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => remove(v)} aria-label={`${t.remove} ${ref}`}>
                      {t.remove}
                    </button>
                  </div>
                  {ar ? (
                    <p className="zq-ar-quran" lang="ar" dir="rtl">
                      {ar}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {Object.keys(text).length ? attribution : null}
        </>
      ) : (
        <EmptyState title={t.empty}>
          <p>
            <Link href="/quran">Quran</Link>
          </p>
        </EmptyState>
      )}
    </section>
  );
}
