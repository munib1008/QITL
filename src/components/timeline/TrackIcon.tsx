import { TRACK_SHAPE, type TrackId } from "@/lib/events/tracks";

/**
 * One non-figurative mark per track, drawn on a 16px grid in the track colour (currentColor). The shape carries the
 * meaning with the colour, so a track is never told apart by colour alone.
 */
export function TrackIcon({ track, size = 18 }: { track: TrackId; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  let shape;
  switch (TRACK_SHAPE[track]) {
    case "star": // eight-pointed star: two squares
      shape = (
        <>
          <rect x={3.5} y={3.5} width={9} height={9} {...common} />
          <rect x={3.5} y={3.5} width={9} height={9} transform="rotate(45 8 8)" {...common} />
        </>
      );
      break;
    case "rings": // two linked rings
      shape = (
        <>
          <circle cx={5.8} cy={8} r={3.8} {...common} />
          <circle cx={10.2} cy={8} r={3.8} {...common} />
        </>
      );
      break;
    case "triad": // three dots in a triangle
      shape = (
        <>
          <circle cx={8} cy={4.2} r={2.1} fill="currentColor" />
          <circle cx={4.4} cy={11} r={2.1} fill="currentColor" />
          <circle cx={11.6} cy={11} r={2.1} fill="currentColor" />
        </>
      );
      break;
    case "diamond":
      shape = <path d="M8 1.8 14.2 8 8 14.2 1.8 8z" {...common} fill="currentColor" fillOpacity={0.18} />;
      break;
    case "spiral":
      shape = <path d="M8 8.2c0-1 1.6-1 1.6.2 0 1.8-3.2 1.8-3.2-.6 0-2.8 4.8-2.8 4.8.8 0 3.6-6.4 3.6-6.4-1" {...common} />;
      break;
    case "scroll":
      shape = (
        <>
          <path d="M4 2.8h8v10.4H4z" {...common} />
          <path d="M6 6h4M6 8.2h4M6 10.4h2.4" {...common} />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false" className="tl-icon">
      {shape}
    </svg>
  );
}

/**
 * A raised tile with a bevelled mark in the track colour: the depth version of TrackIcon for filters and cards.
 * Decorative (aria-hidden): the track name always sits beside it.
 */
export function TrackBadge({ track, size = "md" }: { track: TrackId; size?: "md" | "lg" }) {
  return (
    <span className={size === "lg" ? "tl-badge tl-badge-lg" : "tl-badge"} data-shape={TRACK_SHAPE[track]} data-track={track} aria-hidden="true">
      <span className="tl-badge-g">
        <span className="tl-badge-s" />
      </span>
    </span>
  );
}
