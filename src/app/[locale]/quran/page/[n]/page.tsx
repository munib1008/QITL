import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DivisionView } from "@/components/quran/DivisionView";
import { DIVISION_COUNT } from "@/lib/quran-division-range";
import { quranDivisionStrings } from "@/lib/i18n/modules/quranDivision";

const num = (s: string) => (/^[1-9][0-9]{0,2}$/.test(s) ? Number(s) : NaN);

export async function generateMetadata({ params }: { params: Promise<{ locale: string; n: string }> }): Promise<Metadata> {
  const { locale, n } = await params;
  return { title: quranDivisionStrings(locale).pageTitle(num(n)) };
}

/** One mushaf page (1-604) of the imported reading divisions. */
export default async function QuranPage({ params }: { params: Promise<{ locale: string; n: string }> }) {
  const { locale, n } = await params;
  const v = num(n);
  if (!Number.isInteger(v) || v < 1 || v > DIVISION_COUNT.page) notFound();
  return <DivisionView kind="page" n={v} locale={locale} />;
}
