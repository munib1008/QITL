import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { getPublicSupabase } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/dict";
import type { PublicMediaRow } from "@/lib/media/render";
import { MediaFigure } from "./MediaFigure";

/**
 * A Media Library image (or short video clip: it renders a player for a published WebM/MP4 asset) for public pages. It reads the media_public view, which holds only published assets with an
 * active file outside pending/ and a licence that allows display (rechecked on every read, so a revoked licence hides
 * the image). Anything else renders the fallback (by default nothing): never a placeholder pretending to be the image.
 */
export async function MediaImage({
  assetId,
  locale,
  sizes,
  priority,
  className,
  hideCaption,
  fallback = null,
}: {
  assetId: string;
  locale: Locale;
  sizes?: string;
  priority?: boolean;
  className?: string;
  hideCaption?: boolean;
  fallback?: ReactNode;
}) {
  const sb = getPublicSupabase();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(assetId)) return <>{fallback}</>;
  const { data, error } = await sb.from("media_public").select("*").eq("id", assetId).maybeSingle();
  if (error || !data) return <>{fallback}</>;
  return (
    <MediaFigure
      row={data as PublicMediaRow}
      locale={locale}
      supabaseUrl={publicEnv.supabaseUrl}
      sizes={sizes}
      priority={priority}
      className={className}
      hideCaption={hideCaption}
      fallback={fallback}
    />
  );
}
