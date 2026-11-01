import Link from "next/link";
import type { Metadata } from "next";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EmptyState } from "@/components/ui/misc";
import { loadLineage } from "@/lib/data/lineage";
import { genealogyStrings } from "@/lib/i18n/modules/atlas";
import { lineageStrings } from "@/lib/i18n/modules/lineage";
import { isLineageClass, type LineageClass } from "@/lib/lineage/classes";
import { FIXTURE_END, FIXTURE_START } from "@/lib/lineage/fixtures";
import { LINEAGE_END, LINEAGE_START } from "@/lib/lineage/path";
import { LineageView } from "./LineageView";

export interface LineageParams {
  classes?: string;
  empty?: string;
}

export function lineageMetadata(locale: string): Metadata {
  const t = lineageStrings(locale);
  return { title: t.shortTitle, description: t.metaDescription };
}

/** The two views of the genealogy section, as links (the URL carries the choice: /genealogy?view=lineage). */
export function ViewSwitch({ locale, active }: { locale: string; active: "graph" | "lineage" }) {
  const t = lineageStrings(locale);
  return (
    <nav className="ln-switch" aria-label={t.viewSwitch}>
      <Link href="/genealogy" aria-current={active === "graph" ? "page" : undefined}>
        {t.familyGraph}
      </Link>
      <Link href="/genealogy?view=lineage" aria-current={active === "lineage" ? "page" : undefined}>
        {t.nav}
      </Link>
    </nav>
  );
}

/** The whole page of the lineage view; shared by /genealogy?view=lineage and /lineage. */
export async function LineagePage({ locale, params }: { locale: string; params: LineageParams }) {
  const t = lineageStrings(locale);
  const g = genealogyStrings(locale);
  const data = await loadLineage({ empty: params.empty === "1" });
  const fixture = data.source === "fixture";
  const initial = (params.classes ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isLineageClass) as LineageClass[];
  return (
    <ReadingPage locale={locale} crumbs={[{ label: g.title, href: "/genealogy" }, { label: t.shortTitle }]} title={t.title} lead={t.lead}>
      <div className="zq-pagebody">
        <ViewSwitch locale={locale} active="lineage" />
        {fixture ? <p className="ln-fixture">{t.fixture}</p> : null}
        {data.source === "none" ? (
          <EmptyState title={g.notConnected}>
            <p>{t.emptyBody}</p>
          </EmptyState>
        ) : (
          <LineageView doc={data.doc} counts={data.counts} start={fixture && data.doc.people.length ? FIXTURE_START : LINEAGE_START} end={fixture && data.doc.people.length ? FIXTURE_END : LINEAGE_END} initialClasses={initial} />
        )}
      </div>
    </ReadingPage>
  );
}
