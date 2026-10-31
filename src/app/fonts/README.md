Self-hosted font files (SIL Open Font License 1.1), downloaded unmodified from Google Fonts:

- `noto-naskh-arabic-arabic-var.woff2`: Noto Naskh Arabic v44, Arabic subset, variable weight.
- `noto-nastaliq-urdu-arabic-var.woff2`: Noto Nastaliq Urdu v23, Arabic subset, variable weight.

They are loaded with `next/font/local` in `src/app/fonts.ts` because fetching them through `next/font/google` failed in
Vercel production builds. The other faces still come from `next/font/google` (self-hosted at build time).

Each family's licence and copyright notice sit next to its file (`OFL-noto-naskh-arabic.txt`, `OFL-noto-nastaliq-urdu.txt`,
copied unmodified from the google/fonts repository).
