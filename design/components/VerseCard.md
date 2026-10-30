# VerseCard

A single ayah: Arabic original first, translation second, translator/edition always shown, with bookmark, copy-reference, source and discuss actions.

- Provide `surahName`, `reference`, `arabic` (from the verified canonical text — never retyped), and either `translation` + `translator` + `edition` or `licence="pending"`.
- `demo` adds a DEMO tag; use it on every fixture.
- Arabic sits in `quran-ayah`, `dir="rtl" lang="ar"`, never truncated, never letter-spaced. Translation in `body`, max `measure-reading`.
- Bookmark when signed out: open sign-in, preserve `returnTo`, save only after the user confirms.
