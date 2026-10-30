import Link from "next/link";
import { EditorialStatus } from "@/components/ui/evidence";
import {
  CATEGORIES,
  collectRefs,
  entriesFor,
  eventRelationshipsOf,
  nodeLabel,
  PROFILE_FIELDS,
  type Atlas,
  type Entry,
  type Profile,
  type ProfileField,
  type Relationship,
} from "@/lib/data/creation-types";
import type { CreationStrings } from "@/lib/i18n/modules/creation";
import { Citations, Dual, EntryBlock, EvidenceClassBadge, NotEstablished } from "./parts";

type L = "en" | "ar";

function Entries({ list, t }: { list: Entry[]; t: CreationStrings }) {
  if (!list.length) return <NotEstablished t={t} />;
  return (
    <div className="cr-entries">
      {list.map((e) => (
        <EntryBlock key={e.id} entry={e} t={t} heading={e.kind === "misconception" && e.question ? <b className="cr-entry-title">{e.question}</b> : undefined} />
      ))}
    </div>
  );
}

function EventRels({ rels, profiles, t, locale }: { rels: Relationship[]; profiles: Profile[]; t: CreationStrings; locale: L }) {
  return (
    <ul className="cr-rels">
      {rels.map((r) => {
        const f = nodeLabel(r.fromKind, r.fromRef, profiles, locale);
        const to = nodeLabel(r.toKind, r.toRef, profiles, locale);
        return (
          <li key={r.id} className="cr-rel">
            <p>
              <b>{f.label}</b> <span className="cr-rel-verb">{r.relation}</span> <b>{to.label}</b>
            </p>
            <span className="cr-refs">
              <EvidenceClassBadge cls={r.evidence} t={t} />
              <Citations refs={r.refs} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The 17-field profile template. A field without a published entry prints the fixed not-established sentence; it is
 * never left blank and never filled with an assumption. Every entry shows its evidence class and citations.
 */
export function ProfileView({ atlas, profile, t, locale }: { atlas: Atlas; profile: Profile; t: CreationStrings; locale: L }) {
  const cat = CATEGORIES.find((c) => c.id === profile.categoryId)!;
  const hadith = collectRefs(profile.entries.map((e) => e.refs).concat(atlas.relationships.map((r) => r.refs))).filter((r) => r.kind === "hadith");
  const eventRels = eventRelationshipsOf(atlas.relationships, profile.slug);
  const sourceRefs = collectRefs([...profile.entries.map((e) => e.refs), ...atlas.relationships.map((r) => r.refs), ...atlas.stories.map((s) => s.refs)]);
  const date = new Date(profile.updatedAt).toLocaleDateString(locale === "ar" ? "ar" : "en-GB", { year: "numeric", month: "long", day: "numeric" });

  const body = (f: ProfileField) => {
    switch (f) {
      case "name":
        return (
          <p className="cr-name">
            <span>{profile.nameEn}</span>{" "}
            <span lang="ar" dir="rtl" className="cr-name-ar">
              {profile.nameAr}
            </span>
          </p>
        );
      case "classification":
        return profile.classification ? (
          <p className="cr-entry">
            <span>{profile.classification}</span>{" "}
            <span className="zq-meta">
              ({locale === "ar" ? cat.nameAr : cat.nameEn} · {t.profile.reviewedField})
            </span>
          </p>
        ) : (
          <NotEstablished t={t} />
        );
      case "quranic_events": {
        const list = entriesFor(profile, "quranic_events");
        if (!list.length && !eventRels.length) return <NotEstablished t={t} />;
        return (
          <>
            {list.length ? <Entries list={list} t={t} /> : null}
            {eventRels.length ? <EventRels rels={eventRels} profiles={atlas.profiles} t={t} locale={locale} /> : null}
          </>
        );
      }
      case "related_hadith":
        return hadith.length ? (
          <p className="cr-refs">
            <EvidenceClassBadge cls="authentic_hadith" t={t} />
            <Citations refs={hadith} />
          </p>
        ) : (
          <NotEstablished t={t} />
        );
      case "sources": {
        const list = entriesFor(profile, "sources");
        if (!list.length && !sourceRefs.length) return <NotEstablished t={t} />;
        return (
          <>
            {list.length ? <Entries list={list} t={t} /> : null}
            {sourceRefs.length ? (
              <p className="cr-refs" data-testid="profile-citations">
                <Citations refs={sourceRefs} />
              </p>
            ) : null}
          </>
        );
      }
      case "review_status":
        return (
          <p className="cr-entry">
            <EditorialStatus status="published">{t.profile.reviewed(profile.version, date)}</EditorialStatus>
          </p>
        );
      default:
        return <Entries list={entriesFor(profile, f)} t={t} />;
    }
  };

  const kidsLabel = (f: ProfileField) => (t.profile.kidsFields as Partial<Record<ProfileField, string>>)[f];
  return (
    <div className="cr-profile">
      <nav className="cr-toc" aria-label={t.profile.contents}>
        <ol>
          {PROFILE_FIELDS.map((f, i) => (
            <li key={f}>
              <a href={`#f-${f}`}>
                <span className="cr-toc-n">{i + 1}</span> {t.profile.fields[f]}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="cr-fields">
        {PROFILE_FIELDS.map((f, i) => (
          <section key={f} id={`f-${f}`} className="cr-field" data-field={f} aria-labelledby={`f-${f}-h`}>
            <h2 id={`f-${f}-h`}>
              <span className="cr-field-n" aria-hidden="true">
                {i + 1}
              </span>
              <Dual normal={t.profile.fields[f]} kids={kidsLabel(f)} />
            </h2>
            {body(f)}
          </section>
        ))}
        {atlas.stories.length ? (
          <section className="cr-field" id="stories" aria-labelledby="f-stories-h">
            <h2 id="f-stories-h">{t.sections.stories}</h2>
            <ul className="cr-stories">
              {atlas.stories.map((s) => (
                <li key={s.id} className="cr-story">
                  <h3>
                    <Link href={`/creation#story-${s.slug}`}>{locale === "ar" && s.titleAr ? s.titleAr : s.title}</Link>
                  </h3>
                  {s.summary ? <p>{s.summary}</p> : null}
                  <span className="cr-refs">
                    <Citations refs={s.refs} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
