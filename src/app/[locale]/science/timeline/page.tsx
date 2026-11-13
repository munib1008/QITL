import type { Metadata } from "next";
import Link from "next/link";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { Disclosure, En } from "@/components/science/Parts";
import { scienceTimeline } from "@/lib/data/science";
import { getDict } from "@/lib/i18n";
import { scienceStrings } from "@/lib/i18n/modules/science";
import { pick3 } from "@/lib/science/model";
import { displayYear } from "@/lib/science/status";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = scienceStrings((await params).locale).timeline;
  return { title: s.title, description: s.lead };
}

type Layer = "both" | "a" | "b";

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ layer?: string | string[] }> }) {
  const { locale: raw } = await params;
  const { locale } = getDict(raw);
  const sp = await searchParams;
  const asked = Array.isArray(sp.layer) ? sp.layer[0] : sp.layer;
  const layer: Layer = asked === "a" || asked === "b" ? asked : "both";
  const s = scienceStrings(locale);
  const t = s.timeline;
  const tp = s.topic;
  const { connected, items } = await scienceTimeline();
  const opts: Array<[Layer, string]> = [["both", t.both], ["a", t.a], ["b", t.b]];
  return (
    <ReadingPage locale={raw} crumbs={[{ href: "/science", label: s.nav }, { label: t.title }]} kicker={s.kicker} title={t.title} lead={t.lead}>
      <div className="zq-pagebody sc-page" data-testid="science-timeline" data-layer={layer}>
        <Disclosure locale={locale} />
        {connected ? null : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{s.notConnected.title}</EvidenceLabel>} title={s.notConnected.title}>
            <p>{s.notConnected.body}</p>
          </EmptyState>
        )}
        <nav aria-label={t.switches}>
          <ul className="sc-switch" data-testid="layer-switch">
            {opts.map(([k, label]) => (
              <li key={k}>
                <Link href={k === "both" ? "/science/timeline" : `/science/timeline?layer=${k}`} aria-current={layer === k ? "page" : undefined}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {items.length ? (
          <ul className="sc-list" data-testid="timeline-topics">
            {items.map((x) => (
              <li key={x.slug}>
                <h2 style={{ margin: 0, font: "600 18px/26px var(--font-display)" }}>
                  <Link href={`/science/${x.slug}`}>{pick3(x.title, locale)}</Link>
                </h2>
                <div className="sc-layers" data-both={layer === "both" ? "true" : "false"}>
                  {layer !== "b" ? (
                    <div className="sc-layer" data-layer="a" data-testid="layer-a">
                      <h3>{tp.layerA}</h3>
                      <ol>
                        {x.layer_a.map((a, k) => (
                          <li key={k}>
                            Q <bdi dir="ltr">{a.surah}:{a.ayah}</bdi>
                            {a.era ? (
                              <>
                                {" · "}
                                {a.era === "classical" ? tp.classical : tp.contemporary}
                                {a.scholar ? <> · <En locale={locale}>{a.scholar}</En></> : null}
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                      {x.layer_a.every((a) => !a.era) ? <p className="sc-note">{t.noInterpretations}</p> : null}
                    </div>
                  ) : null}
                  {layer !== "a" ? (
                    <div className="sc-layer" data-layer="b" data-testid="layer-b">
                      <h3>{tp.layerB}</h3>
                      {x.layer_b.length ? (
                        <ol>
                          {x.layer_b.map((m, k) => {
                            const y = displayYear(m);
                            return (
                              <li key={k} data-dated={y.year != null ? "true" : "false"}>
                                <b dir="ltr">{y.year != null ? y.year : t.unverifiedYear}</b> · <En locale={locale}>{m.label}</En>
                                {y.sourceUrl ? (
                                  <>
                                    {" "}
                                    <a href={y.sourceUrl} rel="noopener noreferrer" target="_blank">
                                      {tp.sourceChecked}
                                    </a>
                                  </>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="sc-note">{t.undated}</p>
                      )}
                    </div>
                  ) : null}
                </div>
                {layer === "both" ? <p className="sc-link-note">{t.interpretiveLink}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState label={<EvidenceLabel kind="unknown" lang={locale}>{t.none}</EvidenceLabel>} title={t.none} />
        )}
      </div>
    </ReadingPage>
  );
}
