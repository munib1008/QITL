"use client";

import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { apiCall, Feedback, type Msg } from "./api";

/**
 * Add one citation: a Quran reference, a hadith record id, or a scholarly work with its locator. Used by the mufti
 * answer composer and the dream response composer (they post to different endpoints with the same schema).
 */
export function CitationForm({ endpoint, locale, onAdded, idPrefix }: { endpoint: string; locale: string; onAdded: () => void; idPrefix: string }) {
  const t = muftiT(locale);
  const [kind, setKind] = useState<"quran" | "hadith" | "scholar">("quran");
  const [msg, setMsg] = useState<Msg>(null);
  const id = (s: string) => `${idPrefix}-${s}`;
  return (
    <form
      className="qa-sec"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const s = (k: string) => String(f.get(k) ?? "").trim();
        const note = s("note");
        const body =
          kind === "quran"
            ? { kind, surah: s("surah"), ayahFrom: s("ayahFrom"), ...(s("ayahTo") ? { ayahTo: s("ayahTo") } : {}) }
            : kind === "hadith"
              ? { kind, hadithId: s("hadithId") }
              : { kind, work: s("work"), ...(s("locator") ? { locator: s("locator") } : {}) };
        setMsg(null);
        try {
          await apiCall(endpoint, "POST", { ...body, ...(note ? { note } : {}) });
          form.reset();
          setMsg({ tone: "ok", text: t.composer.saved });
          onAdded();
        } catch (err) {
          setMsg({ tone: "err", text: (err as Error).message });
        }
      }}
    >
      <h3>{t.composer.addCitation}</h3>
      <div className="zq-field">
        <label htmlFor={id("kind")}>{t.composer.kind}</label>
        <select id={id("kind")} className="zq-input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="quran">{t.cite.quran}</option>
          <option value="hadith">{t.cite.hadith}</option>
          <option value="scholar">{t.cite.scholar}</option>
        </select>
      </div>
      {kind === "quran" ? (
        <div className="qa-actions" style={{ alignItems: "flex-end" }}>
          <div className="zq-field" style={{ flex: "1 1 90px" }}>
            <label htmlFor={id("surah")}>{t.composer.surah}</label>
            <input id={id("surah")} name="surah" type="number" min={1} max={114} required className="zq-input" dir="ltr" />
          </div>
          <div className="zq-field" style={{ flex: "1 1 90px" }}>
            <label htmlFor={id("from")}>{t.composer.ayahFrom}</label>
            <input id={id("from")} name="ayahFrom" type="number" min={1} max={286} required className="zq-input" dir="ltr" />
          </div>
          <div className="zq-field" style={{ flex: "1 1 90px" }}>
            <label htmlFor={id("to")}>{t.composer.ayahTo}</label>
            <input id={id("to")} name="ayahTo" type="number" min={1} max={286} className="zq-input" dir="ltr" />
          </div>
        </div>
      ) : kind === "hadith" ? (
        <div className="zq-field">
          <label htmlFor={id("hadith")}>{t.composer.hadithId}</label>
          <input id={id("hadith")} name="hadithId" required className="zq-input" dir="ltr" pattern="[0-9a-fA-F-]{36}" aria-describedby={id("hadith-d")} />
          <span className="zq-help" id={id("hadith-d")}>
            {t.composer.hadithIdHelp}
          </span>
        </div>
      ) : (
        <>
          <div className="zq-field">
            <label htmlFor={id("work")}>{t.composer.work}</label>
            <input id={id("work")} name="work" required minLength={2} maxLength={300} className="zq-input" />
          </div>
          <div className="zq-field">
            <label htmlFor={id("locator")}>{t.composer.locator}</label>
            <input id={id("locator")} name="locator" maxLength={200} className="zq-input" />
          </div>
        </>
      )}
      <div className="zq-field">
        <label htmlFor={id("note")}>{t.composer.note}</label>
        <input id={id("note")} name="note" maxLength={500} className="zq-input" />
      </div>
      <Feedback msg={msg} />
      <div className="qa-actions">
        <button type="submit" className="zq-btn zq-btn-secondary">
          {t.composer.addCitation}
        </button>
      </div>
    </form>
  );
}
