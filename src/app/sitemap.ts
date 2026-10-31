import type { MetadataRoute } from "next";
import { journeyStops } from "@/content/journey";
import { publicEnv } from "@/lib/env";
import { COLLECTIONS } from "@/lib/data/hadith";

/** Public, crawlable routes. Account, admin and search pages are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  const fixed = ["", "/prophets", "/timeline", "/timeline?view=complete", "/atlas", "/quran", "/hadith", "/stories", "/creation", "/events", "/learn", "/genealogy", "/last-hour", "/compare", "/community", "/guidance", "/about", "/methodology", "/review-board", "/corrections", "/accessibility", "/privacy", "/terms"];
  const quran = Array.from({ length: 114 }, (_, i) => `/quran/${i + 1}`);
  const hadith = COLLECTIONS.map((c) => `/hadith/${c.id}`);
  const prophets = journeyStops().map((s) => `/prophets/${s.id}`);
  return [...fixed, ...prophets, ...quran, ...hadith].map((p) => ({
    url: `${base}${p}`,
    alternates: { languages: { en: `${base}${p}`, ar: `${base}/ar${p}`, ur: `${base}/ur${p}` } },
  }));
}
