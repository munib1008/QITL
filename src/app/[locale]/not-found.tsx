import Link from "next/link";
import { ReadingHeader, SiteFooter } from "@/components/shell/SiteHeader";
import { Rosette } from "@/components/ui/icons";
import { SearchField } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <div className="pp">
      <ReadingHeader locale="en" />
      <main className="pp-wrap" id="main">
        <div className="zq-status-page">
          <Rosette points={8} className="pp-mark" />
          <p className="zq-eyebrow">404</p>
          <h1>This page is not here.</h1>
          <p className="zq-meta">It may have moved, or the address may be mistyped. Nothing on ZIQ is removed without a revision note.</p>
          <SearchField id="nf-q" maxWidth={480} />
          <p>
            <Link href="/">Home</Link> · <Link href="/prophets">Prophets</Link> · <Link href="/quran">Quran</Link>
          </p>
        </div>
      </main>
      <SiteFooter locale="en" />
    </div>
  );
}
