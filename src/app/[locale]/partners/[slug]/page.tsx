import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { NotConfigured, SignInNeeded } from "@/components/mufti/states";
import { InquiryForm } from "@/components/partners/InquiryForm";
import { ReportForm } from "@/components/partners/ReportForm";
import { PaymentsNotice, Pill, ScopeNotices, VerificationNotice, languageName, regionName } from "@/components/partners/shared";
import { getPublicSupabase, getUser } from "@/lib/supabase/server";
import { partnersT } from "@/lib/i18n/modules/partners";
import { loadCategories, loadProvider } from "@/lib/partners/queries";
import { categoryName } from "@/lib/partners/taxonomy";
import { priceLines } from "@/lib/partners/pricing";
import { SLUG_RE } from "@/lib/partners/validation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = partnersT(locale);
  const sb = getPublicSupabase();
  if (!sb || !SLUG_RE.test(slug)) return { title: t.title };
  const { data } = await sb.from("learning_partners").select("display_name, short_description").eq("slug", slug).eq("listing_status", "approved").maybeSingle();
  return data ? { title: data.display_name, description: data.short_description ?? t.lead } : { title: t.provider.notFound, robots: { index: false, follow: false } };
}

function contactHref(kind: string, value: string): string | null {
  if (kind === "email") return `mailto:${value}`;
  if (kind === "phone" || kind === "whatsapp") return /^\+?[0-9 ()-]{5,30}$/.test(value) ? `tel:${value.replace(/[^+\d]/g, "")}` : null;
  if (kind === "website" || kind === "social") return /^https:\/\//.test(value) ? value : null;
  return null;
}

/**
 * A provider's public page. Everything on it is the provider's own statement unless a verification says otherwise (and
 * says what was checked). Only public contact methods are read; private ones and documents are not reachable from here.
 */
export default async function ProviderPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = partnersT(locale);
  const page = (body: React.ReactNode, title?: string) => (
    <ReadingPage locale={locale} crumbs={[{ label: t.crumb, href: "/partners" }, { label: title ?? t.provider.notFound }]} title={title ?? t.provider.notFound}>
      <div className="zq-pagebody pt">{body}</div>
    </ReadingPage>
  );
  const sb = getPublicSupabase();
  if (!sb) return page(<NotConfigured locale={locale} title={t.notConnected} body={t.notConnectedBody} />, t.title);
  if (!SLUG_RE.test(slug)) notFound();
  const data = await loadProvider(sb, slug);
  if (!data) notFound();
  const { partner: p } = data;
  const [categories, { sb: userSb, user }] = await Promise.all([loadCategories(sb), getUser()]);
  let isMember = false;
  if (userSb && user) {
    const { data: m } = await userSb.from("partner_members").select("role").eq("partner_id", p.id).eq("user_id", user.id).maybeSingle();
    isMember = Boolean(m);
  }
  const catById = new Map(categories.map((c) => [c.id, c]));
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale);
  const labels = { types: t.pricing.types, units: t.pricing.units, per: t.pricing.per, classes: t.pricing.classes, registrationFee: t.pricing.registrationFee, materialsFee: t.pricing.materialsFee };
  const shownQuals = data.qualifications.filter((q) => q.show_publicly);

  return page(
    <>
      <PaymentsNotice t={t} />
      <section className="pt-card" aria-labelledby="pt-about-h">
        <h2 id="pt-about-h">{t.provider.about}</h2>
        <div className="pt-pills">
          <Pill>{t.providerTypes[p.provider_type]}</Pill>
          <Pill>{[p.city, regionName(p.country, locale)].filter(Boolean).join(", ")}</Pill>
        </div>
        <p className="pt-claim">{t.provider.statedBy}</p>
        {p.short_description ? <p>{p.short_description}</p> : null}
        {p.long_description ? <p style={{ whiteSpace: "pre-wrap" }}>{p.long_description}</p> : null}
        <dl className="pt-dl">
          {p.service_area ? (
            <>
              <dt>{t.provider.area}</dt>
              <dd>{p.service_area}</dd>
            </>
          ) : null}
          <dt>{t.provider.languages}</dt>
          <dd>{p.languages.map((l) => languageName(l, locale)).join(", ")}</dd>
          {p.years_experience !== null ? (
            <>
              <dt>{t.provider.statedBy}</dt>
              <dd>{t.provider.experience(p.years_experience)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="pt-sec" aria-labelledby="pt-courses-h">
        <h2 id="pt-courses-h">{t.provider.courses}</h2>
        {!data.services.length ? (
          <p className="zq-meta">{t.provider.noCourses}</p>
        ) : (
          <ul className="pt-list" data-testid="provider-courses">
            {data.services.map((s) => {
              const prices = data.pricing.filter((x) => x.service_id === s.id);
              const times = data.availability.filter((x) => x.service_id === s.id);
              const cat = catById.get(s.category_id);
              return (
                <li key={s.id} className="pt-card">
                  <h3>{s.title}</h3>
                  <div className="pt-pills">
                    {cat ? <Pill>{categoryName(cat, locale)}</Pill> : null}
                    <Pill>{t.modes[s.mode]}</Pill>
                    <Pill>{t.groupTypes[s.group_type]}</Pill>
                    <Pill>{t.levels[s.level]}</Pill>
                    {s.audience !== "all" ? <Pill>{t.audiences[s.audience]}</Pill> : null}
                  </div>
                  {s.description ? <p>{s.description}</p> : null}
                  <dl className="pt-dl">
                    <dt>{t.provider.teaches}</dt>
                    <dd>{languageName(s.language, locale)}</dd>
                  </dl>
                  {s.duration_minutes ? <p className="pt-meta">{t.provider.duration(s.duration_minutes)}</p> : null}
                  {prices.length ? (
                    <div className="pt-sec" data-testid="course-prices">
                      {prices.map((pr) => (
                        <div key={pr.id} className="pt-price">
                          {priceLines(pr, labels, locale).map((line, i) => (i === 0 ? <b key={i}>{line}</b> : <span key={i}>{line}</span>))}
                          <span className="pt-claim">{t.pricing.updated(fmtDate(pr.updated_at))}</span>
                        </div>
                      ))}
                      <p className="pt-claim">{t.pricing.statedBy}</p>
                    </div>
                  ) : (
                    <p className="zq-meta">{t.pricing.none}</p>
                  )}
                  {times.length ? (
                    <div>
                      <b>{t.provider.availability}</b>
                      <ul className="qa-limits" style={{ margin: 0, paddingInlineStart: 20 }}>
                        {times.map((x) => (
                          <li key={x.id} dir="auto">
                            {t.weekdays[x.weekday]} {x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)} ({x.timezone}){x.note ? `, ${x.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pt-sec" aria-labelledby="pt-qual-h">
        <h2 id="pt-qual-h">{t.provider.qualifications}</h2>
        {!shownQuals.length ? (
          <p className="zq-meta">{t.provider.noQualifications}</p>
        ) : (
          <ul className="pt-list" data-testid="provider-qualifications">
            {shownQuals.map((q) => (
              <li key={q.id} className="pt-card">
                <h3>{q.title}</h3>
                <div className="pt-pills">
                  <Pill tone={q.status === "verified" ? "ok" : "warn"}>{t.provider.qualStatus[q.status]}</Pill>
                </div>
                <p className="pt-meta">{[q.issuer, q.year].filter(Boolean).join(" · ")}</p>
                {q.claim ? <p>{q.claim}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="pt-claim">{t.provider.qualDocs}</p>
      </section>

      <section className="pt-sec" aria-labelledby="pt-ver-h">
        <h2 id="pt-ver-h">{t.provider.verification}</h2>
        {!data.verifications.length ? (
          <p className="zq-meta" data-testid="no-verification">
            {t.provider.noVerification}
          </p>
        ) : (
          <ul className="pt-list">
            {data.verifications.map((v) => (
              <li key={v.id} className="pt-card">
                <h3>{t.provider.verificationKinds[v.kind]}</h3>
                {v.decided_at ? <p className="pt-meta">{t.provider.verifiedOn(fmtDate(v.decided_at))}</p> : null}
                {v.scope_statement ? (
                  <p>
                    <b>{t.provider.checked}: </b>
                    {v.scope_statement}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <VerificationNotice t={t} />
      </section>

      <section className="pt-sec" aria-labelledby="pt-contact-h">
        <h2 id="pt-contact-h">{t.provider.contact}</h2>
        {!data.contacts.length ? (
          <p className="zq-meta">{t.provider.noContact}</p>
        ) : (
          <ul className="pt-list" data-testid="public-contacts">
            {data.contacts.map((c) => {
              const href = contactHref(c.kind, c.value);
              return (
                <li key={c.id}>
                  <b>{c.label || t.contactKinds[c.kind]}: </b>
                  {href ? (
                    <a href={href} dir="ltr" rel="noopener noreferrer nofollow">
                      {c.value}
                    </a>
                  ) : (
                    <span dir="auto">{c.value}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pt-sec">
        {userSb && user ? (
          isMember ? (
            <p className="qa-notice">{t.inquiry.own}</p>
          ) : (
            <InquiryForm locale={locale} partnerId={p.id} services={data.services.map((s) => ({ id: s.id, title: s.title }))} />
          )
        ) : (
          <>
            <h2 id="pt-inquiry-h">{t.inquiry.title}</h2>
            <SignInNeeded title={t.inquiry.signIn} link={t.signInLink} returnTo={`/partners/${p.slug}`} />
          </>
        )}
        {userSb && user && !isMember ? <ReportForm locale={locale} partnerId={p.id} /> : null}
      </section>

      <ScopeNotices t={t} safeguarding />
      <p>
        <Link href="/partners">{t.provider.back}</Link>
      </p>
    </>,
    p.display_name,
  );
}
