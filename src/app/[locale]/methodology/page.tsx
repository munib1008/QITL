import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";

export const metadata = infoMetadata("methodology");

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <InfoPageView params={params} slug="methodology" />;
}
