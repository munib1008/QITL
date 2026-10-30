import "server-only";
import { createHash } from "node:crypto";

/**
 * Machine translation of approved script prose through Lara (Translated), behind a small interface so tests and
 * future engines can stand in. Configured only when both LARA_ACCESS_KEY_ID and LARA_ACCESS_KEY_SECRET are set;
 * the keys are read on the server at call time and never reach the browser.
 */
export interface TranslationEngine {
  readonly name: "lara";
  readonly detail: string;
  translate(texts: string[], source: string, target: string, opts?: { glossaries?: string[] }): Promise<string[]>;
}

export const MAX_ATTEMPTS = 5;

/** Lara locale codes for the script languages. */
export const LARA_LOCALE: Record<string, string> = { en: "en-US", ar: "ar-SA", ur: "ur-PK", hi: "hi-IN" };

export function laraConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.LARA_ACCESS_KEY_ID && env.LARA_ACCESS_KEY_SECRET);
}

/** One job per input: the same script version into the same language is never translated twice. */
export function translationIdempotencyKey(scriptId: string, version: number, language: string): string {
  return `${scriptId}:v${version}:${language}`;
}

/** Billed characters (Lara bills source characters). */
export function countCharacters(texts: string[]): number {
  return texts.reduce((n, t) => n + [...t].length, 0);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function getLaraEngine(): Promise<TranslationEngine | null> {
  if (!laraConfigured()) return null;
  const { AccessKey, Translator } = await import("@translated/lara");
  const lara = new Translator(new AccessKey(process.env.LARA_ACCESS_KEY_ID!, process.env.LARA_ACCESS_KEY_SECRET!));
  return {
    name: "lara",
    detail: `lara-sdk ${lara.version}`,
    async translate(texts, source, target, opts) {
      const res = await lara.translate(texts, LARA_LOCALE[source] ?? source, LARA_LOCALE[target] ?? target, {
        glossaries: opts?.glossaries?.length ? opts.glossaries : undefined,
        contentType: "text/plain",
        noTrace: true,
        instructions: [
          "Religious educational text about the Quran and authentic hadith. Translate faithfully; do not add, remove or embellish facts.",
          "Keep honorifics (ﷺ, عليه السلام, رضي الله عنه) exactly as written.",
        ],
      });
      const out = res.translation;
      if (!Array.isArray(out) || out.length !== texts.length) throw new Error("Lara returned an unexpected number of segments");
      return out.map(String);
    },
  };
}
