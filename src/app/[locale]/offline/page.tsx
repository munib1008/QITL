import Link from "next/link";

export const metadata = { title: "Offline", robots: { index: false } };

/** Shown when the network is unavailable (the service worker serves this page as its fallback). */
export default function Offline() {
  return (
    <main className="pp-wrap" id="main">
      <div className="zq-status-page">
        <p className="zq-eyebrow">Offline</p>
        <h1>You are offline.</h1>
        <p className="zq-meta">Pages you opened before may still be available. Reconnect to read the rest.</p>
        <p>
          <Link href="/">Try again</Link>
        </p>
      </div>
    </main>
  );
}
