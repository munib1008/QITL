import { NAV_GROUP_IDS, navGroupStrings, type NavGroupId } from "@/lib/i18n/modules/navGroups";

/**
 * Which of the five learning categories a section belongs to. The menus, the mobile Explore sheet and the home index all
 * group by this one table, so a section is classified once. A section not listed here is shown after the groups, without a
 * heading (never dropped). "My QITL" is the Profile tab and the account area, not an Explore category.
 */
const GROUP_OF: Record<string, NavGroupId> = {
  "/quran": "quran",
  "/qiraat": "quran",
  "/hadith": "quran",
  "/learn": "quran",
  "/compare": "quran",
  "/prophets": "stories",
  "/timeline": "stories",
  "/stories": "stories",
  "/hadith-stories": "stories",
  "/events": "stories",
  "/people": "stories",
  "/communities": "stories",
  "/atlas": "stories",
  "/genealogy": "stories",
  "/lineage": "stories",
  "/life-through-ages": "stories",
  "/guidance": "learn",
  "/asma": "learn",
  "/shifa": "learn",
  "/dreams": "learn",
  "/creation": "knowledge",
  "/science": "knowledge",
  "/last-hour": "knowledge",
  "/scriptures": "knowledge",
  "/community": "community",
  "/community/questions": "community",
  "/mufti": "community",
  "/partners": "community",
};

export const groupOf = (href: string): NavGroupId | null => GROUP_OF[href.split(/[?#]/)[0]!] ?? null;

export interface NavGroupBlock<T> {
  id: NavGroupId | null;
  label: string | null;
  note: string | null;
  links: T[];
}

/** Links grouped in category order; within a group the incoming order (including any administrator ordering) is kept. */
export function groupLinks<T extends { href: string }>(links: T[], locale: string): NavGroupBlock<T>[] {
  const g = navGroupStrings(locale).groups;
  const blocks: NavGroupBlock<T>[] = NAV_GROUP_IDS.map((id) => ({ id, label: g[id].label, note: g[id].note, links: [] as T[] }));
  const rest: T[] = [];
  for (const l of links) {
    const id = groupOf(l.href);
    if (id) blocks.find((b) => b.id === id)!.links.push(l);
    else rest.push(l);
  }
  const out = blocks.filter((b) => b.links.length);
  if (rest.length) out.push({ id: null, label: null, note: null, links: rest });
  return out;
}
