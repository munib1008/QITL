/**
 * The admin workspace organised by the work an editor is doing, not by database module. One table: every admin page belongs
 * to exactly one group, and the navigation shows the groups in this order with the pages a person's roles allow. A page not
 * listed here is shown after the groups (never dropped).
 */
export const ADMIN_GROUP_IDS = ["overview", "content", "sources", "learning", "media", "reviews", "community", "platform"] as const;
export type AdminGroupId = (typeof ADMIN_GROUP_IDS)[number];

const GROUP_OF: Record<string, AdminGroupId> = {
  "/admin": "overview",
  "/admin/stories": "content",
  "/admin/stories/coverage": "content",
  "/admin/events/new": "content",
  "/admin/events/universe": "content",
  "/admin/events/coverage": "content",
  "/admin/people": "content",
  "/admin/communities": "content",
  "/admin/profiles": "content",
  "/admin/relationships": "content",
  "/admin/hadith-stories": "content",
  "/admin/sources": "sources",
  "/admin/licences": "sources",
  "/admin/editions": "sources",
  "/admin/qiraat": "sources",
  "/admin/explanations": "sources",
  "/admin/scriptures": "sources",
  "/admin/guidance": "learning",
  "/admin/shifa": "learning",
  "/admin/asma": "learning",
  "/admin/science": "learning",
  "/admin/life-through-ages": "learning",
  "/admin/creation": "learning",
  "/admin/dreams": "learning",
  "/admin/media": "media",
  "/admin/studio": "media",
  "/admin/studio/translations": "media",
  "/admin/studio/audio": "media",
  "/admin/verification": "reviews",
  "/admin/review": "reviews",
  "/admin/corrections": "reviews",
  "/admin/moderation": "community",
  "/admin/mufti": "community",
  "/admin/partners": "community",
  "/admin/site": "platform",
  "/admin/users": "platform",
  "/admin/audit": "platform",
};

export const adminGroupOf = (href: string): AdminGroupId | null => GROUP_OF[href] ?? null;

export interface AdminGroupBlock<T> {
  id: AdminGroupId | null;
  links: T[];
}

/** Links grouped in the fixed group order; within a group the incoming order is kept. */
export function groupAdminLinks<T extends { href: string }>(links: T[]): AdminGroupBlock<T>[] {
  const blocks: AdminGroupBlock<T>[] = ADMIN_GROUP_IDS.map((id) => ({ id, links: [] as T[] }));
  const rest: T[] = [];
  for (const l of links) {
    const id = adminGroupOf(l.href);
    if (id) blocks.find((b) => b.id === id)!.links.push(l);
    else rest.push(l);
  }
  const out = blocks.filter((b) => b.links.length);
  if (rest.length) out.push({ id: null, links: rest });
  return out;
}
