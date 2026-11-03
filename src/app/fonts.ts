import { Amiri, Amiri_Quran, IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import localFont from "next/font/local";

/**
 * All faces are SIL Open Font License. next/font downloads them at build time and self-hosts them,
 * so no request goes to Google at runtime. Exposed as --ff-*; tokens.css builds --font-* stacks from them.
 */
/** One typeface for the whole interface: Inter. Scripture and Arabic keep their own faces below. */
export const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--ff-inter", display: "swap" });
export const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "600"], variable: "--ff-plex-ar", display: "swap" });
export const amiriQuran = Amiri_Quran({ subsets: ["arabic"], weight: "400", variable: "--ff-amiri-quran", display: "swap", preload: false });
export const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--ff-amiri", display: "swap", preload: false });
// Noto Naskh Arabic and Noto Nastaliq Urdu are self-hosted (the Arabic-subset variable files from Google Fonts, OFL,
// in src/app/fonts/): fetching them through next/font/google broke production builds on Vercel.
export const naskh = localFont({ src: "./fonts/noto-naskh-arabic-arabic-var.woff2", weight: "400 700", variable: "--ff-naskh", display: "swap", preload: false });

/** Urdu interface text (Nastaliq). Not preloaded: only Urdu pages use it. Quranic Arabic keeps --font-quran. */
export const nastaliq = localFont({ src: "./fonts/noto-nastaliq-urdu-arabic-var.woff2", weight: "400 700", variable: "--ff-nastaliq", display: "swap", preload: false });

export const fontVariables = [inter, plexAr, amiriQuran, amiri, naskh, nastaliq].map((f) => f.variable).join(" ");
