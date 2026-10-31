import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/shifa.css";
import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import {
  citation,
  needsMentalHealthNotice,
  needsRuqyahNotice,
  REFERENCE_POINTS,
  showsRecitation,
  splitLayers,
  visibleLayers,
  type ClaimBlock,
  type ShifaEntry,
  type ShifaIcon,
  type ShifaLayer,
  type ShifaSafetyNote,
  type ShifaSection,
  type ShifaScholarlyNote,
} from "@/lib/shifa/model";
import type { ShifaStrings } from "@/lib/i18n/modules/shifa";

type L = "en" | "ar" | "ur"; // Urdu shows the English fields until reviewed Urdu content exists

/** Abstract, geometric topic marks (16px grid, 1.5px stroke). Never a figure. */
const ICONS: Record<ShifaIcon, ReactNode> = {
  leaf: <path d="M3 13C3 6 7 3 13 3c0 6-3 10-10 10zM3 13l6-6" />,
  vessel: <path d="M5 2.5h6M6 2.5v2.5C4 6 3 8 3 10a5 5 0 0010 0c0-2-1-4-3-5V2.5" />,
  water: <path d="M8 1.5c3 3.5 4.5 5.5 4.5 8a4.5 4.5 0 01-9 0c0-2.5 1.5-4.5 4.5-8z" />,
  light: <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />,
  pattern: <path d="M8 1.5l2.5 2.5L8 6.5 5.5 4zM8 9.5l2.5 2.5L8 14.5 5.5 12zM1.5 8L4 5.5 6.5 8 4 10.5zM9.5 8L12 5.5 14.5 8 12 10.5z" />,
  calligraphy: <path d="M2 11c2 3 6 3 8 0s1-6 4-8M10 6c-1 1-1 3 0 4" />,
  moon: <path d="M10.5 2a6 6 0 100 12 5 5 0 010-12z" />,
  scale: <path d="M8 2v12M4 14h8M2 5h12M2 5l-1.5 4h3zM14 5l-1.5 4h3z" />,
};

export function TopicIcon({ icon }: { icon: ShifaIcon }) {
  return (
    <svg className="sh-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
      {ICONS[icon]}
    </svg>
  );
}

export function TopicCard({ href, icon, title, alt, altLang, tag }: { href: string; icon: ShifaIcon; title: string; alt?: string; altLang?: L; tag?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="sh-topic">
        <span className="sh-topic-mark">
          <TopicIcon icon={icon} />
        </span>
        <span className="sh-topic-text">
          <b>{title}</b>
          {alt ? (
            <span lang={altLang} dir={altLang === "ar" ? "rtl" : "ltr"} className="sh-topic-alt">
              {alt}
            </span>
          ) : null}
          {tag}
        </span>
      </Link>
    </li>
  );
}

/**
 * The fixed safety framing, on EVERY Shifa page: educational, not medical advice; do not delay or replace professional
 * care; ask a clinician or pharmacist first; emergencies. The wellbeing section adds the professional mental-health
 * recommendation and the crisis note; ruqyah adds what the section is and is not.
 */
export function SafetyFraming({ s, section, notes = [], locale }: { s: ShifaStrings; section?: ShifaSection; notes?: ShifaSafetyNote[]; locale: L }) {
  return (
    <div className="sh-safety-stack">
      <aside className="sh-safety" role="note" aria-labelledby="sh-safety-h" data-testid="safety-framing">
        <h2 id="sh-safety-h">{s.safety.title}</h2>
        <p>{s.safety.body}</p>
        <p>{s.safety.ask}</p>
        <p className="sh-emergency">
          <b>{s.safety.emergency}</b>
        </p>
        <p>{s.safety.complementary}</p>
        <p className="zq-meta">{s.safety.noAi}</p>
        <ReviewedNotes s={s} notes={notes.filter((n) => !n.entry_id)} locale={locale} />
      </aside>
      {section && needsMentalHealthNotice(section) ? (
        <aside className="sh-safety sh-wellbeing" role="note" aria-labelledby="sh-wellbeing-h" data-testid="wellbeing-notice">
          <h2 id="sh-wellbeing-h">{s.wellbeing.title}</h2>
          <p>{s.wellbeing.body}</p>
          <p className="sh-emergency" data-testid="crisis-note">
            <b>{s.wellbeing.crisis}</b>
          </p>
        </aside>
      ) : null}
      {section && needsRuqyahNotice(section) ? (
        <aside className="sh-safety sh-ruqyah" role="note" aria-labelledby="sh-ruqyah-h" data-testid="ruqyah-notice">
          <h2 id="sh-ruqyah-h">{s.ruqyah.title}</h2>
          <p>{s.ruqyah.body}</p>
        </aside>
      ) : null}
    </div>
  );
}

/** Reviewed (published) safety notes, grouped by kind; the body is an editor's reviewed text. */
export function ReviewedNotes({ s, notes, locale }: { s: ShifaStrings; notes: ShifaSafetyNote[]; locale: L }) {
  if (!notes.length) return null;
  return (
    <div className="sh-notes" data-testid="reviewed-notes">
      <h3>{s.safety.reviewedNotes}</h3>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>
            <span className="zq-eyebrow">{s.safety.noteKinds[n.kind]}</span>
            <span>{(locale === "ar" && n.body_ar) || n.body_en}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The four evidence-layer legend shown on the hub: what each container means. */
export function LayerLegend({ s }: { s: ShifaStrings }) {
  return (
    <section aria-labelledby="sh-legend-h" className="sh-legend" data-testid="layer-legend">
      <h2 id="sh-legend-h">{s.layersHeading}</h2>
      <p className="zq-meta">{s.layersLegend}</p>
      <ol>
        {(["A", "B", "S", "C", "D"] as const).map((k) => (
          <li key={k} className={`sh-layer sh-layer-${k}`}>
            <b>{s.layers[k].name}</b>
            <span className="zq-meta">{s.layers[k].note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Refs({ claim }: { claim: ClaimBlock | null }) {
  const refs = claim?.claim_references ?? [];
  if (!refs.length) return null;
  return (
    <span className="sh-refs">
      {refs.map((r, i) => {
        const x = citation(r);
        return (
          <span key={i} className="sh-ref">
            <CitationChip kind={x.kind} href={x.href}>
              {x.label}
            </CitationChip>
            {r.kind === "hadith" && r.hadith_gradings ? (
              <span className="zq-meta">
                {r.hadith_gradings.grade_label} · {r.hadith_gradings.grader}
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function Layer({ id, k, s, children, empty }: { id: string; k: "A" | "B" | "S" | "C" | "D"; s: ShifaStrings; children: ReactNode; empty: boolean }) {
  return (
    <section className={`sh-layer sh-layer-${k}${k === "D" ? " sh-apart" : ""}`} aria-labelledby={id} data-layer={k} data-established={k === "D" ? "false" : undefined}>
      <h4 id={id}>{s.layers[k].name}</h4>
      <p className="zq-meta">{s.layers[k].note}</p>
      {empty ? (
        <p className="sh-layer-empty" data-testid={`layer-${k}-empty`}>
          {s.layerEmpty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function ClaimItem({ layer, kind, locale }: { layer: ShifaLayer; kind: "quran" | "hadith"; locale: L }) {
  return (
    <li>
      <EvidenceLabel kind={kind} lang={locale} />
      <p lang="en" dir="ltr">
        {layer.evidence_claims!.statement}
      </p>
      <Refs claim={layer.evidence_claims} />
    </li>
  );
}

function ResearchItem({ layer, s }: { layer: ShifaLayer; s: ShifaStrings }) {
  const r = s.research;
  return (
    <li data-testid="research-item">
      <EvidenceLabel kind="estimate" lang="en" />
      <p lang={layer.language}>{layer.finding}</p>
      <dl className="sh-dl">
        <div>
          <dt>{r.publication}</dt>
          <dd>{layer.publication}</dd>
        </div>
        <div>
          <dt>{r.studyType}</dt>
          <dd>{layer.study_type ? r.studyTypes[layer.study_type] : ""}</dd>
        </div>
        <div>
          <dt>{r.population}</dt>
          <dd>{layer.population}</dd>
        </div>
        <div>
          <dt>{r.citation}</dt>
          <dd>
            <span data-citation="" dir="ltr">
              {layer.url ? (
                <a href={layer.url} rel="noopener noreferrer">
                  {layer.citation}
                </a>
              ) : (
                layer.citation
              )}
            </span>
          </dd>
        </div>
        <div className="sh-limits">
          <dt>{r.limitations}</dt>
          <dd>{layer.limitations}</dd>
        </div>
      </dl>
      <p className="zq-meta">
        {layer.states_health_effect ? <b>{s.flags.healthEffect}. </b> : null}
        {r.notRecommendation}
      </p>
    </li>
  );
}

function TraditionItem({ layer, s }: { layer: ShifaLayer; s: ShifaStrings }) {
  return (
    <li data-testid="tradition-item">
      <span className="sh-flags">
        {layer.is_traditional ? <span className="sh-flag">{s.flags.traditional}</span> : null}
        {layer.is_hypothesis ? <span className="sh-flag">{s.flags.hypothesis}</span> : null}
      </span>
      <p lang={layer.language}>{layer.finding}</p>
      {layer.citation ? (
        <p className="zq-meta" dir="ltr">
          {layer.citation}
        </p>
      ) : null}
    </li>
  );
}

function ScholarItem({ note, s, locale }: { note: ShifaScholarlyNote; s: ShifaStrings; locale: L }) {
  return (
    <li>
      <EvidenceLabel kind="scholar" lang={locale} />
      <p lang="en" dir="ltr">
        {note.evidence_claims!.statement}
      </p>
      <p className="sh-attrib">
        — <b>{note.scholar_name}</b>, {s.scholarIn} <cite>{note.work_title}</cite>
        {note.locator ? `, ${note.locator}` : ""}
      </p>
      <Refs claim={note.evidence_claims} />
    </li>
  );
}

/** The "not yet available" state for recitation (same contract as the Qira'at module): approved, licensed audio only. */
export function RecitationState({ s }: { s: ShifaStrings }) {
  return (
    <div className="sh-recitation" data-testid="recitation-unavailable">
      <b>{s.recitation.title}</b>
      <p className="zq-licence zq-licence-pending">{s.recitation.unavailable}</p>
      <p className="zq-meta">{s.recitation.body}</p>
    </div>
  );
}

/**
 * One entry. Every layer has its own labelled container, in a fixed order, and the layers are never merged. An entry in
 * the ruqyah section shows only A, B and the scholarly notes. D is always apart, flagged "not established".
 */
export function EntryView({ entry, section, s, locale, index, notes = [] }: { entry: ShifaEntry; section: ShifaSection; s: ShifaStrings; locale: L; index: number; notes?: ShifaSafetyNote[] }) {
  const parts = splitLayers(entry);
  const h = `sh-entry-${index}`;
  const title = (locale === "ar" && entry.title_ar) || entry.title_en;
  const show = visibleLayers(section);
  return (
    <article className="sh-entry" aria-labelledby={h} data-testid="shifa-entry" data-kind={entry.kind}>
      <header>
        <span className="zq-eyebrow">{s.entryKinds[entry.kind]}</span>
        <h3 id={h}>{title}</h3>
      </header>
      <ReviewedNotes s={s} notes={notes.filter((n) => n.entry_id === entry.id)} locale={locale} />
      {show.includes("A") ? (
        <Layer id={`${h}-A`} k="A" s={s} empty={!parts.A.length}>
          <ul>
            {parts.A.map((l) => (
              <ClaimItem key={l.id} layer={l} kind="quran" locale={locale} />
            ))}
          </ul>
        </Layer>
      ) : null}
      {show.includes("B") ? (
        <Layer id={`${h}-B`} k="B" s={s} empty={!parts.B.length}>
          <ul>
            {parts.B.map((l) => (
              <ClaimItem key={l.id} layer={l} kind="hadith" locale={locale} />
            ))}
          </ul>
        </Layer>
      ) : null}
      {show.includes("S") ? (
        <Layer id={`${h}-S`} k="S" s={s} empty={!parts.scholarly.length}>
          <ul>
            {parts.scholarly.map((n) => (
              <ScholarItem key={n.id} note={n} s={s} locale={locale} />
            ))}
          </ul>
        </Layer>
      ) : null}
      {show.includes("C") ? (
        <Layer id={`${h}-C`} k="C" s={s} empty={!parts.C.length}>
          <ul>
            {parts.C.map((l) => (
              <ResearchItem key={l.id} layer={l} s={s} />
            ))}
          </ul>
        </Layer>
      ) : null}
      {show.includes("D") ? (
        <Layer id={`${h}-D`} k="D" s={s} empty={!parts.D.length}>
          <ul>
            {parts.D.map((l) => (
              <TraditionItem key={l.id} layer={l} s={s} />
            ))}
          </ul>
        </Layer>
      ) : null}
      {showsRecitation(section, entry.kind) ? <RecitationState s={s} /> : null}
      <p className="zq-meta">
        {s.reviewed}
        {entry.last_reviewed_at ? ` ${entry.last_reviewed_at}` : ""} · {s.version} {entry.version}
      </p>
    </article>
  );
}

/** The starting references: referenced, never quoted, each in the "licence pending" style. */
export function ReferencePoints({ s, titles }: { s: ShifaStrings; titles: Record<string, string> }) {
  return (
    <section aria-labelledby="sh-refs-h" className="sh-refpoints" data-testid="reference-points">
      <h2 id="sh-refs-h">{s.references.title}</h2>
      <p className="zq-meta">{s.references.lead}</p>
      <ul className="sh-reflist">
        {REFERENCE_POINTS.map((r) => (
          <li key={r.label} className="sh-refcard">
            <div className="sh-refrow">
              <EvidenceLabel kind={r.kind} lang="en" />
              <CitationChip href={r.href}>{r.label}</CitationChip>
            </div>
            {"plannedFor" in r ? (
              <p className="zq-meta">
                {s.references.plannedFor}: {titles[r.plannedFor] ?? r.plannedFor}
              </p>
            ) : null}
            <p className="zq-licence zq-licence-pending">{s.references.licencePending}</p>
            <p className="zq-meta">{s.references.numbering}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
