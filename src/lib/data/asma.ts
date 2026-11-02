import "server-only";
import { getPublicSupabase } from "@/lib/supabase/server";
import type { DuaDoc, DuaListItem, Measure, NameDoc, NameListItem, OccurrencePage, TopicDoc } from "@/lib/asma/model";

/**
 * Reads of the Asma' al-Husna module. Everything comes through the public_asma_* database functions: the tables stay
 * closed to visitors. Null = the database is not connected (or the call failed); undefined = no such visible record.
 */
export const SLUG = /^[a-z][a-z0-9-]{1,60}$/;

/** { data } on success (data may be null), null when there is no client or the call failed. */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null } | null> {
  const sb = getPublicSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc(fn, args);
  if (error) return null;
  return { data: (data ?? null) as T | null };
}

export async function asmaNames(): Promise<NameListItem[] | null> {
  const r = await rpc<NameListItem[]>("public_asma_names");
  return r ? r.data ?? [] : null;
}

export async function asmaName(slug: string): Promise<NameDoc | null | undefined> {
  if (!SLUG.test(slug)) return undefined;
  const r = await rpc<NameDoc>("public_asma_name", { p_slug: slug });
  return r ? r.data ?? undefined : null;
}

export async function asmaOccurrences(slug: string, measure: Measure, limit: number, offset: number, surah: number | null): Promise<OccurrencePage | null | undefined> {
  if (!SLUG.test(slug)) return undefined;
  const r = await rpc<OccurrencePage>("public_asma_occurrences", { p_slug: slug, p_measure: measure, p_limit: limit, p_offset: offset, p_surah: surah });
  return r ? r.data ?? undefined : null;
}

export async function asmaDuas(): Promise<DuaListItem[] | null> {
  const r = await rpc<DuaListItem[]>("public_asma_duas");
  return r ? r.data ?? [] : null;
}
export async function asmaDua(slug: string): Promise<DuaDoc | null | undefined> {
  if (!SLUG.test(slug)) return undefined;
  const r = await rpc<DuaDoc>("public_asma_dua", { p_slug: slug });
  return r ? r.data ?? undefined : null;
}
export async function asmaTopics(): Promise<TopicDoc[] | null> {
  const r = await rpc<TopicDoc[]>("public_asma_topics");
  return r ? r.data ?? [] : null;
}

type Confirmed = Record<number, Array<{ slug: string; ar: string; transliteration: string }>>;
const memo = new Map<number, { at: number; value: Promise<Confirmed> }>();

/**
 * Reviewer-confirmed occurrences in one surah, for the Quran reader's "Explore this Name" link. {} when none or not connected.
 * Memoised for a minute so the three language versions of a surah (and a build) share one call.
 */
export function asmaConfirmedInSurah(surah: number): Promise<Confirmed> {
  const hit = memo.get(surah);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = (async () => {
    const r = await rpc<Array<{ ayah: number; slug: string; ar: string; transliteration: string }>>("public_asma_confirmed_in_surah", { p_surah: surah });
    const out: Confirmed = {};
    for (const x of r?.data ?? []) (out[x.ayah] ??= []).push({ slug: x.slug, ar: x.ar, transliteration: x.transliteration });
    return out;
  })();
  memo.set(surah, { at: Date.now(), value });
  return value;
}
