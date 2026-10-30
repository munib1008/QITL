# EvidenceDrawer

The source panel that opens from any claim, citation chip, map popup or genealogy edge. Side drawer ≥768px; bottom sheet below.

- Provide `claim` (the sentence being supported), `status` (its overall evidence kind), `tabs` (Quran / Hadith / Interpretation / History, each with a `count` and content), `footer` (review/revision note), `onClose`.
- Focus moves into the drawer on open, returns to the trigger on close; Esc closes; tabs follow the ARIA tab pattern.
- Empty tabs say so plainly ("No narration is attached") — never hide the tab.
