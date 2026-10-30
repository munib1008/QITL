# EvidenceLabel

The core ZIQ primitive: states what kind of knowledge a claim rests on. Six kinds, each told apart by **word + mark + border style**, never by colour alone.

| kind | word | mark | border |
|---|---|---|---|
| `quran` | Quran | eight-point star | solid fill `ev-quran` |
| `hadith` | Authentic Hadith | filled circle | solid outline `ev-hadith` |
| `scholar` | Scholarly interpretation | half circle | solid outline `ev-scholar` |
| `estimate` | Historical estimate | ≈ waves | dashed `ev-estimate` |
| `disputed` | Disputed | split diamond | double `ev-disputed` |
| `unknown` | Unknown | ? | dotted `ev-unknown` |

- Provide `kind`; `lang="ar"` for Arabic wording; `children` overrides the word (e.g. a specific grade "Hasan").
- Place it next to every claim, verse, narration, date, location and genealogical edge. It is always visible — never only on hover.
- `hadith` means a narration graded authentic (sahih/hasan) by a named scholar for THAT narration — never because of its collection alone (Bukhari/Muslim may carry contextual collection-level treatment, still with the grading shown).
