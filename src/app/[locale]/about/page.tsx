import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";

export const generateMetadata = infoMetadata("about");

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <InfoPageView params={params} slug="about" />;
}
