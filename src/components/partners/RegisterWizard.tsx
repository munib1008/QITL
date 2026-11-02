"use client";

import Link from "next/link";
import { useState } from "react";
import { partnersT } from "@/lib/i18n/modules/partners";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import {
  COUNTRY_CODES,
  CURRENCIES,
  GROUP_TYPES,
  LANGUAGE_CODES,
  LEVELS,
  PRICING_TYPES,
  PROVIDER_TYPES,
  SERVICE_MODES,
  UNPRICED_TYPES,
  type PricingType,
} from "@/lib/partners/constants";
import { ContactInput, PricingInput, ProfileInput, ServiceInput, slugify } from "@/lib/partners/validation";

export interface CategoryOption {
  id: string;
  name: string;
  track: string;
}

const STEPS = ["type", "profile", "service", "contact", "review"] as const;
const name = (code: string, type: "region" | "language", locale: string) => {
  try {
    return new Intl.DisplayNames([locale], { type }).of(code) ?? code;
  } catch {
    return code;
  }
};

interface State {
  type: string;
  displayName: string;
  slug: string;
  slugTouched: boolean;
  country: string;
  city: string;
  area: string;
  languages: string[];
  short: string;
  long: string;
  years: string;
  category: string;
  title: string;
  mode: string;
  group: string;
  level: string;
  teachLang: string;
  pricingType: PricingType;
  currency: string;
  amount: string;
  classes: string;
  contacts: Array<{ kind: "email" | "phone" | "website"; value: string; is_public: boolean }>;
}

/**
 * Provider registration, in steps. Nothing is public: the listing is created as a DRAFT and, if submitted, reviewed by QITL
 * staff before it appears. If a later request fails the draft already saved is kept and the provider finishes it from the
 * dashboard; the wizard remembers what it already saved so a retry does not create it twice.
 */
export function RegisterWizard({ locale, categories }: { locale: string; categories: CategoryOption[] }) {
  const t = partnersT(locale);
  const r = t.register;
  const f = t.fields;
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ id?: string; contacts: number; service?: string; priced?: boolean }>({ contacts: 0 });
  const [done, setDone] = useState<null | "draft" | "submitted">(null);
  const [s, setS] = useState<State>({
    type: "",
    displayName: "",
    slug: "",
    slugTouched: false,
    country: "",
    city: "",
    area: "",
    languages: ["en"],
    short: "",
    long: "",
    years: "",
    category: categories[0]?.id ?? "",
    title: "",
    mode: "online",
    group: "both",
    level: "all_levels",
    teachLang: "ar",
    pricingType: "on_request",
    currency: "USD",
    amount: "",
    classes: "",
    contacts: [
      { kind: "email", value: "", is_public: false },
      { kind: "phone", value: "", is_public: false },
      { kind: "website", value: "", is_public: false },
    ],
  });
  const set = (p: Partial<State>) => setS((cur) => ({ ...cur, ...p }));
  const priced = !(UNPRICED_TYPES as readonly string[]).includes(s.pricingType);

  const profile = () =>
    ProfileInput.safeParse({
      slug: s.slug,
      provider_type: s.type,
      display_name: s.displayName,
      country: s.country,
      city: s.city || null,
      service_area: s.area || null,
      languages: s.languages,
      short_description: s.short || null,
      long_description: s.long || null,
      years_experience: s.years === "" ? null : Number(s.years),
    });
  const service = () => ServiceInput.safeParse({ category_id: s.category, title: s.title, mode: s.mode, group_type: s.group, level: s.level, language: s.teachLang, status: "published" });
  const price = () =>
    PricingInput.safeParse({
      pricing_type: s.pricingType,
      currency: priced ? s.currency : null,
      amount: priced && s.amount !== "" ? Number(s.amount) : null,
      classes_included: s.pricingType === "package" && s.classes !== "" ? Number(s.classes) : null,
    });
  const contactRows = s.contacts.filter((c) => c.value.trim()).map((c) => ({ ...c, value: c.value.trim() }));

  const validateStep = (n: number): string | null => {
    if (n === 0 && !s.type) return f.providerType;
    if (n === 1) {
      const p = profile();
      if (!p.success) return p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
    if (n === 2) {
      const a = service();
      if (!a.success) return a.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      const b = price();
      if (!b.success) return b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    }
    if (n === 3) for (const c of contactRows) {
      const v = ContactInput.safeParse(c);
      if (!v.success) return `${t.contactKinds[c.kind]}: ${v.error.issues[0]?.message}`;
    }
    return null;
  };

  const go = (to: number) => {
    setMsg(null);
    if (to > step) {
      const bad = validateStep(step);
      if (bad) {
        setMsg({ tone: "err", text: bad });
        return;
      }
    }
    setStep(to);
  };

  const finish = async (submit: boolean) => {
    setMsg(null);
    for (let n = 0; n < 4; n++) {
      const bad = validateStep(n);
      if (bad) {
        setStep(n);
        setMsg({ tone: "err", text: bad });
        return;
      }
    }
    setBusy(true);
    try {
      const prog = { ...saved };
      if (!prog.id) {
        const p = profile();
        if (!p.success) throw new Error("invalid");
        const res = await apiCall<{ id: string }>("/api/partners", "POST", p.data);
        prog.id = res.id;
        setSaved({ ...prog });
      }
      for (; prog.contacts < contactRows.length; prog.contacts++) {
        await apiCall("/api/partners/items/contacts", "POST", { partner_id: prog.id, ...contactRows[prog.contacts] });
        setSaved({ ...prog, contacts: prog.contacts + 1 });
      }
      if (!prog.service) {
        const a = service();
        if (!a.success) throw new Error("invalid");
        const res = await apiCall<{ row: { id: string } }>("/api/partners/items/services", "POST", { partner_id: prog.id, ...a.data });
        prog.service = res.row.id;
        setSaved({ ...prog });
      }
      if (!prog.priced) {
        const b = price();
        if (!b.success) throw new Error("invalid");
        await apiCall("/api/partners/items/pricing", "POST", { service_id: prog.service, ...b.data });
        prog.priced = true;
        setSaved({ ...prog });
      }
      if (submit) await apiCall(`/api/partners/${prog.id}/transition`, "POST", { to: "submitted" });
      setDone(submit ? "submitted" : "draft");
    } catch (err) {
      setMsg({ tone: "err", text: `${t.failedPrefix} ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="pt-card" role="status" data-testid="register-done">
        <h2>{done === "submitted" ? r.doneSubmitted : r.done}</h2>
        <p>{r.nothingShown}</p>
        <div className="pt-actions">
          <Link className="zq-btn zq-btn-primary" href="/partners/dashboard">
            {r.goDashboard}
          </Link>
        </div>
      </div>
    );

  const toggleLang = (c: string) => set({ languages: s.languages.includes(c) ? s.languages.filter((x) => x !== c) : [...s.languages, c] });

  return (
    <form
      className="pt-sec"
      onSubmit={(e) => {
        e.preventDefault();
        if (step < STEPS.length - 1) go(step + 1);
        else void finish(true);
      }}
    >
      <ol className="pt-steps" aria-label={r.stepOf(step + 1, STEPS.length)}>
        {STEPS.map((k, i) => (
          <li key={k} aria-current={i === step ? "step" : undefined}>
            {i + 1}. {r.steps[k]}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="qa-choices" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{f.providerType}</legend>
          {PROVIDER_TYPES.map((p) => (
            <label key={p} className="pt-choice">
              <input type="radio" name="type" value={p} checked={s.type === p} onChange={() => set({ type: p })} />
              <span>{t.providerTypes[p]}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <div className="pt-sec">
          <div className="zq-field">
            <label htmlFor="rg-name">{f.displayName}</label>
            <input id="rg-name" className="zq-input" value={s.displayName} maxLength={120} required onChange={(e) => set({ displayName: e.target.value, ...(s.slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
          </div>
          <div className="zq-field">
            <label htmlFor="rg-slug">{f.slug}</label>
            <input id="rg-slug" className="zq-input" dir="ltr" value={s.slug} maxLength={60} required onChange={(e) => set({ slug: e.target.value.toLowerCase(), slugTouched: true })} aria-describedby="rg-slug-d" />
            <span className="zq-help" id="rg-slug-d">
              {f.slugHelp}
            </span>
          </div>
          <div className="pt-row">
            <div className="zq-field">
              <label htmlFor="rg-country">{f.country}</label>
              <select id="rg-country" className="zq-input" value={s.country} required onChange={(e) => set({ country: e.target.value })}>
                <option value="" disabled>
                  —
                </option>
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {name(c, "region", locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="rg-city">{f.city}</label>
              <input id="rg-city" className="zq-input" value={s.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} />
            </div>
          </div>
          <div className="zq-field">
            <label htmlFor="rg-area">{f.serviceArea}</label>
            <input id="rg-area" className="zq-input" value={s.area} maxLength={200} onChange={(e) => set({ area: e.target.value })} />
          </div>
          <fieldset className="qa-choices" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>{f.languages}</legend>
            {LANGUAGE_CODES.map((c) => (
              <label key={c} className="pt-choice">
                <input type="checkbox" checked={s.languages.includes(c)} onChange={() => toggleLang(c)} />
                <span>{name(c, "language", locale)}</span>
              </label>
            ))}
          </fieldset>
          <div className="zq-field">
            <label htmlFor="rg-short">{f.shortDescription}</label>
            <textarea id="rg-short" className="zq-textarea" rows={3} value={s.short} minLength={20} maxLength={280} required onChange={(e) => set({ short: e.target.value })} aria-describedby="rg-short-d" />
            <span className="zq-help" id="rg-short-d">
              {f.shortHelp}
            </span>
          </div>
          <div className="zq-field">
            <label htmlFor="rg-long">{f.longDescription}</label>
            <textarea id="rg-long" className="zq-textarea" rows={5} value={s.long} maxLength={4000} onChange={(e) => set({ long: e.target.value })} />
          </div>
          <div className="zq-field">
            <label htmlFor="rg-years">{f.years}</label>
            <input id="rg-years" className="zq-input" type="number" min={0} max={80} inputMode="numeric" value={s.years} onChange={(e) => set({ years: e.target.value })} />
          </div>
          <p className="pt-claim">{t.notices.claims}</p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="pt-sec">
          <h2>{r.addService}</h2>
          <div className="zq-field">
            <label htmlFor="rg-cat">{f.category}</label>
            <select id="rg-cat" className="zq-input" value={s.category} required onChange={(e) => set({ category: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {t.tracks[c.track]}: {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="rg-title">{f.title}</label>
            <input id="rg-title" className="zq-input" value={s.title} minLength={3} maxLength={140} required onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="pt-row">
            <div className="zq-field">
              <label htmlFor="rg-mode">{f.mode}</label>
              <select id="rg-mode" className="zq-input" value={s.mode} onChange={(e) => set({ mode: e.target.value })}>
                {SERVICE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {t.modes[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="rg-group">{f.groupType}</label>
              <select id="rg-group" className="zq-input" value={s.group} onChange={(e) => set({ group: e.target.value })}>
                {GROUP_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {t.groupTypes[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="rg-level">{f.level}</label>
              <select id="rg-level" className="zq-input" value={s.level} onChange={(e) => set({ level: e.target.value })}>
                {LEVELS.map((m) => (
                  <option key={m} value={m}>
                    {t.levels[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="rg-lang">{f.language}</label>
              <select id="rg-lang" className="zq-input" value={s.teachLang} onChange={(e) => set({ teachLang: e.target.value })}>
                {LANGUAGE_CODES.map((c) => (
                  <option key={c} value={c}>
                    {name(c, "language", locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-row">
            <div className="zq-field">
              <label htmlFor="rg-ptype">{f.pricingType}</label>
              <select id="rg-ptype" className="zq-input" value={s.pricingType} onChange={(e) => set({ pricingType: e.target.value as PricingType })}>
                {PRICING_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {t.pricing.types[p]}
                  </option>
                ))}
              </select>
            </div>
            {priced ? (
              <>
                <div className="zq-field">
                  <label htmlFor="rg-cur">{f.currency}</label>
                  <select id="rg-cur" className="zq-input" value={s.currency} onChange={(e) => set({ currency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="zq-field">
                  <label htmlFor="rg-amt">{f.amount}</label>
                  <input id="rg-amt" className="zq-input" type="number" min={0.01} step="0.01" inputMode="decimal" value={s.amount} required onChange={(e) => set({ amount: e.target.value })} />
                </div>
                {s.pricingType === "package" ? (
                  <div className="zq-field">
                    <label htmlFor="rg-cls">{f.classesIncluded}</label>
                    <input id="rg-cls" className="zq-input" type="number" min={2} inputMode="numeric" value={s.classes} required onChange={(e) => set({ classes: e.target.value })} />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="pt-claim">{t.pricing.statedBy}</p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="pt-sec">
          <p className="qa-notice">{r.contactLead}</p>
          <p className="zq-meta">{r.homeAddress}</p>
          {s.contacts.map((c, i) => (
            <div key={c.kind} className="pt-card">
              <div className="zq-field">
                <label htmlFor={`rg-c${i}`}>{t.contactKinds[c.kind]}</label>
                <input
                  id={`rg-c${i}`}
                  className="zq-input"
                  dir="ltr"
                  type={c.kind === "email" ? "email" : c.kind === "website" ? "url" : "tel"}
                  value={c.value}
                  maxLength={300}
                  onChange={(e) => set({ contacts: s.contacts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                />
              </div>
              <label className="pt-choice" htmlFor={`rg-p${i}`}>
                <input id={`rg-p${i}`} type="checkbox" checked={c.is_public} onChange={(e) => set({ contacts: s.contacts.map((x, j) => (j === i ? { ...x, is_public: e.target.checked } : x)) })} />
                <span>{f.isPublic}</span>
              </label>
            </div>
          ))}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="pt-sec">
          <p className="qa-notice">{r.reviewLead}</p>
          <dl className="pt-dl">
            <dt>{f.providerType}</dt>
            <dd>{t.providerTypes[s.type]}</dd>
            <dt>{f.displayName}</dt>
            <dd dir="auto">{s.displayName}</dd>
            <dt>{f.slug}</dt>
            <dd dir="ltr">/partners/{s.slug}</dd>
            <dt>{f.country}</dt>
            <dd>{[s.city, s.country && name(s.country, "region", locale)].filter(Boolean).join(", ")}</dd>
            <dt>{f.title}</dt>
            <dd dir="auto">{s.title}</dd>
            <dt>{f.pricingType}</dt>
            <dd>{t.pricing.types[s.pricingType]}</dd>
            <dt>{t.dashboard.contactsTitle}</dt>
            <dd>
              {contactRows.length
                ? contactRows.map((c) => `${t.contactKinds[c.kind]} (${c.is_public ? t.dashboard.contactPublic : t.dashboard.contactPrivate})`).join(", ")
                : t.none}
            </dd>
          </dl>
          <p className="pt-claim">{r.nothingShown}</p>
        </div>
      ) : null}

      <Feedback msg={msg} />
      <div className="pt-actions">
        {step > 0 ? (
          <button type="button" className="zq-btn" onClick={() => go(step - 1)} disabled={busy}>
            {t.back}
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.next}
          </button>
        ) : (
          <>
            <button type="submit" className="zq-btn zq-btn-primary" disabled={busy}>
              {busy ? r.working : r.submit}
            </button>
            <button type="button" className="zq-btn" disabled={busy} onClick={() => void finish(false)}>
              {r.saveDraft}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
