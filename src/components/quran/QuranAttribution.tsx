import type { QuranManifest } from "@/content/quran";

/**
 * Required wherever the imported Arabic appears: the source is named, its licence stated and tanzil.net linked so
 * readers can track changes (Tanzil text licence, CC BY 3.0, verbatim use only).
 */
export function QuranAttribution({ src, className = "zq-meta" }: { src: Pick<QuranManifest, "source" | "version"> | null; className?: string }) {
  if (!src) return null;
  return (
    // The licence attribution stays in English, as published by the source, in every interface language.
    <p className={className} data-quran-attribution lang="en" dir="ltr">
      Arabic text: {src.source}, version {src.version.replace(/^Uthmani\s*/, "")}, from the{" "}
      <a href="https://tanzil.net/" rel="noopener" target="_blank">
        Tanzil Project
      </a>{" "}
      (© 2007–2026 Tanzil Project, <a href="https://creativecommons.org/licenses/by/3.0/" rel="noopener license" target="_blank">CC BY 3.0</a>), reproduced
      verbatim and never edited. <a href="https://tanzil.net/updates/" rel="noopener" target="_blank">Check for updates</a>.
    </p>
  );
}
