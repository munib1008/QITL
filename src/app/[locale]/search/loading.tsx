import { LoadingScreen } from "@/components/shell/LoadingScreen";

/** The QITL loading screen while this page streams in (only on routes that never answer 404). */
export default function Loading() {
  return <LoadingScreen />;
}
