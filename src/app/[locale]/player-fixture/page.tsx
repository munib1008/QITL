import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingPage } from "@/components/shell/ReadingPage";
import { StoryPlayerSection } from "@/components/player/StoryPlayerSection";
import { DemoTag } from "@/components/ui/evidence";
import { fixtureBundle } from "@/lib/player/fixture";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Player test fixture", robots: { index: false, follow: false } };

/**
 * Automated-test harness for the Story Player. It exists only when QITL_E2E_FIXTURES=1 (set by playwright.config.ts
 * for its own server); everywhere else it is a 404. Placeholder text only, tagged DEMO.
 */
export default async function PlayerFixturePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ audio?: string }> }) {
  if (process.env.QITL_E2E_FIXTURES !== "1") notFound();
  const { locale } = await params;
  const { audio } = await searchParams;
  return (
    <ReadingPage locale={locale} crumbs={[{ label: "Player test fixture" }]} title="Player test fixture">
      <div className="zq-pagebody">
        <p>
          <DemoTag /> Test fixture with placeholder text. Not a story.
        </p>
        <StoryPlayerSection bundle={fixtureBundle({ audio: audio !== "0" })} locale={locale} />
      </div>
    </ReadingPage>
  );
}
