import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";

export const metadata = infoMetadata("about");

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <InfoPageView params={params} slug="about" />;
}
