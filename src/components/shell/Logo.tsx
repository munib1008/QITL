import Image from "next/image";

/**
 * The approved QITL logo. "auto" shows the green artwork on light surfaces and the ivory variant on dark ones
 * (dark theme, or the journey's dark ground); the two images swap with CSS, so the right one paints first.
 */
export function Logo({ height = 44, tone = "auto", priority = false }: { height?: number; tone?: "auto" | "dark" | "light"; priority?: boolean }) {
  const width = Math.round(height * 2.05);
  const common = { width, height, priority, sizes: `${width}px` } as const;
  return (
    <span className={`qitl-logo qitl-logo-${tone}`} style={{ height }}>
      {tone !== "dark" ? <Image className="qitl-logo-on-light" src="/brand/qitl-logo.webp" alt="QITL — Quran in Timeline" {...common} /> : null}
      {tone !== "light" ? <Image className="qitl-logo-on-dark" src="/brand/qitl-logo-dark.webp" alt="QITL — Quran in Timeline" {...common} /> : null}
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
