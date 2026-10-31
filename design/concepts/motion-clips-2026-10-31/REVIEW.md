# Motion clips (2026-10-31): review

**Status: concepts. Nothing here is on the site.** The source was four zip packs of animated GIFs (`qitl-realistic-motion-gifs-v2`,
`qitl-cinematic-gifs`, `qitl-ark-rocking-gif`, `qitl-parted-sea-motion-gif`; about 195 MB, 10–17 MB per GIF). Only the latest
set (v2: five scenes, 960×540, 36 frames, 100 ms, infinite loop) is kept here, converted to VP9 WebM (0.2–0.6 MB each, 2.2 MB
in all). The earlier GIF packs show the same scenes with fewer frames, plus a separate rocking-ark and a moving-water-walls
variant; they are superseded by v2 and were not copied.

## Why WebM, not GIF
- **Size:** a 10–17 MB GIF per scene is not loadable on a phone connection; the same clip is 0.2–0.6 MB.
- **Control:** a GIF cannot be paused, replayed or stopped for `prefers-reduced-motion`. A `<video muted loop playsinline>` can,
  and the existing player pattern (`src/components/story/AnimationPlayer.tsx`: pause/replay, no autoplay under reduced motion,
  a still poster) applies. Use the still image as the poster.
- **Accessibility:** motion is slow camera drift, rain and shimmer, not flashing; the ark clip has lightning pulses, so it must
  respect reduced motion and offer a gentle mode for Kids stories (no flashes).

## Content review (same as the stills; see `../realistic-scenes-2026-10-31/REVIEW.md`)
| Clip | Verdict |
|---|---|
| `nuh-ark-storm.webm` | Usable after review. Ship, rain, waves: supported (54:11–13). Lightning pulses are artistic; hull size and shape are not described in the sources. Not for Kids mode as is (lightning flashes). |
| `parted-sea-dawn.webm` | Usable after review. Water walls and a dry path (26:63, 20:77). No place named. |
| `cave-at-dawn.webm` | Needs changes before use for the People of the Cave: the woven blanket and oil lamp are invented details. Regenerate or edit without them. |
| `ancient-desert-oasis.webm` | Reconstruction-style (class D), generic; never tied to a prophet or place. |
| `ancient-agriculture.webm` | Reconstruction-style (class D); not evidence about any prophet's community. |

No people, faces, animals, angels, jinn or unseen beings appear in any frame I checked (contact sheet and stills). The packs'
own statement of this policy is a claim by the generator; the non-figurative confirmation at `/admin/media` is a human check.

## To publish
Videos are not yet supported by the Media Library (images only: png, jpeg, webp, svg, gif). Adding WebM/MP4 needs: allowed types
in the upload route and the `asset_files` / `assets` mime checks, a video-aware scanner pass, size limits, a required poster
image and a required text alternative, and a `<MediaVideo>` component with pause/replay. Until then these stay in design/.
Record the image generator's terms in the licence registry first.
