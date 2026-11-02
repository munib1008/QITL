"use client";

import Link from "next/link";
import { useState } from "react";
import { partnersT } from "@/lib/i18n/modules/partners";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { AreaField, CheckField, SelectField, TextField } from "./fields";
import { Pill, languageName, regionName } from "./shared";
import type { DashData } from "./useDashData";
import {
  ADDABLE_ROLES,
  AUDIENCES,
  COUNTRY_CODES,
  CONTACT_KINDS,
  CURRENCIES,
  GROUP_TYPES,
  LANGUAGE_CODES,
  LEVELS,
  PARTNER_SET_STATUSES,
  PRICING_TYPES,
  PROVIDER_TYPES,
  QUALIFICATION_KINDS,
  SERVICE_MODES,
  SERVICE_STATUSES,
  UNPRICED_TYPES,
  VERIFICATION_KINDS,
  type PricingType,
} from "@/lib/partners/constants";
import { priceLines } from "@/lib/partners/pricing";
import { AvailabilityInput, ContactInput, MemberInput, PricingInput, ProfilePatch, QualificationInput, ServiceInput } from "@/lib/partners/validation";
import type { CategoryOption } from "./RegisterWizard";

type T = ReturnType<typeof partnersT>;
interface PanelProps {
  locale: string;
  t: T;
  d: DashData;
  userId: string;
  role: string;
  reload: () => Promise<void>;
}

/** Run an API call, show its outcome, then reload the dashboard data. */
function useAct(t: T, reload: () => Promise<void>) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      if (ok) setMsg({ tone: "ok", text: ok });
      await reload();
      return true;
    } catch (e) {
      setMsg({ tone: "err", text: `${t.failedPrefix} ${(e as Error).message}` });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { msg, busy, run };
}
const zodText = (e: { issues: Array<{ path: PropertyKey[]; message: string }> }) => e.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`).join("; ");
const opts = (list: readonly string[], labels: Record<string, string>): Array<[string, string]> => list.map((v) => [v, labels[v] ?? v]);

// ---------------------------------------------------------------- Overview
export function OverviewPanel({ t, d, role, reload, locale }: PanelProps) {
  const a = useAct(t, reload);
  const p = d.partner;
  const canManage = role === "owner" || role === "admin";
  const checks = [
    { k: "description", ok: Boolean(p.short_description) },
    { k: "contact", ok: d.contacts.length > 0 },
    { k: "service", ok: d.services.some((s) => s.status === "draft" || s.status === "published") },
  ] as const;
  const submittable = ["draft", "changes_requested", "information_requested"].includes(p.listing_status);
  const move = (to: string) => a.run(() => apiCall(`/api/partners/${p.id}/transition`, "POST", { to }), t.saved);
  return (
    <div className="pt-sec">
      <section className="pt-card" aria-labelledby="ov-status-h">
        <h2 id="ov-status-h">{t.dashboard.statusLabel}</h2>
        <div className="pt-pills">
          <Pill tone={p.listing_status === "approved" ? "ok" : "warn"}>{t.listingStatus[p.listing_status]}</Pill>
        </div>
        <p>{t.dashboard.statusHelp[p.listing_status]}</p>
        {p.listing_status === "approved" ? (
          <Link className="zq-btn" href={`/partners/${p.slug}`}>
            {t.dashboard.viewPublic}
          </Link>
        ) : null}
        <Feedback msg={a.msg} />
        {canManage ? (
          <div className="pt-actions">
            {submittable ? (
              <button type="button" className="zq-btn zq-btn-primary" disabled={a.busy || !checks.every((c) => c.ok)} onClick={() => void move("submitted")}>
                {t.dashboard.submitForReview}
              </button>
            ) : null}
            {p.listing_status === "approved" ? (
              <button type="button" className="zq-btn" disabled={a.busy} onClick={() => void move("draft")}>
                {t.dashboard.withdraw}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {submittable ? (
        <section className="pt-card" aria-labelledby="ov-check-h">
          <h2 id="ov-check-h">{t.dashboard.checklist}</h2>
          <ul className="pt-list">
            {checks.map((c) => (
              <li key={c.k}>
                <Pill tone={c.ok ? "ok" : "warn"}>{c.ok ? t.dashboard.done : t.dashboard.todo}</Pill> {t.dashboard.checks[c.k]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="pt-card" aria-labelledby="ov-notes-h">
        <h2 id="ov-notes-h">{t.dashboard.staffNotes}</h2>
        {!d.notes.length ? (
          <p className="zq-meta">{t.dashboard.noNotes}</p>
        ) : (
          <ul className="pt-list">
            {d.notes.map((n) => (
              <li key={n.id}>
                <span className="pt-meta">
                  {n.subject.startsWith("qualification:") ? t.provider.qualifications : (t.provider.verificationKinds[n.subject] ?? t.dashboard.tabs.overview)} · {new Date(n.created_at).toLocaleDateString(locale)}
                </span>
                <p dir="auto">{n.note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-card" aria-labelledby="ov-ver-h">
        <h2 id="ov-ver-h">{t.dashboard.verifications}</h2>
        <p className="zq-meta">{t.dashboard.verificationLead}</p>
        <ul className="pt-list">
          {VERIFICATION_KINDS.map((k) => {
            const v = d.verifications.find((x) => x.kind === k);
            const canAsk = canManage && (!v || v.status === "rejected" || v.status === "revoked");
            return (
              <li key={k} className="pt-actions">
                <b>{t.provider.verificationKinds[k]}</b>
                {v ? <Pill tone={v.status === "verified" ? "ok" : undefined}>{t.dashboard.verStatus[v.status]}</Pill> : null}
                {canAsk ? (
                  <button type="button" className="zq-btn" disabled={a.busy} onClick={() => void a.run(() => apiCall(`/api/partners/${p.id}/verification`, "POST", { kind: k }), t.dashboard.requested)}>
                    {t.dashboard.request}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Profile
export function ProfilePanel({ t, d, role, reload, locale }: PanelProps) {
  const a = useAct(t, reload);
  const p = d.partner;
  const [s, setS] = useState({
    display_name: p.display_name,
    provider_type: p.provider_type as string,
    country: p.country,
    city: p.city ?? "",
    service_area: p.service_area ?? "",
    languages: p.languages,
    short_description: p.short_description ?? "",
    long_description: p.long_description ?? "",
    years: p.years_experience === null ? "" : String(p.years_experience),
    slug: p.slug,
  });
  const f = t.fields;
  const can = role === "owner" || role === "admin";
  const locked = p.approved_at !== null;
  if (!can) return <p className="qa-notice">{t.dashboard.inboxNoAccess}</p>;
  const save = async () => {
    const body = ProfilePatch.safeParse({
      display_name: s.display_name,
      provider_type: s.provider_type,
      country: s.country,
      city: s.city || null,
      service_area: s.service_area || null,
      languages: s.languages,
      short_description: s.short_description || null,
      long_description: s.long_description || null,
      years_experience: s.years === "" ? null : Number(s.years),
      ...(locked ? {} : { slug: s.slug }),
    });
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    await a.run(() => apiCall(`/api/partners/${p.id}`, "PATCH", body.data), t.saved);
  };
  return (
    <form
      className="pt-card"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {p.listing_status === "approved" ? <p className="qa-notice">{t.dashboard.statusHelp.approved}</p> : null}
      <TextField id="pf-name" label={f.displayName} value={s.display_name} onChange={(v) => setS({ ...s, display_name: v })} required maxLength={120} />
      <TextField id="pf-slug" label={f.slug} value={s.slug} onChange={(v) => setS({ ...s, slug: v.toLowerCase() })} dir="ltr" maxLength={60} help={f.slugHelp} />
      <SelectField id="pf-type" label={f.providerType} value={s.provider_type} onChange={(v) => setS({ ...s, provider_type: v })} options={opts(PROVIDER_TYPES, t.providerTypes)} />
      <div className="pt-row">
        <SelectField id="pf-country" label={f.country} value={s.country} onChange={(v) => setS({ ...s, country: v })} options={COUNTRY_CODES.map((c) => [c, regionName(c, locale)] as [string, string])} />
        <TextField id="pf-city" label={f.city} value={s.city} onChange={(v) => setS({ ...s, city: v })} maxLength={80} />
      </div>
      <TextField id="pf-area" label={f.serviceArea} value={s.service_area} onChange={(v) => setS({ ...s, service_area: v })} maxLength={200} />
      <fieldset className="qa-choices" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>{f.languages}</legend>
        {LANGUAGE_CODES.map((c) => (
          <CheckField key={c} id={`pf-l-${c}`} label={languageName(c, locale)} checked={s.languages.includes(c)} onChange={(on) => setS({ ...s, languages: on ? [...s.languages, c] : s.languages.filter((x) => x !== c) })} />
        ))}
      </fieldset>
      <AreaField id="pf-short" label={f.shortDescription} value={s.short_description} onChange={(v) => setS({ ...s, short_description: v })} rows={3} maxLength={280} help={f.shortHelp} />
      <AreaField id="pf-long" label={f.longDescription} value={s.long_description} onChange={(v) => setS({ ...s, long_description: v })} rows={6} maxLength={4000} />
      <TextField id="pf-years" label={f.years} type="number" value={s.years} onChange={(v) => setS({ ...s, years: v })} min={0} max={80} />
      <Feedback msg={a.msg} />
      <div className="pt-actions">
        <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>
          {a.busy ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Courses
interface ServiceDraft {
  category_id: string;
  title: string;
  description: string;
  level: string;
  audience: string;
  mode: string;
  group_type: string;
  duration: string;
  language: string;
  status: string;
}
const blankService = (cat: string): ServiceDraft => ({ category_id: cat, title: "", description: "", level: "all_levels", audience: "all", mode: "online", group_type: "both", duration: "", language: "ar", status: "draft" });

export function ServicesPanel({ t, d, role, reload, locale, categories }: PanelProps & { categories: CategoryOption[] }) {
  const a = useAct(t, reload);
  const [editing, setEditing] = useState<string | null>(null); // service id, "new", or null
  const [s, setS] = useState<ServiceDraft>(blankService(categories[0]?.id ?? ""));
  const can = ["owner", "admin", "instructor"].includes(role);
  const f = t.fields;
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const start = (id: string) => {
    const x = d.services.find((v) => v.id === id);
    setS(
      x
        ? { category_id: x.category_id, title: x.title, description: x.description ?? "", level: x.level, audience: x.audience, mode: x.mode, group_type: x.group_type, duration: x.duration_minutes ? String(x.duration_minutes) : "", language: x.language, status: x.status }
        : blankService(categories[0]?.id ?? ""),
    );
    setEditing(id);
  };
  const save = async () => {
    const body = ServiceInput.safeParse({ ...s, description: s.description || null, duration_minutes: s.duration === "" ? null : Number(s.duration) });
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    const ok = await a.run(
      () => (editing === "new" ? apiCall("/api/partners/items/services", "POST", { partner_id: d.partner.id, ...body.data }) : apiCall(`/api/partners/items/services?id=${editing}`, "PUT", body.data)),
      t.saved,
    );
    if (ok) setEditing(null);
  };
  return (
    <div className="pt-sec">
      <p className="zq-meta">{t.dashboard.published}</p>
      <ul className="pt-list">
        {d.services.map((x) => (
          <li key={x.id} className="pt-card">
            <h3 dir="auto">{x.title}</h3>
            <div className="pt-pills">
              <Pill>{catName.get(x.category_id) ?? "—"}</Pill>
              <Pill>{t.serviceStatus[x.status]}</Pill>
              <Pill>{t.modes[x.mode]}</Pill>
              <Pill>{languageName(x.language, locale)}</Pill>
            </div>
            {can ? (
              <div className="pt-actions">
                <button type="button" className="zq-btn" onClick={() => start(x.id)}>
                  {t.edit}
                </button>
                <button
                  type="button"
                  className="zq-btn"
                  disabled={a.busy}
                  onClick={() => {
                    if (window.confirm(t.confirmRemove)) void a.run(() => apiCall(`/api/partners/items/services?id=${x.id}`, "DELETE"));
                  }}
                >
                  {t.remove}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Feedback msg={a.msg} />
      {can && editing === null ? (
        <div className="pt-actions">
          <button type="button" className="zq-btn zq-btn-primary" onClick={() => start("new")}>
            {t.dashboard.newService}
          </button>
        </div>
      ) : null}
      {can && editing !== null ? (
        <form
          className="pt-card"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <SelectField id="sv-cat" label={f.category} value={s.category_id} onChange={(v) => setS({ ...s, category_id: v })} options={categories.map((c) => [c.id, `${t.tracks[c.track]}: ${c.name}`] as [string, string])} required />
          <TextField id="sv-title" label={f.title} value={s.title} onChange={(v) => setS({ ...s, title: v })} required maxLength={140} />
          <AreaField id="sv-desc" label={f.description} value={s.description} onChange={(v) => setS({ ...s, description: v })} maxLength={2000} />
          <div className="pt-row">
            <SelectField id="sv-level" label={f.level} value={s.level} onChange={(v) => setS({ ...s, level: v })} options={opts(LEVELS, t.levels)} />
            <SelectField id="sv-aud" label={f.audience} value={s.audience} onChange={(v) => setS({ ...s, audience: v })} options={opts(AUDIENCES, t.audiences)} />
            <SelectField id="sv-mode" label={f.mode} value={s.mode} onChange={(v) => setS({ ...s, mode: v })} options={opts(SERVICE_MODES, t.modes)} />
            <SelectField id="sv-grp" label={f.groupType} value={s.group_type} onChange={(v) => setS({ ...s, group_type: v })} options={opts(GROUP_TYPES, t.groupTypes)} />
            <SelectField id="sv-lang" label={f.language} value={s.language} onChange={(v) => setS({ ...s, language: v })} options={LANGUAGE_CODES.map((c) => [c, languageName(c, locale)] as [string, string])} />
            <TextField id="sv-dur" label={f.duration} type="number" value={s.duration} onChange={(v) => setS({ ...s, duration: v })} min={5} max={600} />
            <SelectField id="sv-status" label={f.status} value={s.status} onChange={(v) => setS({ ...s, status: v })} options={opts(SERVICE_STATUSES, t.serviceStatus)} />
          </div>
          <div className="pt-actions">
            <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>
              {a.busy ? t.saving : t.save}
            </button>
            <button type="button" className="zq-btn" onClick={() => setEditing(null)}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Pricing and availability (per course)
function ServicePicker({ t, d, value, onChange }: { t: T; d: DashData; value: string; onChange: (v: string) => void }) {
  if (!d.services.length) return <p className="qa-notice">{t.dashboard.noServices}</p>;
  return <SelectField id="svc-pick" label={t.dashboard.pickService} value={value} onChange={onChange} options={d.services.map((s) => [s.id, s.title] as [string, string])} />;
}

export function PricingPanel({ t, d, role, reload, locale }: PanelProps) {
  const a = useAct(t, reload);
  const [sid, setSid] = useState(d.services[0]?.id ?? "");
  const [editing, setEditing] = useState<string | null>(null);
  const [s, setS] = useState({ pricing_type: "on_request" as PricingType, currency: "USD", amount: "", classes: "", registration_fee: "", materials_fee: "", fees_note: "" });
  const can = ["owner", "admin", "instructor"].includes(role);
  const f = t.fields;
  const priced = !(UNPRICED_TYPES as readonly string[]).includes(s.pricing_type);
  const labels = { types: t.pricing.types, units: t.pricing.units, per: t.pricing.per, classes: t.pricing.classes, registrationFee: t.pricing.registrationFee, materialsFee: t.pricing.materialsFee };
  const rows = d.pricing.filter((x) => x.service_id === sid);
  const start = (id: string) => {
    const x = d.pricing.find((v) => v.id === id);
    setS(
      x
        ? { pricing_type: x.pricing_type, currency: x.currency ?? "USD", amount: x.amount === null ? "" : String(x.amount), classes: x.classes_included ? String(x.classes_included) : "", registration_fee: x.registration_fee === null ? "" : String(x.registration_fee), materials_fee: x.materials_fee === null ? "" : String(x.materials_fee), fees_note: x.fees_note ?? "" }
        : { pricing_type: "on_request", currency: "USD", amount: "", classes: "", registration_fee: "", materials_fee: "", fees_note: "" },
    );
    setEditing(id);
  };
  const num = (v: string) => (v === "" ? null : Number(v));
  const save = async () => {
    const body = PricingInput.safeParse({
      pricing_type: s.pricing_type,
      currency: priced ? s.currency : null,
      amount: priced ? num(s.amount) : null,
      classes_included: priced && s.pricing_type === "package" ? num(s.classes) : null,
      registration_fee: priced ? num(s.registration_fee) : null,
      materials_fee: priced ? num(s.materials_fee) : null,
      fees_note: s.fees_note || null,
    });
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    const ok = await a.run(() => (editing === "new" ? apiCall("/api/partners/items/pricing", "POST", { service_id: sid, ...body.data }) : apiCall(`/api/partners/items/pricing?id=${editing}`, "PUT", body.data)), t.saved);
    if (ok) setEditing(null);
  };
  return (
    <div className="pt-sec">
      <ServicePicker t={t} d={d} value={sid} onChange={(v) => { setSid(v); setEditing(null); }} />
      <p className="pt-claim">{t.pricing.statedBy}</p>
      <ul className="pt-list">
        {rows.map((x) => (
          <li key={x.id} className="pt-price">
            {priceLines(x, labels, locale).map((line, i) => (i === 0 ? <b key={i}>{line}</b> : <span key={i}>{line}</span>))}
            {can ? (
              <span className="pt-actions">
                <button type="button" className="zq-btn" onClick={() => start(x.id)}>
                  {t.edit}
                </button>
                <button type="button" className="zq-btn" disabled={a.busy} onClick={() => { if (window.confirm(t.confirmRemove)) void a.run(() => apiCall(`/api/partners/items/pricing?id=${x.id}`, "DELETE")); }}>
                  {t.remove}
                </button>
              </span>
            ) : null}
          </li>
        ))}
        {!rows.length && sid ? <li className="zq-meta">{t.pricing.none}</li> : null}
      </ul>
      <Feedback msg={a.msg} />
      {can && sid && editing === null ? (
        <div className="pt-actions">
          <button type="button" className="zq-btn zq-btn-primary" onClick={() => start("new")}>
            {t.dashboard.addPrice}
          </button>
        </div>
      ) : null}
      {can && editing !== null ? (
        <form className="pt-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <SelectField id="pr-type" label={f.pricingType} value={s.pricing_type} onChange={(v) => setS({ ...s, pricing_type: v as PricingType })} options={opts(PRICING_TYPES, t.pricing.types)} />
          {priced ? (
            <div className="pt-row">
              <SelectField id="pr-cur" label={f.currency} value={s.currency} onChange={(v) => setS({ ...s, currency: v })} options={CURRENCIES.map((c) => [c, c] as [string, string])} />
              <TextField id="pr-amt" label={f.amount} type="number" step="0.01" min={0.01} value={s.amount} onChange={(v) => setS({ ...s, amount: v })} required />
              {s.pricing_type === "package" ? <TextField id="pr-cls" label={f.classesIncluded} type="number" min={2} value={s.classes} onChange={(v) => setS({ ...s, classes: v })} required /> : null}
              <TextField id="pr-reg" label={f.registrationFee} type="number" step="0.01" min={0} value={s.registration_fee} onChange={(v) => setS({ ...s, registration_fee: v })} />
              <TextField id="pr-mat" label={f.materialsFee} type="number" step="0.01" min={0} value={s.materials_fee} onChange={(v) => setS({ ...s, materials_fee: v })} />
            </div>
          ) : null}
          <TextField id="pr-note" label={f.feesNote} value={s.fees_note} onChange={(v) => setS({ ...s, fees_note: v })} maxLength={300} />
          <div className="pt-actions">
            <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>{a.busy ? t.saving : t.save}</button>
            <button type="button" className="zq-btn" onClick={() => setEditing(null)}>{t.cancel}</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function AvailabilityPanel({ t, d, role, reload }: PanelProps) {
  const a = useAct(t, reload);
  const [sid, setSid] = useState(d.services[0]?.id ?? "");
  const [s, setS] = useState({ weekday: "1", start_time: "18:00", end_time: "19:00", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", note: "" });
  const can = ["owner", "admin", "instructor"].includes(role);
  const f = t.fields;
  const rows = d.availability.filter((x) => x.service_id === sid);
  const add = async () => {
    const body = AvailabilityInput.safeParse({ ...s, weekday: Number(s.weekday), note: s.note || null });
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    await a.run(() => apiCall("/api/partners/items/availability", "POST", { service_id: sid, ...body.data }), t.saved);
  };
  return (
    <div className="pt-sec">
      <ServicePicker t={t} d={d} value={sid} onChange={setSid} />
      <h2>{t.dashboard.times}</h2>
      <ul className="pt-list">
        {rows.map((x) => (
          <li key={x.id} className="pt-actions" dir="auto">
            <span>
              {t.weekdays[x.weekday]} {x.start_time.slice(0, 5)}–{x.end_time.slice(0, 5)} ({x.timezone}){x.note ? `, ${x.note}` : ""}
            </span>
            {can ? (
              <button type="button" className="zq-btn" disabled={a.busy} onClick={() => void a.run(() => apiCall(`/api/partners/items/availability?id=${x.id}`, "DELETE"))}>
                {t.remove}
              </button>
            ) : null}
          </li>
        ))}
        {!rows.length && sid ? <li className="zq-meta">{t.provider.noAvailability}</li> : null}
      </ul>
      <Feedback msg={a.msg} />
      {can && sid ? (
        <form className="pt-card" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <h3>{t.dashboard.addTime}</h3>
          <div className="pt-row">
            <SelectField id="av-day" label={f.weekday} value={s.weekday} onChange={(v) => setS({ ...s, weekday: v })} options={t.weekdays.map((w, i) => [String(i), w] as [string, string])} />
            <TextField id="av-from" label={f.start} type="time" value={s.start_time} onChange={(v) => setS({ ...s, start_time: v })} required />
            <TextField id="av-to" label={f.end} type="time" value={s.end_time} onChange={(v) => setS({ ...s, end_time: v })} required />
            <TextField id="av-tz" label={f.timezone} value={s.timezone} onChange={(v) => setS({ ...s, timezone: v })} dir="ltr" required maxLength={64} />
          </div>
          <TextField id="av-note" label={f.note} value={s.note} onChange={(v) => setS({ ...s, note: v })} maxLength={200} />
          <div className="pt-actions">
            <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>{t.add}</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Inquiries
interface Message {
  id: string;
  sender_side: string;
  body: string;
  created_at: string;
}
export function InquiriesPanel({ t, d, role, reload, locale }: PanelProps) {
  const a = useAct(t, reload);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  if (!["owner", "admin", "inquiry_manager"].includes(role)) return <p className="qa-notice">{t.dashboard.inboxNoAccess}</p>;
  const load = async (id: string) => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.from("partner_inquiry_messages").select("id, sender_side, body, created_at").eq("inquiry_id", id).order("created_at");
    setMsgs((data ?? []) as Message[]);
  };
  const toggle = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    await load(id);
    const q = d.inquiries.find((x) => x.id === id);
    if (q?.status === "new") await a.run(() => apiCall(`/api/partners/inquiries/${id}`, "PATCH", { status: "viewed" }));
  };
  const send = async (id: string) => {
    const ok = await a.run(() => apiCall(`/api/partners/inquiries/${id}/messages`, "POST", { body: reply }));
    if (ok) {
      setReply("");
      await load(id);
    }
  };
  return (
    <div className="pt-sec" aria-label={t.dashboard.inbox}>
      <h2>{t.dashboard.inbox}</h2>
      <Feedback msg={a.msg} />
      {!d.inquiries.length ? (
        <p className="zq-meta">{t.dashboard.inboxEmpty}</p>
      ) : (
        <ul className="pt-list" data-testid="inbox">
          {d.inquiries.map((q) => (
            <li key={q.id} className="pt-card">
              <div className="pt-pills">
                <Pill tone={q.status === "new" ? "warn" : undefined}>{t.dashboard.inquiryStatus[q.status]}</Pill>
                {q.for_child ? <Pill>{t.dashboard.forChildFlag}</Pill> : null}
              </div>
              <h3 dir="auto">{q.subject}</h3>
              <p className="pt-meta">
                {t.dashboard.learnerLabel}: {q.learner_alias || "—"} · {new Date(q.created_at).toLocaleDateString(locale)}
              </p>
              <button type="button" className="zq-btn" aria-expanded={open === q.id} onClick={() => void toggle(q.id)}>
                {open === q.id ? t.admin.close : t.open}
              </button>
              {open === q.id ? (
                <div className="pt-sec">
                  <p dir="auto" style={{ whiteSpace: "pre-wrap" }}>{q.message}</p>
                  <ul className="pt-thread">
                    {msgs.map((m) => (
                      <li key={m.id} data-side={m.sender_side} dir="auto">
                        <span className="pt-meta">{m.sender_side === "partner" ? t.learner.provider : t.dashboard.learnerLabel}</span>
                        <br />
                        {m.body}
                      </li>
                    ))}
                  </ul>
                  {!["closed", "spam"].includes(q.status) ? (
                    <>
                      <AreaField id={`rp-${q.id}`} label={t.dashboard.replyPlaceholder} value={reply} onChange={setReply} rows={3} maxLength={2000} />
                      <div className="pt-actions">
                        <button type="button" className="zq-btn zq-btn-primary" disabled={a.busy || !reply.trim()} onClick={() => void send(q.id)}>
                          {t.learner.send}
                        </button>
                      </div>
                    </>
                  ) : null}
                  <SelectField
                    id={`st-${q.id}`}
                    label={t.dashboard.markAs}
                    value={q.status === "new" ? "" : q.status}
                    blank="—"
                    onChange={(v) => v && void a.run(() => apiCall(`/api/partners/inquiries/${q.id}`, "PATCH", { status: v }), t.saved)}
                    options={opts(PARTNER_SET_STATUSES, t.dashboard.inquiryStatus)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Documents (qualifications and their private files)
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export function DocumentsPanel({ t, d, role, reload }: PanelProps) {
  const a = useAct(t, reload);
  const [editing, setEditing] = useState<string | null>(null);
  const [s, setS] = useState({ kind: "certificate", title: "", issuer: "", year: "", claim: "", show_publicly: false });
  const can = role === "owner" || role === "admin";
  const f = t.fields;
  if (!can) return <p className="qa-notice">{t.dashboard.inboxNoAccess}</p>;
  const start = (id: string) => {
    const x = d.quals.find((v) => v.id === id);
    setS(x ? { kind: x.kind, title: x.title, issuer: x.issuer ?? "", year: x.year ? String(x.year) : "", claim: x.claim ?? "", show_publicly: x.show_publicly } : { kind: "certificate", title: "", issuer: "", year: "", claim: "", show_publicly: false });
    setEditing(id);
  };
  const save = async () => {
    const body = QualificationInput.safeParse({ ...s, issuer: s.issuer || null, year: s.year === "" ? null : Number(s.year), claim: s.claim || null });
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    const ok = await a.run(() => (editing === "new" ? apiCall("/api/partners/items/qualifications", "POST", { partner_id: d.partner.id, ...body.data }) : apiCall(`/api/partners/items/qualifications?id=${editing}`, "PUT", body.data)), t.saved);
    if (ok) setEditing(null);
  };
  const upload = async (qid: string, file: File) => {
    const ext = EXT[file.type];
    if (!ext || file.size > 10 * 1024 * 1024 || file.size < 1) return void a.run(() => Promise.reject(new Error(f.file)));
    const sb = getBrowserSupabase();
    if (!sb) return;
    const path = `${d.partner.id}/${crypto.randomUUID()}.${ext}`;
    await a.run(async () => {
      const up = await sb.storage.from("partner-docs").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      if (d.documents.includes(qid)) await apiCall(`/api/partners/items/files?id=${qid}`, "DELETE");
      await apiCall("/api/partners/items/files", "POST", { partner_id: d.partner.id, qualification_id: qid, storage_path: path, mime_type: file.type, size_bytes: file.size });
    }, t.saved);
  };
  return (
    <div className="pt-sec">
      <h2>{t.dashboard.qualList}</h2>
      <p className="qa-notice">{t.dashboard.qualLead}</p>
      <ul className="pt-list">
        {d.quals.map((q) => (
          <li key={q.id} className="pt-card">
            <h3 dir="auto">{q.title}</h3>
            <div className="pt-pills">
              <Pill tone={q.status === "verified" ? "ok" : undefined}>{t.dashboard.qualStatus[q.status]}</Pill>
              <Pill>{q.show_publicly ? t.dashboard.contactPublic : t.dashboard.contactPrivate}</Pill>
              {d.documents.includes(q.id) ? <Pill>{t.dashboard.hasDocument}</Pill> : null}
            </div>
            <p className="pt-meta">{[q.issuer, q.year].filter(Boolean).join(" · ")}</p>
            <div className="zq-field">
              <label htmlFor={`up-${q.id}`}>{f.file}</label>
              <input id={`up-${q.id}`} type="file" className="zq-input" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={a.busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(q.id, file); e.target.value = ""; }} />
            </div>
            <div className="pt-actions">
              <button type="button" className="zq-btn" onClick={() => start(q.id)}>{t.edit}</button>
              <button type="button" className="zq-btn" disabled={a.busy} onClick={() => { if (window.confirm(t.confirmRemove)) void a.run(() => apiCall(`/api/partners/items/qualifications?id=${q.id}`, "DELETE")); }}>{t.remove}</button>
            </div>
          </li>
        ))}
      </ul>
      <Feedback msg={a.msg} />
      {editing === null ? (
        <div className="pt-actions">
          <button type="button" className="zq-btn zq-btn-primary" onClick={() => start("new")}>{t.add}</button>
        </div>
      ) : (
        <form className="pt-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <SelectField id="ql-kind" label={f.qualKind} value={s.kind} onChange={(v) => setS({ ...s, kind: v })} options={opts(QUALIFICATION_KINDS, f.qualKinds)} />
          <TextField id="ql-title" label={f.title} value={s.title} onChange={(v) => setS({ ...s, title: v })} required maxLength={160} />
          <div className="pt-row">
            <TextField id="ql-issuer" label={f.issuer} value={s.issuer} onChange={(v) => setS({ ...s, issuer: v })} maxLength={160} />
            <TextField id="ql-year" label={f.year} type="number" value={s.year} onChange={(v) => setS({ ...s, year: v })} min={1900} max={2100} />
          </div>
          <AreaField id="ql-claim" label={f.claim} value={s.claim} onChange={(v) => setS({ ...s, claim: v })} rows={3} maxLength={500} />
          <CheckField id="ql-show" label={f.showPublicly} checked={s.show_publicly} onChange={(v) => setS({ ...s, show_publicly: v })} />
          <div className="pt-actions">
            <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>{a.busy ? t.saving : t.save}</button>
            <button type="button" className="zq-btn" onClick={() => setEditing(null)}>{t.cancel}</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Settings (contacts, team, leave / delete)
export function SettingsPanel({ t, d, role, reload, userId, locale }: PanelProps) {
  const a = useAct(t, reload);
  const [c, setC] = useState({ kind: "email", label: "", value: "", is_public: false });
  const [m, setM] = useState({ user_id: "", role: "instructor" });
  const f = t.fields;
  const manager = role === "owner" || role === "admin";
  const addContact = async () => {
    const body = ContactInput.safeParse({ ...c, label: c.label || null });
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    if (await a.run(() => apiCall("/api/partners/items/contacts", "POST", { partner_id: d.partner.id, ...body.data }), t.saved)) setC({ kind: "email", label: "", value: "", is_public: false });
  };
  const addMember = async () => {
    const body = MemberInput.safeParse(m);
    if (!body.success) return void a.run(() => Promise.reject(new Error(zodText(body.error))));
    if (await a.run(() => apiCall("/api/partners/items/members", "POST", { partner_id: d.partner.id, ...body.data }), t.saved)) setM({ user_id: "", role: "instructor" });
  };
  return (
    <div className="pt-sec">
      <section className="pt-card" aria-labelledby="st-contacts-h">
        <h2 id="st-contacts-h">{t.dashboard.contactsTitle}</h2>
        <p className="zq-meta">{t.register.contactLead}</p>
        {!manager && role !== "inquiry_manager" ? <p className="qa-notice">{t.dashboard.inboxNoAccess}</p> : null}
        <ul className="pt-list">
          {d.contacts.map((x) => (
            <li key={x.id} className="pt-actions">
              <span dir="auto">
                <b>{x.label || t.contactKinds[x.kind]}:</b> {x.value}
              </span>
              <Pill tone={x.is_public ? "warn" : undefined}>{x.is_public ? t.dashboard.contactPublic : t.dashboard.contactPrivate}</Pill>
              {manager ? (
                <>
                  <button type="button" className="zq-btn" disabled={a.busy} onClick={() => void a.run(() => apiCall(`/api/partners/items/contacts?id=${x.id}`, "PUT", { kind: x.kind, label: x.label, value: x.value, is_public: !x.is_public }), t.saved)}>
                    {x.is_public ? t.dashboard.contactPrivate : t.dashboard.contactPublic}
                  </button>
                  <button type="button" className="zq-btn" disabled={a.busy} onClick={() => void a.run(() => apiCall(`/api/partners/items/contacts?id=${x.id}`, "DELETE"))}>
                    {t.remove}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {manager ? (
          <form onSubmit={(e) => { e.preventDefault(); void addContact(); }} className="pt-sec">
            <div className="pt-row">
              <SelectField id="ct-kind" label={f.contactKind} value={c.kind} onChange={(v) => setC({ ...c, kind: v })} options={opts(CONTACT_KINDS, t.contactKinds)} />
              <TextField id="ct-val" label={f.contactValue} value={c.value} onChange={(v) => setC({ ...c, value: v })} dir="ltr" required maxLength={300} />
              <TextField id="ct-label" label={f.contactLabel} value={c.label} onChange={(v) => setC({ ...c, label: v })} maxLength={60} />
            </div>
            <CheckField id="ct-pub" label={f.isPublic} checked={c.is_public} onChange={(v) => setC({ ...c, is_public: v })} />
            <div className="pt-actions">
              <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>{t.add}</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="pt-card" aria-labelledby="st-team-h">
        <h2 id="st-team-h">{t.dashboard.team}</h2>
        <p className="zq-meta">{t.dashboard.teamLead}</p>
        <ul className="pt-list">
          {d.members.map((x) => (
            <li key={x.user_id} className="pt-actions">
              <Pill>{t.dashboard.roles[x.role]}</Pill>
              <span dir="ltr" className="pt-meta">{x.user_id === userId ? t.learner.you : x.user_id}</span>
              {role === "owner" && x.role !== "owner" ? (
                <button type="button" className="zq-btn" disabled={a.busy} onClick={() => void a.run(() => apiCall(`/api/partners/items/members?partner=${d.partner.id}&user=${x.user_id}`, "DELETE"))}>{t.remove}</button>
              ) : null}
              {x.user_id === userId && x.role !== "owner" ? (
                <button type="button" className="zq-btn" disabled={a.busy} onClick={() => { if (window.confirm(t.confirmRemove)) void a.run(() => apiCall(`/api/partners/items/members?partner=${d.partner.id}&user=${x.user_id}`, "DELETE")); }}>{t.dashboard.leave}</button>
              ) : null}
            </li>
          ))}
        </ul>
        {role === "owner" ? (
          <form onSubmit={(e) => { e.preventDefault(); void addMember(); }} className="pt-sec">
            <div className="pt-row">
              <TextField id="tm-user" label={t.dashboard.userId} value={m.user_id} onChange={(v) => setM({ ...m, user_id: v.trim() })} dir="ltr" required maxLength={36} />
              <SelectField id="tm-role" label={t.dashboard.team} value={m.role} onChange={(v) => setM({ ...m, role: v })} options={opts(ADDABLE_ROLES, t.dashboard.roles)} />
            </div>
            <div className="pt-actions">
              <button type="submit" className="zq-btn zq-btn-primary" disabled={a.busy}>{t.add}</button>
            </div>
          </form>
        ) : null}
        {role === "owner" && d.partner.listing_status === "draft" ? (
          <div className="pt-actions">
            <button type="button" className="zq-btn" disabled={a.busy} onClick={() => { if (window.confirm(t.confirmRemove)) void a.run(async () => { await apiCall(`/api/partners/${d.partner.id}`, "DELETE"); window.location.assign("/partners/dashboard"); }); }}>
              {t.dashboard.deleteDraft}
            </button>
          </div>
        ) : null}
        <Feedback msg={a.msg} />
        <p className="pt-claim">{regionName(d.partner.country, locale)}</p>
      </section>
    </div>
  );
}
