"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analyticsUrl, track } from "@/lib/observability/analytics";

/** Page views for the optional, privacy-safe analytics (src/lib/observability/analytics.ts). Renders nothing. */
export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (analyticsUrl() && pathname) track("pageview", { path: pathname });
  }, [pathname]);
  return null;
}
