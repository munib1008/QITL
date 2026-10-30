import { CitationChip, EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { Markdown } from "@/components/ui/Markdown";
import { FACT_KINDS, SECTION_TITLE, refLabel, type ProfileResult, type ProfileSection } from "@/lib/data/profiles";
import { DepthTabs } from "./DepthTabs";

function Refs({ s }: { s: ProfileSection }) {
  return (
    <span className="qp-refs">
      <EvidenceLabel kind={s.evidence} />
      {s.refs.map((r, i) => {
        const l = refLabel(r);
        return (
          <CitationChip key={i} href={l.href}>
            {l.text}
          </CitationChip>
        );
      })}
    </span>
  );
}

function Fact({ kind, s }: { kind: string; s?: ProfileSection }) {
  return (
    <div className="qp-fact" data-fact={kind}>
      <span className="qp-fact-label">{SECTION_TITLE[kind]}</span>
      {s ? (
        <>
          <b className="qp-fact-value">{s.known ? s.valueText : "Not established"}</b>
          {s.valueNote ? <span className="qp-fact-note">{s.valueNote}</span> : null}
          <Refs s={s} />
        </>
      ) : (
        <span className="qp-fact-pending">Not yet written</span>
      )}
    </div>
  );
}

function Prose({ list, empty }: { list: ProfileSection[]; empty: string }) {
  if (!list.length) return <p className="zq-meta">{empty}</p>;
  return (
    <div className="qp-prose">
      {list.map((s) => (
        <section key={s.id} className="qp-section" aria-label={SECTION_TITLE[s.kind]}>
          {s.kind !== "overview" ? <h3>{SECTION_TITLE[s.kind]}</h3> : null}
          <div className="zq-prose">
            <Markdown source={s.bodyMd} />
          </div>
          <Refs s={s} />
        </section>
      ))}
    </div>
  );
}

/**
 * The standard profile for every prophet: four facts, then three reading depths (30-second overview, narrative,
 * source-based study). Only reviewed, published sections appear; anything missing says so instead of being filled in.
 */
export function ProphetProfile({ result, name }: { result: ProfileResult; name: string }) {
  if (result.state === "not_configured")
    return (
      <EmptyState tone="soon" label={<span className="zq-soon">Coming soon</span>} title="Profiles are not connected on this site yet." />
    );
  if (result.state === "error")
    return <EmptyState title="The profile could not be loaded.">{<p>Reload the page to try again.</p>}</EmptyState>;
  const p = result.profile;
  if (!p)
    return (
      <EmptyState label={<EvidenceLabel kind="unknown">Not yet written</EvidenceLabel>} title={`No reviewed profile of ${name} is published yet.`}>
        <p>
          Each part of the profile is written from cited sources and published only after a scholarly reviewer approves it. Facts the sources do not
          establish are shown as &ldquo;Not established&rdquo;, never estimated.
        </p>
      </EmptyState>
    );
  return (
    <div className="qp">
      <div className="qp-facts" role="list" aria-label="Key facts">
        {FACT_KINDS.map((k) => (
          <div role="listitem" key={k}>
            <Fact kind={k} s={p.facts[k]} />
          </div>
        ))}
      </div>
      <DepthTabs
        tabs={[
          { id: "overview", label: "Overview", content: <Prose list={p.overview} empty="The 30-second overview is not written yet." /> },
          { id: "narrative", label: "Narrative", content: <Prose list={p.narrative} empty="The narrative is not written yet." /> },
          { id: "study", label: "Study", content: <Prose list={p.study} empty="The source-based study is not written yet." /> },
        ]}
      />
    </div>
  );
}
