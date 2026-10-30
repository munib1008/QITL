import Link from "next/link";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import {
  CATEGORIES,
  buildComparison,
  graphLayout,
  type Atlas,
  type CategoryId,
  type CreationStory,
  type Profile,
  type Ref,
  type Relationship,
} from "@/lib/data/creation-types";
import type { CreationStrings } from "@/lib/i18n/modules/creation";
import { Citations, Dual, EntryBlock, EvidenceClassBadge, NotEstablished } from "./parts";

type L = "en" | "ar";
const nameOf = (p: Profile, locale: L) => (locale === "ar" ? p.nameAr : p.nameEn);

/* ---------- Categories ---------- */

export function CategoryCards({ profiles, t, locale }: { profiles: Profile[]; t: CreationStrings; locale: L }) {
  return (
    <ul className="cr-cats" data-testid="creation-categories">
      {CATEGORIES.map((c) => {
        const list = profiles.filter((p) => p.categoryId === c.id);
        return (
          <li key={c.id} className="cr-cat" id={`cat-${c.id}`} data-category={c.id}>
            <svg className="cr-cat-mark" viewBox="0 0 40 40" aria-hidden="true">
              <CategoryMark id={c.id} />
            </svg>
            <h3>
              {locale === "ar" ? (
                <span lang="ar" dir="rtl">{c.nameAr}</span>
              ) : (
                <>
                  {c.nameEn}{" "}
                  <small lang="ar" dir="rtl">
                    {c.nameAr}
                  </small>
                </>
              )}
            </h3>
            <p className="zq-meta">{list.length ? t.categories.profiles(list.length) : t.categories.none}</p>
            {list.length ? (
              <ul className="cr-cat-links">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link href={`/creation/${p.slug}`}>{nameOf(p, locale)}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Small abstract marks per category: geometry, line and landscape only. */
function CategoryMark({ id }: { id: CategoryId }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };
  switch (id) {
    case "humans":
      return <path {...s} d="M6 30 Q20 18 34 30 M10 34 H30" />;
    case "jinn":
      return <path {...s} d="M8 30 Q14 10 20 30 T32 30" />;
    case "iblis_shayatin":
      return <path {...s} d="M8 12 L32 28 M32 12 L8 28" />;
    case "angels":
      return (
        <>
          <circle {...s} cx="20" cy="20" r="12" />
          <circle cx="20" cy="20" r="3" fill="currentColor" />
        </>
      );
    case "animals":
      return <path {...s} d="M6 26 Q14 18 22 24 T36 20 M10 32 H30" />;
    case "heavens_earth":
      return (
        <>
          <path {...s} d="M4 28 Q20 6 36 28" />
          <path {...s} d="M10 28 Q20 14 30 28" />
          <path {...s} d="M4 32 H36" />
        </>
      );
  }
}

/* ---------- Comparison ---------- */

export function ComparisonTable({ profiles, t, locale }: { profiles: Profile[]; t: CreationStrings; locale: L }) {
  const { columns, rows } = buildComparison(profiles);
  const catName = (id: CategoryId) => {
    const c = CATEGORIES.find((x) => x.id === id)!;
    return locale === "ar" ? c.nameAr : c.nameEn;
  };
  return (
    <div className="cr-compare-wrap">
      <table className="cr-compare" data-testid="creation-compare">
        <caption className="sr-only">{t.sections.compare}</caption>
        <thead>
          <tr>
            <th scope="col">{t.compare.aspect}</th>
            {columns.map((c) => (
              <th scope="col" key={c.category} data-category={c.category}>
                {c.profile ? <Link href={`/creation/${c.profile.slug}`}>{catName(c.category)}</Link> : catName(c.category)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, cells }) => (
            <tr key={row} data-row={row}>
              <th scope="row">
                <Dual normal={t.compare.rows[row]} kids={t.compare.kidsRows[row]} />
              </th>
              {cells.map((cell, i) => (
                <td key={columns[i]!.category} data-label={catName(columns[i]!.category)} data-cell={`${row}:${columns[i]!.category}`}>
                  <span className="cr-cell-label" aria-hidden="true">
                    {catName(columns[i]!.category)}
                  </span>
                  {cell.entry ? (
                    <>
                      <EntryBlock entry={cell.entry} t={t} compact />
                      {cell.more ? (
                        <Link className="cr-more" href={`/creation/${columns[i]!.profile!.slug}#f-${row}`}>
                          {t.compare.more(cell.more)}
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <NotEstablished t={t} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Relationship graph ---------- */

const MAX_NODES = 16;

export function RelationshipGraph({ relationships, profiles, t, locale }: { relationships: Relationship[]; profiles: Profile[]; t: CreationStrings; locale: L }) {
  if (!relationships.length) return <EmptyState label={<EvidenceLabel kind="unknown">{t.evidence.not_established}</EvidenceLabel>} title={t.graph.empty} />;
  // Keep the diagram legible: take relationships in order until the node budget is used; the list has them all.
  const shown: Relationship[] = [];
  const keys = new Set<string>();
  for (const r of relationships) {
    const next = new Set(keys).add(`${r.fromKind}:${r.fromRef}`).add(`${r.toKind}:${r.toRef}`);
    if (next.size > MAX_NODES) break;
    next.forEach((k) => keys.add(k));
    shown.push(r);
  }
  const SIZE = 360;
  const { nodes, edges } = graphLayout(shown, profiles, locale, SIZE);
  const { nodes: allNodes } = graphLayout(relationships, profiles, locale, SIZE);
  const label = (kind: string, ref: string) => allNodes.find((n) => n.kind === kind && n.ref === ref)!;
  return (
    <div className="cr-graph">
      <figure className="cr-graph-fig">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={t.graph.diagramLabel(shown.length)} data-testid="creation-graph">
          <defs>
            <marker id="cr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill="var(--ink-muted)" />
            </marker>
          </defs>
          {edges.map((e) => {
            const dx = e.to.x - e.from.x;
            const dy = e.to.y - e.from.y;
            const len = Math.hypot(dx, dy) || 1;
            const pad = 16;
            return (
              <line
                key={e.id}
                x1={e.from.x + (dx / len) * pad}
                y1={e.from.y + (dy / len) * pad}
                x2={e.to.x - (dx / len) * pad}
                y2={e.to.y - (dy / len) * pad}
                className={`cr-edge cr-edge-${e.evidence}`}
                markerEnd="url(#cr-arrow)"
              />
            );
          })}
          {nodes.map((n) => (
            <g key={n.key} className={`cr-node cr-node-${n.kind}`}>
              <circle cx={n.x} cy={n.y} r="12" />
              <text x={n.x} y={n.y + (n.y > SIZE / 2 ? 28 : -18)} textAnchor="middle">
                {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
              </text>
            </g>
          ))}
        </svg>
        {shown.length < relationships.length ? <figcaption className="zq-meta">{t.graph.truncated(shown.length)}</figcaption> : null}
      </figure>
      <div>
        <h3 className="zq-eyebrow">{t.graph.list}</h3>
        <ul className="cr-rels" data-testid="creation-relationships">
          {relationships.map((r) => {
            const f = label(r.fromKind, r.fromRef);
            const to = label(r.toKind, r.toRef);
            return (
              <li key={r.id} className="cr-rel">
                <p>
                  <NodeText node={f} kind={t.graph.kinds[r.fromKind]} /> <span className="cr-rel-verb">{r.relation}</span> <NodeText node={to} kind={t.graph.kinds[r.toKind]} />
                </p>
                <span className="cr-refs">
                  <EvidenceClassBadge cls={r.evidence} t={t} />
                  <Citations refs={r.refs} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function NodeText({ node, kind }: { node: { label: string; href?: string }; kind: string }) {
  return (
    <span className="cr-nodetext">
      {node.href ? <Link href={node.href}>{node.label}</Link> : <b>{node.label}</b>} <span className="zq-meta">({kind})</span>
    </span>
  );
}

/* ---------- Stories ---------- */

export function StoryLibrary({ stories, profiles, t, locale }: { stories: CreationStory[]; profiles: Profile[]; t: CreationStrings; locale: L }) {
  if (!stories.length) return <EmptyState label={<EvidenceLabel kind="unknown">{t.evidence.not_established}</EvidenceLabel>} title={t.stories.empty} />;
  return (
    <ul className="cr-stories" data-testid="creation-stories">
      {stories.map((s) => {
        const p = profiles.find((x) => x.id === s.profileId);
        const title = locale === "ar" && s.titleAr ? s.titleAr : s.title;
        return (
          <li key={s.id} className="cr-story" id={`story-${s.slug}`}>
            <h3 lang={locale === "ar" && s.titleAr ? "ar" : undefined}>{title}</h3>
            {s.summary ? <p>{s.summary}</p> : null}
            <span className="cr-refs">
              {s.claimEvidence ? <EvidenceLabel kind={s.claimEvidence} /> : null}
              <Citations refs={s.refs} />
            </span>
            {p ? (
              <p className="zq-meta" style={{ margin: 0 }}>
                {t.stories.about} <Link href={`/creation/${p.slug}`}>{nameOf(p, locale)}</Link>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Sources ---------- */

export function SourcePanel({ refs, t }: { refs: Ref[]; t: CreationStrings }) {
  return (
    <aside className="cr-sources" aria-labelledby="cr-sources-h" data-testid="creation-sources">
      <h2 id="cr-sources-h">{t.sections.sources}</h2>
      <p className="zq-meta">{t.sources.help}</p>
      {refs.length ? (
        <p className="cr-refs">
          <Citations refs={refs} />
        </p>
      ) : (
        <EmptyState label={<EvidenceLabel kind="unknown">{t.evidence.not_established}</EvidenceLabel>} title={t.sources.empty} />
      )}
      <dl className="cr-legend" aria-label={t.evidenceLegend}>
        {(["revelation", "authentic_hadith", "scholarly_interpretation", "not_established"] as const).map((c) => (
          <div key={c}>
            <dt>
              <EvidenceClassBadge cls={c} t={t} />
            </dt>
            <dd>{t.evidenceHelp[c]}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** Whether the atlas has any published content at all. */
export function isEmptyAtlas(a: Atlas) {
  return !a.profiles.length && !a.relationships.length && !a.stories.length;
}
