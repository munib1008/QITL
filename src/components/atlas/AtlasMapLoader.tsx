"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

/** Lazy-loads MapLibre (and its CSS) so the map never weighs on pages that don't show it. */
export const AtlasMapLoader = dynamic(
  async () => {
    await import("maplibre-gl/dist/maplibre-gl.css");
    return (await import("./AtlasMap")).AtlasMap;
  },
  { ssr: false, loading: () => <Skeleton height={420} /> },
);
