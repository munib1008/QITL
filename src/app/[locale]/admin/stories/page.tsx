import Link from "next/link";
import { ChapterManager } from "@/components/admin/ChapterManager";
import { RereviewQueue } from "@/components/admin/RereviewQueue";
import { StoryComposer } from "@/components/admin/tools";
import { adminStrings } from "@/lib/i18n/modules/admin";
import { adminChapterStrings } from "@/lib/i18n/modules/adminChapter";

export default async function StoriesAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const a = adminStrings(locale).pages["stories"]!;
  const t = adminChapterStrings(locale);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <p className="zq-meta">
        {t.pageLeadA} <Link href="/admin/stories/coverage">{t.pageLeadLink}</Link>.
      </p>
      <RereviewQueue />
      <StoryComposer />
      <ChapterManager />
    </div>
  );
}
