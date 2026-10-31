import Image from "next/image";
import { BRAND_FULL, BRAND_TAGLINE } from "@/lib/brand";

/**
 * The QITL lockup: the approved emblem (raster, from brand/source) beside a live-text wordmark. Text stays sharp at
 * every size, follows the theme and can be localised; the raster wordmark in public/brand/qitl-logo*.png is kept for
 * large uses (social card, print). "auto" shows the green emblem on light surfaces and the ivory one on dark ones.
 */
export function Logo({
  height = 44,
  tone = "auto",
  priority = false,
  tagline = BRAND_TAGLINE,
}: {
  height?: number;
  tone?: "auto" | "dark" | "light";
  priority?: boolean;
  tagline?: string;
}) {
  const w = Math.round(height * 0.89);
  const common = { width: w, height, priority, sizes: `${w}px`, alt: BRAND_FULL } as const;
  return (
    <span className={`qitl-logo qitl-logo-${tone}`} style={{ ["--logo-h" as string]: `${height}px` }}>
      <span className="qitl-logo-mark">
        {tone !== "dark" ? <Image className="qitl-logo-on-light" src="/brand/qitl-mark.webp" {...common} alt={common.alt} /> : null}
        {tone !== "light" ? <Image className="qitl-logo-on-dark" src="/brand/qitl-mark-dark.webp" {...common} alt={common.alt} /> : null}
      </span>
      <span className="qitl-word" aria-hidden="true">
        <b>QITL</b>
        <small>{tagline}</small>
      </span>
    </span>
  );
}

/** The compact emblem (no lettering), for small spaces. Decorative unless a label is given. */
export function Mark({ size = 32, tone = "light", label }: { size?: number; tone?: "light" | "dark"; label?: string }) {
  return (
    <Image
      src={tone === "dark" ? "/brand/qitl-mark-dark.webp" : "/brand/qitl-mark.webp"}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={Math.round(size * 0.89)}
      height={size}
    />
  );
}
