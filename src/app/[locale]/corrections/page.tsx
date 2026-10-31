import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";

export const generateMetadata = infoMetadata("corrections");

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <InfoPageView params={params} slug="corrections" />;
}
