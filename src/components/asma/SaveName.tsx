"use client";

import { useEffect, useState } from "react";
import { asmaStrings } from "@/lib/i18n/modules/asma";
import { parseState, STUDY_KEY } from "@/lib/asma/learn";

/** Saves a Name on this device only (the same on-device study state the learning studio reads). */
export function SaveName({ slug, locale }: { slug: string; locale: string }) {
  const s = asmaStrings(locale).name;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      setSaved(parseState(localStorage.getItem(STUDY_KEY)).saved.includes(slug));
    } catch {
      setSaved(false);
    }
  }, [slug]);
  const toggle = () => {
    try {
      const st = parseState(localStorage.getItem(STUDY_KEY));
      st.saved = saved ? st.saved.filter((x) => x !== slug) : [...new Set([...st.saved, slug])];
      localStorage.setItem(STUDY_KEY, JSON.stringify(st));
    } catch {
      /* storage may be blocked: the button then only changes for this visit */
    }
    setSaved(!saved);
  };
  return (
    <button type="button" className="zq-btn zq-btn-secondary" aria-pressed={saved} onClick={toggle} data-testid="save-name">
      {saved ? s.unsave : s.saveName}
      {saved ? <span className="zq-meta"> · {s.saved}</span> : null}
    </button>
  );
}
