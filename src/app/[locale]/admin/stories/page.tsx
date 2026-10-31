import Link from "next/link";
import { ChapterManager } from "@/components/admin/ChapterManager";
import { RereviewQueue } from "@/components/admin/RereviewQueue";
import { StoryComposer } from "@/components/admin/tools";
import { adminStrings } from "@/lib/i18n/modules/admin";

export default async function StoriesAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const a = adminStrings((await params).locale).pages["stories"]!;
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>{a.title}</h1>
      <p className="zq-meta">
        How much of each story is drafted, reviewed and published, from the records themselves: <Link href="/admin/stories/coverage">story coverage and checks</Link>.
      </p>
      <RereviewQueue />
      <StoryComposer />
      <ChapterManager />
    </div>
  );
}
