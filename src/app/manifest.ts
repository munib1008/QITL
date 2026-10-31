import type { MetadataRoute } from "next";
import { BRAND_FULL } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_FULL,
    short_name: "QITL",
    start_url: "/",
    display: "standalone",
    background_color: "#061519",
    theme_color: "#061519",
    icons: [
      { src: "/brand/qitl-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/qitl-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
