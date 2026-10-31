"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { quranReaderStrings } from "@/lib/i18n/modules/quranReader";
import { readLocalProgress, type ProgressEntry } from "@/lib/quran-reader";

interface ServerRow {
  surah: number;
  ayah: number;
  updated_at: string;
}

/** The reader's places: this device's, plus the account's when signed in; the most recent wins per surah. */
export function useQuranPlaces(): { places: ProgressEntry[]; where: "device" | "account"; ready: boolean } {
  const session = useSession();
  const [state, setState] = useState<{ places: ProgressEntry[]; where: "device" | "account"; ready: boolean }>({ places: [], where: "device", ready: false });
  useEffect(() => {
    if (session.status === "loading") return;
    const local = Object.values(readLocalProgress().surahs);
    if (session.status !== "signed_in") {
      setState({ places: sortPlaces(local), where: "device", ready: true });
      return;
    }
    let live = true;
    fetch("/api/me/quran-progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { progress: ServerRow[] }) => {
        if (!live) return;
        const by = new Map<number, ProgressEntry>();
        for (const p of [...local, ...d.progress.map((r) => ({ surah: r.surah, ayah: r.ayah, at: r.updated_at }))]) {
          const cur = by.get(p.surah);
          if (!cur || Date.parse(cur.at) < Date.parse(p.at)) by.set(p.surah, p);
        }
        setState({ places: sortPlaces([...by.values()]), where: "account", ready: true });
      })
      .catch(() => live && setState({ places: sortPlaces(local), where: "device", ready: true }));
    return () => {
      live = false;
    };
  }, [session.status]);
  return state;
}

const sortPlaces = (xs: ProgressEntry[]) => [...xs].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

/**
 * "Continue reading": the most recent place (and up to `more` others) as links that open the ayah with its highlight.
 * Renders nothing until something has been read, so first-time readers see no empty box.
 */
export function ContinueReading({ names, locale = "en", more = 0, headingLevel = 2 }: { names: Record<number, string>; locale?: string; more?: number; headingLevel?: 2 | 3 }) {
  const t = quranReaderStrings(locale).progress;
  const { places, where, ready } = useQuranPlaces();
  if (!ready || !places.length) return null;
  const [first, ...rest] = places;
  const H = headingLevel === 2 ? "h2" : "h3";
  const label = (p: ProgressEntry) => t.resumeAt(names[p.surah] ?? `Surah ${p.surah}`, `Q ${p.surah}:${p.ayah}`);
  return (
    <section className="pp-card qr-continue" aria-labelledby="qr-continue-h" data-testid="continue-reading">
      <H id="qr-continue-h">{t.continue}</H>
      <Link className="zq-btn zq-btn-primary zq-btn-link" href={`/quran/${first!.surah}#ayah-${first!.ayah}`}>
        {label(first!)}
      </Link>
      {rest.slice(0, more).map((p) => (
        <Link key={p.surah} className="zq-btn zq-btn-secondary zq-btn-link" href={`/quran/${p.surah}#ayah-${p.ayah}`}>
          {label(p)}
        </Link>
      ))}
      <p className="zq-meta">{where === "account" ? t.account : t.device}</p>
    </section>
  );
}
