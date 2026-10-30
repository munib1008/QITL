# JourneyTimeline

The home-page journey from Adam (عليه السلام) to the passing of the Prophet Muhammad ﷺ. It has 29 stops: the 25 prophets named in the Quran, then five milestones of the Prophet's ﷺ life (birth, first revelation, Hijrah, Farewell Pilgrimage, passing). A glowing vertical line runs through the centre with alternating glass cards. The component renders inside the `journey` theme on its own.

- Provide `eras`, an ordered list of `{title, note, items: ProphetJourneyCardProps[]}`. Each item carries a `type` (`"prophet"` or `"milestone"`), a `chapter` number and `dated` (whether it appears under "Dated history").
- Optional props: `intro` (section heading), `initialActive`, `filters` (default on), `scrollSync` (default on), `onExplore(item)`, `endLabel`, `endNote`, `endActions`, `theme`.
- Filter bar: Complete journey / Prophets / Key events / Dated history. Changing the filter keeps the active stop if it is still visible; otherwise the first visible stop becomes active.
- Layout follows the container width:
  - Below 860px: one column with the spine on the inline-start side, and a sticky "n / 29" progress pill.
  - From 860px: the line is centred and cards alternate sides. The empty side shows the era marker and how certain it is (the "date opposite" pattern).
  - From 1180px: a sticky glass rail titled "Your journey" lists every stop.
- Behaviour:
  - The stop nearest 40% of the viewport becomes active: its card expands, its node pulses and the line fills to it.
  - A nearby stop only takes over when it is at least 48px closer than the current one, so the active card doesn't flicker.
  - After any click (node, rail, filter, evidence), scroll-sync pauses for 1.2s so the card you touched doesn't collapse under you.
- "View evidence" opens the evidence panel (EvidenceDrawer), rendered into `document.body` through a portal. It is a side drawer on desktop and a bottom sheet under 768px, with Quran, Hadith and Context tabs. Esc closes it and focus returns to the button that opened it.
- Reveal: only stops below the fold at load are hidden, so nothing stays invisible if IntersectionObserver never fires. Stops scrolled past are revealed anyway.
- Motion follows the README's Journey rules. Under `prefers-reduced-motion` there is no reveal, pulse, sheen or parallax.
