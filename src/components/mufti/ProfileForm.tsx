"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { MADHHABS } from "@/lib/mufti";
import { apiCall, Feedback, type Msg } from "./api";

export interface OwnProfile {
  display_name: string;
  madhhab: string | null;
  credentials_md: string;
  verified_at: string | null;
  dream_qualified_at: string | null;
}

/** Create or edit one's own mufti profile while it is unverified. Verification is an administrator's act. */
export function ProfileForm({ profile, locale }: { profile: OwnProfile | null; locale: string }) {
  const t = muftiT(locale);
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const locked = Boolean(profile?.verified_at);
  return (
    <form
      className="qa-card qa-sec"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setMsg(null);
        try {
          await apiCall("/api/mufti/profile", "POST", {
            displayName: String(f.get("displayName") ?? ""),
            madhhab: String(f.get("madhhab") ?? "") || null,
            credentials: String(f.get("credentials") ?? ""),
          });
          setMsg({ tone: "ok", text: t.composer.saved });
          router.refresh();
        } catch (err) {
          setMsg({ tone: "err", text: (err as Error).message });
        }
      }}
    >
      <h2>{t.workspace.profile}</h2>
      {profile ? <p className="zq-meta">{profile.verified_at ? t.workspace.profileVerified : t.workspace.profilePending}</p> : null}
      <fieldset disabled={locked} className="qa-choices">
        <div className="zq-field">
          <label htmlFor="mp-name">{t.workspace.displayName}</label>
          <input id="mp-name" name="displayName" className="zq-input" required minLength={2} maxLength={120} defaultValue={profile?.display_name ?? ""} />
        </div>
        <div className="zq-field">
          <label htmlFor="mp-madhhab">{t.workspace.madhhab}</label>
          <select id="mp-madhhab" name="madhhab" className="zq-input" defaultValue={profile?.madhhab ?? ""}>
            {["", ...MADHHABS].map((m) => (
              <option key={m} value={m}>
                {t.workspace.madhhabs[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="mp-cred">{t.workspace.credentials}</label>
          <textarea id="mp-cred" name="credentials" className="zq-textarea" required minLength={20} maxLength={5000} defaultValue={profile?.credentials_md ?? ""} aria-describedby="mp-cred-d" />
          <span className="zq-help" id="mp-cred-d">
            {t.workspace.credentialsHelp}
          </span>
        </div>
      </fieldset>
      <Feedback msg={msg} />
      {locked ? null : (
        <div className="qa-actions">
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.workspace.saveProfile}
          </button>
        </div>
      )}
    </form>
  );
}
