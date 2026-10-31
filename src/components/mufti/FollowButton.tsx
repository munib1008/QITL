"use client";

import { useState } from "react";
import { muftiT } from "@/lib/i18n/modules/mufti";
import { apiCall, Feedback, type Msg } from "./api";

export function FollowButton({ questionId, initial, locale }: { questionId: string; initial: boolean; locale: string }) {
  const t = muftiT(locale);
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="qa-actions">
      <button
        type="button"
        className="zq-btn zq-btn-secondary"
        aria-pressed={following}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await apiCall("/api/mufti/follows", "POST", { questionId, follow: !following });
            setFollowing(!following);
          } catch (e) {
            setMsg({ tone: "err", text: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {following ? t.question.unfollow : t.question.follow}
      </button>
      {following ? <span className="zq-meta">{t.question.following}</span> : null}
      <Feedback msg={msg} />
    </div>
  );
}
