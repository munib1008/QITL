"use client";

import Link from "next/link";
import { useEffect } from "react";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";

/** 500: says what failed and offers a retry. No stack traces or internals are shown. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const u = uiStrings(useLocale());
  useEffect(() => {
    console.error("[qitl] page error", error.digest ?? "");
  }, [error]);
  return (
    <main className="pp-wrap" id="main">
      <div className="zq-status-page">
        <p className="zq-eyebrow">500</p>
        <h1>{u.errors.serverTitle}</h1>
        <p className="zq-meta">{u.errors.serverBody}</p>
        {error.digest ? (
          <p className="zq-order">
            {u.errors.reference} <span dir="ltr">{error.digest}</span>
          </p>
        ) : null}
        <p style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button type="button" className="zq-btn zq-btn-primary" onClick={reset}>
            {u.errors.retry}
          </button>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/">
            {u.shell.home}
          </Link>
        </p>
      </div>
    </main>
  );
}
