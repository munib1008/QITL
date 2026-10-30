import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";

export const metadata = infoMetadata("guidelines");

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <InfoPageView params={params} slug="guidelines" crumbs={[{ href: "/community", label: "Community" }, { label: "Guidelines" }]} />;
}
