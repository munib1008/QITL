"use client";

import { useEffect, useState } from "react";

interface Recording {
  id: string;
  riwayah_id: string;
  url: string;
  reciter: string;
  attribution: string | null;
}

/**
 * Audio for the reader's riwayah. It starts as the plain statement and shows controls only when the API returns an
 * approved recording of exactly this riwayah (RLS and the database's permission check decide which ones exist).
 */
export function RiwayahAudio({ riwayah, surah, labels }: { riwayah: string; surah: number; labels: { none: string; title: string; reciter: string } }) {
  const [recs, setRecs] = useState<Recording[]>([]);
  useEffect(() => {
    let live = true;
    fetch(`/api/qiraat/recordings?riwayah=${encodeURIComponent(riwayah)}&surah=${surah}`)
      .then((r) => (r.ok ? r.json() : { recordings: [] }))
      .then((d: { recordings?: Recording[] }) => {
        if (live) setRecs((d.recordings ?? []).filter((x) => x.riwayah_id === riwayah && /^https:\/\//.test(x.url)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [riwayah, surah]);
  if (!recs.length)
    return (
      <p className="qr-audio" data-testid="riwayah-audio-none">
        {labels.none}
      </p>
    );
  return (
    <div className="qr-audio" data-testid="riwayah-audio">
      {recs.map((r) => (
        <figure key={r.id} style={{ margin: 0 }}>
          <figcaption>
            {labels.title} · {labels.reciter}: {r.reciter}
            {r.attribution ? ` · ${r.attribution}` : ""}
          </figcaption>
          <audio controls preload="none" src={r.url} />
        </figure>
      ))}
    </div>
  );
}
