import { InfoPageView, infoMetadata } from "@/components/shell/InfoPageView";

export const generateMetadata = infoMetadata("review-board");

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <InfoPageView params={params} slug="review-board" />;
}
