import Link from "next/link";
import { cx } from "@/lib/cx";
import { englishContent } from "@/lib/i18n/locales";
import { journeyStrings } from "@/lib/i18n/modules/home";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";
import type { JourneyItem } from "@/content/journey";
import { CitationChip, EraTag, EvidenceLabel } from "@/components/ui/evidence";
import { Icon, Rosette } from "@/components/ui/icons";
import { quranHref } from "@/lib/refs";

// Reference kinds, dates and places are labelled from the interface strings (modules/home.ts, modules/ui.ts).

export interface ProphetJourneyCardProps {
  item: JourneyItem;
  expanded?: boolean;
  onToggle?: () => void;
  onEvidence?: () => void;
}

/** One stop on the Journey. Collapsed shows the head row only; the timeline expands one card at a time. */
export function ProphetJourneyCard({ item: p, expanded = true, onToggle, onEvidence }: ProphetJourneyCardProps) {
  const ms = p.type === "milestone";
  const locale = useLocale();
  const t = journeyStrings(locale);
  const u = uiStrings(locale);
  const en = englishContent(locale);
  const head = (
    <div className="zq-jc-head">
      <Rosette points={p.points} className="zq-jc-motif" />
      <div className="zq-jc-id">
        <div className="zq-jc-top">
          <span className="zq-jc-chap">
            {ms ? `${t.milestone} ` : `${t.chapter} `}
            {p.chapter}
          </span>
          <EraTag {...p.era} />
        </div>
        <h3 className="zq-jc-name">
          <span {...en}>{p.name}</span>
          {p.honorific ? (
            <span className="zq-jc-hon" lang="ar">
              {" "}
              {p.honorific}
            </span>
          ) : null}
        </h3>
        <p className="zq-jc-sub">
          <span className="zq-jc-ar" lang="ar" dir="rtl">
            {p.arabicName}
          </span>
          {p.subtitle ? (
            <>
              {" · "}
              <span {...en}>{p.subtitle}</span>
            </>
          ) : null}
        </p>
      </div>
      {onToggle ? (
        <button type="button" className="zq-jc-toggle" aria-expanded={expanded} aria-label={expanded ? t.collapse(p.name) : t.expand(p.name)} onClick={onToggle}>
          {expanded ? <Icon.chevronUp /> : <Icon.chevronDown />}
        </button>
      ) : null}
    </div>
  );
  if (!expanded)
    return (
      <article className={cx("zq-jc zq-glass zq-jc-collapsed", ms && "zq-jc-ms")} id={p.id} data-expanded="false">
        {head}
      </article>
    );

  const place = p.place ?? { name: t.unknown, certainty: "unknown" as const };
  return (
    <article className={cx("zq-jc zq-glass", ms && "zq-jc-ms")} id={p.id} aria-label={p.name} data-expanded="true">
      {head}
      <div id={`${p.id}-body`} style={{ display: "contents" }}>
        {p.ageMarker ? (
          <p className="zq-jc-age">
            <span className="zq-jc-label">{t.ageMarker}</span>
            <span {...en}>{p.ageMarker}</span>
          </p>
        ) : null}
        <p className="zq-jc-sum" {...en}>
          {p.summary}
        </p>
        {p.milestones ? (
          <ol className="zq-jc-miles">
            {p.milestones.map((m) => (
              <li key={m.when + m.text}>
                <span className="zq-jc-when" {...en}>
                  {m.when}
                </span>
                <span {...en}>{m.text}</span>
                <span className="zq-era-kind">{u.era[m.certainty]}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {p.surahs?.length ? (
          <div className="zq-jc-sec">
            <p className="zq-jc-label">{t.relatedSurahs}</p>
            <ul className="zq-jc-surahs">
              {p.surahs.map((s) => (
                <li key={`${s.number}-${s.passages.join()}`} className="zq-jc-surah">
                  <span className="zq-jc-snum">{s.number}</span>
                  <span className="zq-jc-sname">
                    <b {...en}>{s.name}</b>
                    <span lang="ar" dir="rtl" className="zq-jc-sar">
                      {s.arabic}
                    </span>
                    {s.named ? <span className="zq-jc-named">{t.namedAfterHim}</span> : null}
                  </span>
                  <span className="zq-jc-pass">
                    {s.passages.map((ps) => (
                      <CitationChip key={ps} href={quranHref(ps)} ariaLabel={`${t.quran} ${ps}`}>
                        {`Q ${ps}`}
                      </CitationChip>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {p.refs?.length ? (
          <div className="zq-jc-sec">
            <p className="zq-jc-label">{t.sources}</p>
            <ul className="zq-jc-refs">
              {p.refs.map((r) => (
                <li key={r.ref + r.label}>
                  <CitationChip kind={t.refKinds[r.kind]} href={r.kind === "quran" ? quranHref(r.ref.replace(/^Q\s*/, "")) : undefined}>
                    {r.ref}
                  </CitationChip>
                  <span {...en}>{r.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="zq-jc-meta">
          <span className={`zq-jc-place zq-jc-place-${place.certainty}`} data-place={place.certainty}>
            <span className="zq-jc-pmark" aria-hidden="true" />
            <span>
              <b>{u.place[place.certainty]}: </b>
              <span {...en}>{place.name}</span>
            </span>
          </span>
          <span className="zq-jc-ev">
            {(p.evidence ?? ["quran"]).map((k) => (
              <EvidenceLabel key={k} kind={k} />
            ))}
            {p.order?.disputed ? <EvidenceLabel kind="disputed">{p.order.label}</EvidenceLabel> : null}
          </span>
        </div>
        {p.note ? (
          <p className="zq-jc-note">
            <EvidenceLabel kind="scholar">{t.note}</EvidenceLabel> <span {...en}>{p.note}</span>
          </p>
        ) : null}
        <div className="zq-jc-cta">
          <Link className="zq-btn zq-btn-primary zq-btn-sm zq-btn-link" href={`/prophets/${p.id}`}>
            {t.exploreStory}
          </Link>
          {onEvidence ? (
            <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={onEvidence}>
              <Icon.source />
              {t.viewEvidence}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
