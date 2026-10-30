import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./icons";

/* ---------- Map legend ---------- */
export type LegendItem = "point" | "region" | "unknown" | "hypothesis" | "route";
const LEGEND: Array<[LegendItem, string, ReactNode]> = [
  [
    "point",
    "Verified point",
    <svg viewBox="0 0 28 20" key="a" aria-hidden="true">
      <circle cx={14} cy={10} r={5} fill="var(--map-point)" stroke="var(--surface-raised)" strokeWidth={2} />
    </svg>,
  ],
  [
    "region",
    "Approximate region",
    <svg viewBox="0 0 28 20" key="b" aria-hidden="true">
      <defs>
        <pattern id="zqh" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={1.5} height={4} fill="var(--slate)" />
        </pattern>
      </defs>
      <rect x={3} y={3} width={22} height={14} rx={6} fill="var(--map-region)" />
      <rect x={3} y={3} width={22} height={14} rx={6} fill="url(#zqh)" stroke="var(--slate)" strokeWidth={1.5} />
    </svg>,
  ],
  [
    "unknown",
    "Unknown location",
    <svg viewBox="0 0 28 20" key="c" aria-hidden="true">
      <circle cx={14} cy={10} r={7} fill="none" stroke="var(--ev-unknown)" strokeWidth={2} strokeDasharray="2 3" />
      <text x={14} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ev-unknown)" fontFamily="var(--font-sans)">
        ?
      </text>
    </svg>,
  ],
  [
    "hypothesis",
    "Historical hypothesis",
    <svg viewBox="0 0 28 20" key="d" aria-hidden="true">
      <rect x={3} y={3} width={22} height={14} rx={6} fill="none" stroke="var(--map-hypothesis)" strokeWidth={2} strokeDasharray="1 3" strokeLinecap="round" />
    </svg>,
  ],
  [
    "route",
    "Approximate route",
    <svg viewBox="0 0 28 20" key="e" aria-hidden="true">
      <path d="M2 14C9 4 18 16 26 6" fill="none" stroke="var(--map-route)" strokeWidth={2.5} strokeDasharray="5 3" />
    </svg>,
  ],
];

/** Permanent atlas legend. Attribution is required and always visible. */
export function MapLegend({ title = "Location certainty", items = ["point", "region", "unknown", "hypothesis"], attribution }: { title?: string; items?: LegendItem[]; attribution: string }) {
  return (
    <section className="zq-legend" aria-label="Map legend">
      <h3>{title}</h3>
      <ul>
        {LEGEND.filter(([k]) => items.includes(k)).map(([k, label, mark]) => (
          <li key={k}>
            {mark}
            {label}
          </li>
        ))}
      </ul>
      <p className="zq-legend-attr" style={{ margin: 0 }}>
        {attribution}
      </p>
    </section>
  );
}

/* ---------- Genealogy ---------- */
export interface GenealogyNodeData {
  name: string;
  generation?: string;
  current?: boolean;
  unknown?: boolean;
  href?: string;
}
const LINK_TEXT = { verified: "Sourced link", disputed: "Disputed link", unknown: "Unknown link" } as const;

function GNode(n: GenealogyNodeData) {
  const body = (
    <>
      <span className="zq-node-name">{n.name}</span>
      {n.generation ? <span className="zq-node-gen">{n.generation}</span> : null}
    </>
  );
  const cls = cx("zq-node", n.unknown && "zq-node-unknown");
  return n.href && !n.current ? (
    <a className={cls} href={n.href}>
      {body}
    </a>
  ) : (
    <span className={cls} aria-current={n.current || undefined}>
      {body}
    </span>
  );
}

/** Node–edge–node. Solid = sourced, double = disputed, dotted = unknown. Never auto-derived from text. */
export function GenealogyLink({ from, to, relation = "parent of", status = "verified", evidence }: { from: GenealogyNodeData; to: GenealogyNodeData; relation?: string; status?: keyof typeof LINK_TEXT; evidence?: ReactNode }) {
  return (
    <div>
      <div className="zq-gen" role="group" aria-label={`${from.name} to ${to.name}: ${LINK_TEXT[status]}`}>
        <GNode {...from} />
        <span className={`zq-edge zq-edge-${status}`}>
          <span className="zq-edge-label">{relation}</span>
          <span className="zq-edge-line" />
          <span className="zq-edge-label">{LINK_TEXT[status]}</span>
        </span>
        <GNode {...to} />
      </div>
      {evidence ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>{evidence}</div> : null}
    </div>
  );
}

/* ---------- Forms ---------- */
export function TextField({
  label,
  id,
  help,
  error,
  ...input
}: { label: string; id: string; help?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="zq-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="zq-input" aria-invalid={error ? "true" : undefined} aria-describedby={error || help ? `${id}-d` : undefined} {...input} />
      {error ? (
        <span className="zq-error" id={`${id}-d`}>
          <Icon.alert />
          {error}
        </span>
      ) : help ? (
        <span className="zq-help" id={`${id}-d`}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

/** Global search: a GET form to /search, so it works without JavaScript. */
export function SearchField({ label = "Search QITL", placeholder = "Search prophets, surahs, hadith, places…", defaultValue, maxWidth = 520, id = "zq-q" }: { label?: string; placeholder?: string; defaultValue?: string; maxWidth?: number; id?: string }) {
  return (
    <form role="search" action="/search" method="get" className="zq-field zq-search" style={{ maxWidth }}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon.search />
      <input id={id} name="q" className="zq-input" type="search" placeholder={placeholder} defaultValue={defaultValue} autoComplete="off" />
    </form>
  );
}

/* ---------- Feedback ---------- */
export function Skeleton({ width = "100%", height = 16, round }: { width?: number | string; height?: number; round?: boolean }) {
  return <div className="zq-skel" aria-hidden="true" style={{ width, height, borderRadius: round ? "var(--radius-pill)" : undefined }} />;
}

export function Toast({ tone = "info", action, onAction, children }: { tone?: "info" | "success" | "error"; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <div className="zq-toast" role={tone === "error" ? "alert" : "status"}>
      {tone === "error" ? <Icon.alert /> : <Icon.check />}
      <span>{children}</span>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** The designed empty / unavailable state: a plain sentence and the next step. */
export function EmptyState({ label, title, children, tone = "unknown" }: { label?: ReactNode; title: string; children?: ReactNode; tone?: "unknown" | "soon" }) {
  return (
    <div className={cx("pp-empty", tone === "soon" && "pp-empty-soon")} data-testid="empty-state">
      {label}
      <b>{title}</b>
      {children ? <div className="pp-empty-body">{children}</div> : null}
    </div>
  );
}

export function ComingSoonTag({ children = "Coming soon" }: { children?: ReactNode }) {
  return <span className="zq-soon">{children}</span>;
}
