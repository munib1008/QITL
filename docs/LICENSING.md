# Content licensing: per-source report

Registry: `content_permissions` (one row per source × asset type × scope), view `content_licence_registry`, admin page
`/admin/licences`. Migration `supabase/migrations/20261031002110_content_permissions.sql` seeds the rows below.

Statuses: **APPROVED** (an admin checked a licence or written permission and signed it off; the database stamps the
acting admin as `verified_by`), **CONDITIONAL** (usable under the recorded conditions), **PERMISSION_REQUIRED** (no
licence found, page unreadable or terms unclear: ask in writing), **BLOCKED**. "Allowed for display"
(`content_permission_allowed`) means APPROVED, or CONDITIONAL with the attribution text recorded.

Nothing is APPROVED because it can be downloaded. **Every seeded row has `verified_by = null`: the owner signs each one
off.** All pages below were read on **2026-10-31**. Short quotations are the pages' own words; the rest is a summary,
not legal advice.

## Summary

| Source | Asset | Status | One-line reason | Evidence |
|---|---|---|---|---|
| Tanzil Quran Text (Uthmani 1.1) | text (Hafs) | CONDITIONAL (attribution recorded → allowed) | CC BY 3.0: verbatim copies only, credit Tanzil, link tanzil.net, keep the notice | https://tanzil.net/docs/text_license |
| Tanzil Quran Metadata 1.0 (`quran-data.js`) | metadata: juz / hizb-quarter / page boundaries | CONDITIONAL (attribution shown → allowed) | The file's own header: "License: Creative Commons Attribution 3.0", © 2008-2009 Tanzil.info; numbers only | https://tanzil.net/res/text/metadata/quran-data.js |
| King Fahd Complex developer platform | text: Hafs, Warsh, Shu'bah, Qalun, al-Susi, al-Bazzi, al-Duri | PERMISSION_REQUIRED | Files offered, but no licence or terms; footer "all rights reserved" | https://qurancomplex.gov.sa/quran-dev/ |
| King Fahd Complex developer platform | fonts; Tafseer Muyassar | PERMISSION_REQUIRED | Same page, no licence | https://qurancomplex.gov.sa/quran-dev/ |
| King Fahd Complex audio library | recordings: Hafs, Shu'bah, Qalun, al-Susi, al-Duri 'an Abi 'Amr | CONDITIONAL (no attribution yet → not allowed) | Free public use in apps, broadcast and websites, inside and outside KSA; hosting/redistribution not stated | https://qurancomplex.gov.sa/quran-audios/ |
| Quran Foundation | api | CONDITIONAL (no attribution yet) | Developer Terms (2026-10-11): 1-week cache limit, credit QF, no raw redistribution | https://api-docs.quran.foundation/legal/developer-terms/ |
| Quran Foundation | translation (third-party) | PERMISSION_REQUIRED | Terms cover only "QF Content it owns" | same |
| QuranEnc | translation, api | CONDITIONAL (no attribution yet) | Re-publish allowed: no changes, credit publisher + QuranEnc, version number, keep updated | https://quranenc.com/en/home/api/ |
| QuranEnc | tafsir | PERMISSION_REQUIRED | Terms speak of "the translations" only | same |
| sunnah.com | api, hadith text, translation | PERMISSION_REQUIRED | Developers page returned HTTP 403; no terms read | https://sunnah.com/developers |
| Quranic Arabic Corpus | metadata (morphology 0.4) | CONDITIONAL (no attribution yet) | GNU GPL v3 + verbatim-only download terms, credit and link | https://corpus.quran.com/download/ |
| Noto Naskh Arabic, Noto Nastaliq Urdu (self-hosted) | font | CONDITIONAL | SIL OFL 1.1: notice + licence must accompany copies; not sold alone | https://openfontlicense.org/open-font-license-official-text/ |
| Source Serif 4, IBM Plex Sans / Sans Arabic / Mono, Amiri Quran, Amiri (next/font) | font | CONDITIONAL | OFL 1.1 as stated in `src/app/fonts.ts`; per-family licences not re-read today | same |

## Per source

### Tanzil Quran Text (Uthmani), version 1.1 — the text QITL shows
- **Page:** https://tanzil.net/docs/text_license (read 2026-10-31).
- **What it says:** licence "Creative Commons Attribution 3.0"; "Permission is granted to copy and distribute verbatim
  copies of this text", "CHANGING IT IS NOT ALLOWED"; usable "in any website or application" if the source (Tanzil
  Project) is clearly indicated and a link is made to tanzil.net; the copyright notice is kept in verbatim copies and
  reproduced in files derived from or containing a substantial portion of the text. It asks users to check for updates.
- **Freely usable:** web display and local hosting of the unmodified text (already done: `content/quran`, pinned by
  checksum, attributed by `src/components/quran/QuranAttribution.tsx`, which links tanzil.net and CC BY 3.0).
- **Conditions:** no change to the text; attribution and link on every page that shows it; notice kept in derived files.
- **Not stated:** commercial use. Recorded as `unknown`.
- **Registry:** text / hafs, CONDITIONAL, attribution text recorded (so it is allowed for display). It is the one
  `quran_text_editions` row (Hafs 'an 'Asim, linked to the Tanzil source, source version `Uthmani 1.1`, sha256
  `bf4f57b9…312c8`).

### Tanzil Quran Metadata (quran-data.js), version 1.0 — reading divisions
- **File:** https://tanzil.net/res/text/metadata/quran-data.js (read 2026-10-31). The importer already fetched it for the
  surah names. Its header reads "Quran Metadata (ver 1.0)", "Copyright (C) 2008-2009 Tanzil.info", "License: Creative
  Commons Attribution 3.0": the same project and licence as the text.
- **Used:** only the boundary numbers of the 30 juz, 240 hizb quarters and 604 Madinah-mushaf pages, saved by
  `scripts/import-quran.ts` (`--structure-only` for an existing import) to `content/quran/structure.json` with the
  file's sha256 and licence line. `quran.txt` is not touched. The importer refuses a metadata file whose header does
  not state CC BY 3.0.
- **Attribution:** the reader and the surah index print "Juz, hizb and page divisions: Tanzil Quran Metadata (CC BY
  3.0)" beside the Tanzil text attribution.

### King Fahd Glorious Qur'an Printing Complex — developer platform
- **Pages:** https://qurancomplex.gov.sa/quran-dev/ (read); https://qurancomplex.gov.sa/techquran/dev and
  https://qurancomplex.gov.sa/techquran/ returned **HTTP 404**; the news article https://qurancomplex.gov.sa/en/?p=5536
  describes the platform ("various narrations", SQL, JSON, HTML5, XML, Excel, MS Word, Unicode fonts) and states no terms.
- **What it offers:** Unicode text and font for **Hafs, Warsh, Shu'bah, Qalun, al-Susi, al-Bazzi and al-Duri** (the page
  says "Douri" without naming the reader; al-Duri transmits from both Abu 'Amr and al-Kisa'i, so the row is not linked to
  a riwayah), Tafseer Muyassar, Gharib al-Quran and a tajweed book, with file hashes.
- **Licence:** none found. Footer "جميع الحقوق محفوظة" (all rights reserved). Tafsir items are described as for use in
  developers' applications and research, which states intended use, not a licence.
- **Needs written permission:** every text (all seven riwayat), the fonts and the tafsir. Contact listed on the page:
  info@qurancomplex.gov.sa.

### King Fahd Complex — Quran audio library
- **Page:** https://qurancomplex.gov.sa/quran-audios/ (read 2026-10-31).
- **Exact wording found (fragments):** "بناء على موافقة معالي وزير الشؤون الإسلامية والدعوة والإرشاد"; "يتشـرَّف المجمع
  بإتاحة النسخ الرقمية … للاستخدام العام مجاناً"; "في التطبيقات الحاسوبية ومواقع وقنوات البث الإذاعي، ومواقع الإنترنت، وأعمال
  الجهات الحكومية"; "وذلك داخل المملكة العربية السعودية وخارجها"; "والمجمع ليس مسؤولاً عن الأخطاء الفنية، أو البرمجية".
  In short: by the Minister's approval, the digital copies are offered free for public use in computer applications,
  broadcast sites and channels, websites and the work of government (and, per the page, private) bodies, inside and
  outside Saudi Arabia; the Complex is not responsible for technical or software errors.
- **Riwayat listed:** Hafs 'an 'Asim (five reciters), Shu'bah 'an 'Asim, Qalun 'an Nafi', al-Susi 'an Abi 'Amr, al-Duri
  'an Abi 'Amr. **Warsh is not listed.**
- **Not stated on the listing page:** download, local hosting, redistribution, modification or attribution terms (each
  recording links to its own page, not read today).
- **Registry:** one CONDITIONAL recording row per listed riwayah, **with no attribution text**, so none is allowed for
  display until the owner reads the per-recording pages and records the attribution. No reciter or recording is seeded.

### Quran Foundation (Quran.com APIs)
- **Page:** https://api-docs.quran.foundation/legal/developer-terms/ ("Last updated: 2026-10-11").
- **Licence:** non-exclusive, revocable, non-transferable, non-sublicensable, "solely to develop and operate
  Applications that provide beneficial Quranic experiences to end users".
- **Conditions:** no caching or storing of QF Content beyond 1 week except through the Content Sync APIs (re-sync at least
  every 7 days); no prepackaged database or build-time bundle; fonts and Mushaf images only bundled inside the app; credit
  Quran Foundation in a reasonably accessible place; Quran text never modified; rate limits. Paid apps, ads and donations
  are allowed when QF Content appears only in the end-user experience; selling or redistributing raw data needs a signed
  commercial licence.
- **Obligations:** report suspected breaches to developers@quran.com within 24 hours; logs and architecture for audits on
  written notice; delete QF Content and user data on termination; public privacy policy and terms of use.
- **Third-party content:** not addressed (the terms cover "QF Content it owns") → translations through QF stay
  PERMISSION_REQUIRED per edition.

### QuranEnc
- **Page:** https://quranenc.com/en/home/api/ ("Terms and Policies" section).
- **What it says:** "Contents of the translations can be downloaded and re-published, with the following terms and
  conditions": no modification, addition or deletion; clearly refer to the publisher and the source (QuranEnc.com);
  mention the version number; notify QuranEnc of notes; update to the latest version; no inappropriate advertisements.
- **Not stated:** commercial use, API keys, caching rules. The interpretation adapter expects `QURANENC_API_KEY`: confirm.
- **Tafsir:** the API serves it, but the terms name translations only → PERMISSION_REQUIRED.

### sunnah.com
- **Page:** https://sunnah.com/developers returned **HTTP 403** to the fetch on 2026-10-31. The repository README
  (https://github.com/sunnah-com/api) states no terms and points to https://sunnah.stoplight.io/docs/api/. Search results
  (not the page itself) say keys are requested through an issue on the sunnah-com/api GitHub repository and that no
  offline dump is available.
- **Status:** PERMISSION_REQUIRED for the API, hadith text and translations. Hadith on QITL stay referenced only
  ("Text unavailable — licence pending").

### Quranic Arabic Corpus
- **Pages:** https://corpus.quran.com/license.jsp reproduces GNU GPL v3 (copyright Kais Dukes 2009–2017, maintained by
  the quran.com team); https://corpus.quran.com/download/ terms for morphology 0.4: "Permission is granted to copy and
  distribute verbatim copies of this file, but CHANGING IT IS NOT ALLOWED"; source clearly indicated; link to
  corpus.quran.com; notice reproduced in derived works.
- **Caveat:** GPL copyleft applies to modified or derived works; confirm it suits the site before importing.

### Self-hosted fonts (SIL Open Font License 1.1)
- **Evidence:** https://openfontlicense.org/open-font-license-official-text/ and `src/app/fonts/README.md` (Noto Naskh
  Arabic v44 and Noto Nastaliq Urdu v23, Arabic subsets, unmodified from Google Fonts); `src/app/fonts.ts` states the
  next/font families are OFL.
- **Conditions:** each copy carries its copyright notice and the licence; not sold by itself; modified versions may not use
  a Reserved Font Name without permission; derivatives stay OFL.

## Missing content and missing licences

1. **Every riwayah other than Hafs:** no licensed text edition. The King Fahd Complex offers Warsh, Shu'bah, Qalun, al-Susi,
   al-Bazzi and al-Duri texts with no licence → written permission needed (and which al-Duri). Nothing offers the other
   thirteen riwayat in the sources read today.
2. **Recitation audio:** the King Fahd Complex public-use statement covers Hafs, Shu'bah, Qalun, al-Susi and al-Duri
   'an Abi 'Amr, but hosting/redistribution and attribution wording are not stated: read each recording page, record the
   attribution, then an admin can sign off. No Warsh audio source found.
3. **Hadith text for Sahih al-Bukhari 4991, 4992 and Sahih Muslim 818** (the ahruf narrations): no licensed edition
   (sunnah.com unreadable today) → shown as references only.
4. **Transmission routes (turuq), reader and transmitter biographies, dates:** none entered; they need cited scholarly
   sources (editor-entered, reviewed).
5. **Qira'at variant data:** none; needs two licensed editions per comparison plus reviewed explanation claims.
6. **Translations and tafsir:** QuranEnc (conditional, attribution per edition to record), Quran Foundation (third-party
   rights per edition), King Fahd Complex Tafseer Muyassar (permission required).
7. **Font licence files:** the OFL text and copyright notices are **not stored next to** `src/app/fonts/*.woff2`; add
   `OFL.txt` (and each family's notice) to satisfy "each copy contains the above copyright notice and this license".
8. **Commercial use** is not stated by Tanzil, the King Fahd Complex or QuranEnc. If QITL ever charges or carries ads,
   ask each provider.
9. **Owner sign-off:** every seeded row has `verified_by = null`. Recording the attribution text for the conditional
   rows, and approving any row, is an admin action in `/admin/licences`.
