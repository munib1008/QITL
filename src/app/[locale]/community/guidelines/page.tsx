import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";
import { getDict } from "@/lib/i18n";
import { uiStrings } from "@/lib/i18n/modules/ui";

export const generateMetadata = infoMetadata("guidelines");

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { t } = getDict(locale);
  return <InfoPageView params={params} slug="guidelines" crumbs={[{ href: "/community", label: t.nav.community }, { label: uiStrings(locale).info.guidelines.title }]} />;
}
