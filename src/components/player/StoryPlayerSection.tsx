import { StoryPlayer } from "./StoryPlayer";
import { getPlayerStrings } from "@/lib/i18n/modules/player";
import type { PlayerBundle } from "@/lib/player/types";

/** The player as a page section. Rendered only when a published script exists. */
export function StoryPlayerSection({ bundle, locale, id = "story-player" }: { bundle: PlayerBundle; locale: string; id?: string }) {
  const t = getPlayerStrings(locale).player;
  return (
    <section className="pp-sec" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{t.region}</h2>
      <StoryPlayer bundle={bundle} locale={locale} />
    </section>
  );
}
