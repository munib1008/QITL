# Visual concept pack (2026-10-31): editorial review register

**Status: concepts only. Nothing in this folder is used by the site.** These are AI-generated illustrations, cropped from one
contact sheet (see `PACK_README.md` and `manifest.json`). A file reaches readers only by being uploaded as an asset, attached to
a story through `story_media` / `scene_visual_assets` / `creation_visual_assets`, and approved by a scholarly reviewer
(`approved_by` is required to publish). `tests/unit/concepts.test.ts` fails if any app code or public file points into this folder.

The rules applied here are the project's own: no depiction of prophets, angels, jinn or the unseen (which includes Jannah and
Jahannam); no detail the Quran or the selected authentic hadith do not support presented as fact; no frightening punishment
imagery for children; every visual labelled as an illustration.

## Technical issues across the pack

- **Crops from a contact sheet.** Every `*-wide.png` and every GIF has the sheet's "GIF" badge baked into the top-left corner;
  several icons and `qitl-square-logo.png` include slivers of the neighbouring tile; `nature-water-wide.png` has a red stripe on
  its right edge. Re-export each image on its own before use.
- **Resolution.** Story covers are 720 px wide; the hero banner is 547×253 and the logos are about 215–425 px with the wordmark
  baked into a raster. None is sharp enough for a hero or a high-density screen, and baked-in English text cannot be localised to
  Arabic or Urdu. Brand marks need vector (SVG) masters.
- **GIFs.** 16 frames at 640×340, 1–3 MB each. Prefer the existing SVG/CSS animations (`AnimationPlayer`, pausable, reduced-motion
  aware) or short WebM/Lottie with pause and replay; a GIF cannot be paused or honour `prefers-reduced-motion`.
- **Rights.** Record the generating service and its terms in the licence register (`sources`) before any asset is published.

## Per-asset decision

`Usable after review` = may be proposed as an illustrative image once cleaned up, labelled "Illustration, not a depiction".
`Needs changes` = content conflicts with the sources or is anachronistic; regenerate or edit first. `Do not use` = conflicts
with a hard rule.

| File | Decision | Why |
|---|---|---|
| `stories/nuh-ark.png`, `stories/nuh-rain-wide.png`, `gif/nuh-rain.gif` | Usable after review | Ark on stormy water, no figures. Lightning is artistic (the Quran describes torrential rain and springs, 54:11–12); fine as illustration. |
| `stories/musa-sea.png`, `stories/musa-water-wide.png`, `gif/musa-water.gif` | Usable after review | Walls of water "like a great mountain" (26:63), no figures. The footprints imply people; acceptable. |
| `stories/yusuf-well.png` | Usable after review | Generic well and palms. |
| `stories/ashab-al-kahf.png` | Usable after review | Cave mouth and valley; no figures, no dog. |
| `stories/ayyub-night.png`, `stories/ibrahim-night-wide.png`, `gif/ibrahim-night.gif` | Usable after review | Night sky with a bright star over tents. Fits Ibrahim and the star (6:76); for Ayyub it is only mood, not an event. |
| `stories/ibrahim-kaaba.png` | Needs changes | Shows the Ka'bah with a black kiswa and gold calligraphy band in an empty valley, which belongs to much later history. For Ibrahim and Isma'il raising the foundations (2:127), use the existing `foundations-rising` animation or plain stone foundations. |
| `stories/yunus-whale.png` | Needs changes | The creature has a long horn (narwhal-like). The Quran says a great fish swallowed him (37:142); remove the horn. |
| `stories/people-of-ad.png` | Needs changes | Shows fire and falling rocks. The Quran describes a furious, freezing wind over seven nights and eight days (69:6–7; 54:19); the image contradicts it. Also too violent for Kids mode. |
| `stories/people-of-lut.png` | Needs changes | Shows a city burning. The Quran describes the towns overturned and a rain of stones of baked clay (11:82; 15:74), not fire. Graphic punishment imagery: not for Kids mode. |
| `stories/thamud-rocks.png` | Needs changes | Free-standing classical columns. The Quran describes Thamud carving homes out of mountains (7:74; 15:82; 89:9); show rock-cut dwellings instead. |
| `stories/dhul-qarnayn-journey.png` | Needs changes | A sailing ship is not part of the account in 18:83–98. |
| `stories/yajuj-majuj-barrier.png` | Needs changes | A stone fortress wall. The Quran describes a barrier of iron blocks with molten copper poured over it, between two mountain sides (18:96); location unknown. |
| `stories/dawud-architecture.png`, `stories/sulayman-kingdom.png` | Needs changes | Domed mosques and minarets in later Ottoman/Mughal styles, centuries after Dawud and Sulayman. Use neutral, undated architecture instead (the existing `palace-architecture` animation is one option). |
| `stories/garden-symbolic.png`, `stories/nature-water-wide.png`, `gif/nature-water.gif` | Usable after review **only as ordinary nature** | Fine as a generic garden or oasis. Never caption them as Jannah or "a glimpse of Paradise": Paradise is from the unseen and is not depicted. |
| `stories/fire-warning-symbolic.png` | Do not use | Lava field presented in the mockups as "Jahannam — a warning": a depiction of the unseen and frightening for children. |
| `stories/warning-flames-wide.png`, `gif/warning-flames.gif` | Do not use | Gates, chains and fire: a literal hellscape. Conflicts with the no-unseen rule and the Kids-mode rule. |
| `ui/icon-*.png` (11 icons) | Usable after review | Clean up crops; better as SVG so they follow the light/dark theme. |
| `ui/icon-kids-mode.png` | Needs changes | A child's face. Assets are non-figurative (`assets.depicts_person` is always false); use a symbol instead (stars, building blocks, a paper boat). |
| `ui/qitl-logo-lockup.png`, `ui/qitl-square-logo.png` | Concept only | Different from the current brand (`public/brand/`, from the owner's logo). Raster with baked text. If adopted, redraw as SVG and rerun `scripts/build-brand.mjs`. |
| `ui/qitl-hero-banner.png` | Do not use as is | Baked English text (cannot be translated), 547 px wide. |
| `ui/qitl-quran-visual.png` | Usable after review | Illustrative open book on a stand; the page text is not real mushaf text and must never be presented as such. |

## Notes on the two mockup boards (not in the pack, reviewed from the screenshots)

- **Nuh template:** "Time period approx. 1,050 years (as mentioned in Quran)" is wrong. Quran 29:14 says he remained among his
  people a thousand years less fifty, i.e. 950. "Total age 950–1,050 (varies in narrations)" is not established in the Quran or
  the selected authentic hadith; QITL shows "Not established in the Quran or selected authentic Hadith." "4 selected hadith" must
  name each narration and its grading.
- **Isma'il, "Zamzam and Sacrifice":** the Quran does not name the son in 37:101–107. That it was Isma'il is the view of most
  scholars; present it as a scholarly view with its evidence, not as a Quranic statement.
- **Ayyub card (board 2):** appears to show a cloaked human figure. No figures standing for a prophet.
- **"The People of Jannah" / "The People of Jahannam" cards and GIFs:** depictions of the unseen. Present these topics as text,
  verses and abstract or calligraphic design only.
- **Kids animation frames for Lut and 'Ad:** explosions and fire; not appropriate for Kids mode, and not what the verses describe.
- **Feature tiles** ("10+ translations", "11 tafsir", "Hadith with top 10 translations", "verified scholars"): these describe the
  plan, not what exists. Translations, tafsir and hadith texts need licences, and no scholar has been verified yet; the live site
  must not claim them.
- **Muhammad ﷺ card with the Green Dome:** the dome is a much later structure; acceptable as a symbol of Madinah if captioned so.
