"use client";

import { useEffect, useState } from "react";
import { asmaStrings } from "@/lib/i18n/modules/asma";

const KEY = "qitl.asma.dua.v1";

/**
 * A place to write your own words. They are stored in this browser only, are labelled as the reader's own, and are never
 * offered as a quoted verse or a Prophetic dua. Nothing is generated and nothing is sent anywhere.
 */
export function DuaComposer({ locale }: { locale: string }) {
  const s = asmaStrings(locale).dua;
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setText(v.slice(0, 2000));
    } catch {
      /* storage blocked: the field simply starts empty */
    }
  }, []);
  const save = () => {
    try {
      localStorage.setItem(KEY, text.slice(0, 2000));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  return (
    <section aria-labelledby="as-compose-h" className="as-section" data-testid="dua-composer">
      <h2 id="as-compose-h">{s.composerHeading}</h2>
      <p className="as-note">{s.composerLead}</p>
      <div className="as-field">
        <label htmlFor="as-compose">{s.composerLabel}</label>
        <textarea id="as-compose" className="as-textarea" value={text} maxLength={2000} placeholder={s.composerPlaceholder} onChange={(e) => { setText(e.target.value); setSaved(false); }} />
      </div>
      <p className="as-stamp" data-testid="composer-stamp">
        {s.composerLabelStamp}
      </p>
      <div className="as-actions">
        <button type="button" className="zq-btn zq-btn-secondary" onClick={save}>
          {s.save}
        </button>
        <button type="button" className="zq-btn zq-btn-quiet" onClick={() => { setText(""); setSaved(false); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }}>
          {s.clear}
        </button>
      </div>
      <p className="as-note" role="status">
        {saved ? s.savedHint : ""}
      </p>
    </section>
  );
}
