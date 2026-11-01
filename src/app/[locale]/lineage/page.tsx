import type { Metadata } from "next";
import { LineagePage, lineageMetadata, type LineageParams } from "@/components/lineage/LineagePage";

/** /lineage: the same view as /genealogy?view=lineage (Lineage of Humanity, from Adam to Muhammad). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return lineageMetadata((await params).locale);
}

export default async function LineageRoute({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<LineageParams> }) {
  const { locale } = await params;
  return <LineagePage locale={locale} params={await searchParams} />;
}
