import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/account", "/sign-in", "/search", "/auth/"] }],
    sitemap: `${publicEnv.siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
