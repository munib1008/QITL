import { getDict } from "@/lib/i18n";
import { creationStrings } from "@/lib/i18n/modules/creation";
import { dreamsT } from "@/lib/i18n/modules/dreams";
import { encyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import { guidanceT } from "@/lib/i18n/modules/guidance";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { qiraatStrings } from "@/lib/i18n/modules/qiraat";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { shifaStrings } from "@/lib/i18n/modules/shifa";

export interface SiteLink {
  href: string;
  label: string;
  note?: string;
}

/**
 * Every explorable section of QITL, in one place: the mobile Explore sheet, the desktop "More" menu and the home page's
 * section grid all read this list, so a new module is added once and reachable everywhere.
 */
export function exploreLinks(locale: string): SiteLink[] {
  const { t } = getDict(locale);
  const creation = creationStrings(locale).nav;
  const mufti = muftiT(locale).explore;
  const dreams = dreamsT(locale).explore;
  const lifestyle = lifestyleStrings(locale);
  const qiraat = qiraatStrings(locale);
  const guidance = guidanceT(locale);
  const shifa = shifaStrings(locale);
  const asma = asmaStrings(locale);
  const science = scienceStrings(locale);
  const people = encyclopediaStrings(locale).people;
  return [
    { href: "/prophets", label: t.nav.prophets, note: t.exploreNotes.prophets },
    { href: "/quran", label: t.nav.quran },
    { href: "/qiraat", label: qiraat.nav, note: qiraat.navNote },
    { href: "/stories", label: t.nav.stories, note: t.exploreNotes.stories },
    { href: "/events", label: t.nav.events, note: t.exploreNotes.events },
    { href: "/creation", label: creation.label, note: creation.note },
    { href: "/hadith", label: t.nav.hadith, note: t.exploreNotes.hadith },
    { href: "/atlas", label: t.nav.atlas, note: t.exploreNotes.atlas },
    { href: "/genealogy", label: t.nav.genealogy, note: t.exploreNotes.genealogy },
    { href: "/people", label: people.nav, note: people.navNote },
    { href: "/last-hour", label: t.nav.lastHour, note: t.exploreNotes.lastHour },
    { href: "/life-through-ages", label: lifestyle.nav, note: lifestyle.navNote },
    { href: "/guidance", label: guidance.nav, note: guidance.exploreNote },
    { href: "/shifa", label: shifa.nav, note: shifa.navNote },
    { href: "/asma", label: asma.nav, note: asma.navNote },
    { href: "/science", label: science.nav, note: science.navNote },
    { href: "/community/questions", label: mufti.label, note: mufti.note },
    { href: "/dreams", label: dreams.label, note: dreams.note },
    { href: "/community", label: t.nav.community, note: t.exploreNotes.community },
    { href: "/learn", label: t.learnArabic, note: t.exploreNotes.learn },
    { href: "/search", label: t.nav.search, note: t.exploreNotes.search },
  ];
}
