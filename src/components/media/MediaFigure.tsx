"use client";

import Image, { type ImageLoader } from "next/image";
import type { ReactNode } from "react";
import { dirOf } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n/dict";
import { altFor, captionFor, creditLine, pickVariant, variantUrls, type PublicMediaRow } from "@/lib/media/render";

export interface MediaFigureProps {
  row: PublicMediaRow;
  locale: Locale;
  supabaseUrl: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Hide the caption (the credit line is always shown). */
  hideCaption?: boolean;
  fallback?: ReactNode;
}

/**
 * The rendering half of <MediaImage>: next/image over the WebP renditions (the loader picks the nearest one, so no
 * image optimiser or remote pattern is involved), alt text in the reader's language and a visible credit line.
 */
export function MediaFigure({ row, locale, supabaseUrl, sizes = "(min-width: 1024px) 720px, 100vw", priority, className, hideCaption, fallback = null }: MediaFigureProps) {
  const variants = variantUrls(supabaseUrl, row);
  const largest = variants[variants.length - 1];
  if (!largest) return <>{fallback}</>;
  const loader: ImageLoader = ({ width }) => pickVariant(variants, width)!.url;
  const alt = altFor(row, locale);
  const caption = hideCaption ? null : captionFor(row, locale);
  return (
    <figure className={className ?? "zq-media"} data-testid="media-image" style={{ margin: 0, display: "grid", gap: 6 }}>
      <Image
        loader={loader}
        src={largest.url}
        width={largest.w}
        height={largest.h}
        alt={alt.text}
        lang={alt.lang}
        sizes={sizes}
        priority={priority}
        style={{ width: "100%", height: "auto", borderRadius: "var(--radius-md, 8px)" }}
      />
      <figcaption style={{ display: "grid", gap: 2 }}>
        {caption ? (
          <span lang={caption.lang} dir={dirOf(caption.lang)}>
            {caption.text}
          </span>
        ) : null}
        <small className="zq-meta" data-testid="media-credit">
          {creditLine(row)}
        </small>
      </figcaption>
    </figure>
  );
}
