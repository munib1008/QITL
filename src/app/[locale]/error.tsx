"use client";

import Link from "next/link";
import { useEffect } from "react";

/** 500: says what failed and offers a retry. No stack traces or internals are shown. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ziq] page error", error.digest ?? "");
  }, [error]);
  return (
    <main className="pp-wrap" id="main">
      <div className="zq-status-page">
        <p className="zq-eyebrow">500</p>
        <h1>Something went wrong on our side.</h1>
        <p className="zq-meta">The page could not be loaded. Try again; if it keeps failing, the rest of ZIQ still works.</p>
        {error.digest ? <p className="zq-order">Reference: {error.digest}</p> : null}
        <p style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button type="button" className="zq-btn zq-btn-primary" onClick={reset}>
            Try again
          </button>
          <Link className="zq-btn zq-btn-secondary zq-btn-link" href="/">
            Home
          </Link>
        </p>
      </div>
    </main>
  );
}
