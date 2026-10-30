import { ImageResponse } from "next/og";

export const alt = "QITL — The Islamic Knowledge Atlas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Geometric Open Graph card: an eight-point star and the name. No figures. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#061519", color: "#f2f8f4", gap: 28 }}>
        <svg width="140" height="140" viewBox="0 0 16 16">
          <rect x="3" y="3" width="10" height="10" fill="none" stroke="#e6c88d" strokeWidth="0.5" />
          <rect x="3" y="3" width="10" height="10" fill="none" stroke="#e6c88d" strokeWidth="0.5" transform="rotate(45 8 8)" />
        </svg>
        <div style={{ fontSize: 96, letterSpacing: 24, fontWeight: 600 }}>QITL</div>
        <div style={{ fontSize: 36, color: "#98b7b0" }}>Explore the story. Follow the evidence.</div>
      </div>
    ),
    size,
  );
}
