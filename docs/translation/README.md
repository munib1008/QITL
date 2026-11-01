# Translator handover (Arabic and Urdu)

`qitl-strings.csv` holds every interface string (4,342 strings, 52 files) with the English source and the current DRAFT in Arabic and Urdu.
Regenerate it with `pnpm i18n:export`. Open it in Excel or Google Sheets (UTF-8).

How to work: correct or approve each draft in `arabic_final` and `urdu_final` (leave a cell empty to accept the draft as it is), and write questions in `notes`.
Return the file; the corrections are applied by editing the strings files named in `file`/`key` (`docs/I18N.md` has the glossary and the rules).

Rules:
- Keep the product name QITL, brand terms, URLs, code, file names and verse references (`Q 2:30`) exactly as in English.
- Religious terms of art and the honorific after prophets' names stay as the site already writes them; flag a disagreement in `notes` instead of changing it.
- Plain, neutral, consistent wording for interface text; Urdu in clear modern Urdu (the site shows Urdu in Nastaliq).
- Placeholders such as `{n}` are kept. A string ending `()` in `key` was produced by a function, exported with the sample values 3, 7 and 9 so the sentence shape is visible.
- The story drafts in `content/stories` are English only and are a separate job (they are checked against the Quran by the validator; Arabic and Urdu story text goes through the Story Studio translation job and review).
