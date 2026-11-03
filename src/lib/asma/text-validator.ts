/**
 * Content guard for every free-text field of the Asma' al-Husna module (EN / AR / UR). It refuses, outside a clearly
 * marked misconception entry:
 *   guaranteed_acceptance   promises that a supplication is surely answered / accepted / granted
 *   invented_virtue         rewards, merits or effects attached to a Name or its recitation without a source
 *   fixed_count             a fixed number of recitations ("recite it 100 times")
 *   special_time            a special time / day / night / position for a Name or recitation
 *   limited_to_99           a claim that the Names are limited to, or exactly, 99
 * It is a tripwire for drafting mistakes, not a theological judge: passing it proves nothing about correctness, and
 * the database repeats the same families of pattern in its own text guard (supabase/migrations/...asma_al_husna.sql).
 * In a misconception entry the text may QUOTE the claim in order to correct it, so the guard is lifted there only.
 */
export type TextViolation = "guaranteed_acceptance" | "invented_virtue" | "fixed_count" | "special_time" | "limited_to_99";

export type TextContext = "normal" | "misconception";

const RULES: Array<{ code: TextViolation; re: RegExp }> = [
  // ---- English
  { code: "guaranteed_acceptance", re: /\bguarantee[sd]?\b|\bguaranteed\b/i },
  { code: "guaranteed_acceptance", re: /\b(will|shall)\s+(surely|certainly|definitely|always|never fail to)\s+(be\s+)?(answer|accept|grant|fulfil|fulfill|respond)/i },
  { code: "guaranteed_acceptance", re: /\b(never|cannot|can't)\s+(be\s+)?(rejected|refused|returned empty|fail|fails)\b/i },
  { code: "guaranteed_acceptance", re: /\b(is|are)\s+(always|certainly|surely)\s+(answered|accepted|granted)\b/i },
  { code: "invented_virtue", re: /\b(reward|rewards|rewarded|hasanat|good deeds|blessings?)\s+(of|for)\s+(reciting|saying|repeating|memori[sz]ing)/i },
  { code: "invented_virtue", re: /\b(reciting|repeating|saying|memori[sz]ing)\b[^.]{0,60}\b(earns?|brings?|grants?|gives?|wins?|secures?)\b[^.]{0,40}\b(reward|rewards|hasanat|paradise|jannah|forgiveness|wealth|provision|healing|cure|protection|barakah|blessing)/i },
  { code: "invented_virtue", re: /\b(cures?|heals?|removes?|erases?)\s+(all|every|any)\b/i },
  { code: "invented_virtue", re: /\benter(s)?\s+(paradise|jannah)\b/i },
  { code: "fixed_count", re: /\b(\d+|one hundred|a hundred|a thousand|one thousand|seven|three|twenty-one|forty|ninety-nine)\s*(times|x)\b/i },
  { code: "fixed_count", re: /\b(\d+)\s*(recitations|repetitions)\b/i },
  { code: "special_time", re: /\b(best|special|blessed|ideal|most (?:powerful|effective|accepted))\s+(time|times|hour|hours|moment|night|nights|day|days|part of the night)\b/i },
  { code: "special_time", re: /\b(recite|read|say|repeat|call upon)\b[^.]{0,40}\b(after|before|during|at)\s+(fajr|dhuhr|zuhr|asr|maghrib|isha|tahajjud|dawn|midnight|sunset)\b/i },
  { code: "special_time", re: /\b(after|before|during|at)\s+(fajr|dhuhr|zuhr|asr|maghrib|isha|tahajjud|dawn|midnight|sunset)\b[^.]{0,50}\b(recite|read|say|repeat|call upon)/i },
  { code: "limited_to_99", re: /\b(only|exactly|just|limited to|no more than)\s+(99|ninety-nine)\b/i },
  { code: "limited_to_99", re: /\b(99|ninety-nine)\s+names\s+(and\s+)?(no more|only)\b/i },
  // ---- Arabic
  { code: "guaranteed_acceptance", re: /مضمون|يضمن|ضمان|حتما|حتماً|لا يرد|لا تُرد|مستجابة\s+(?:دائما|دائماً|حتما)/ },
  { code: "invented_virtue", re: /(?:ثواب|أجر|حسنات)\s+(?:قراءة|ترديد|حفظ)|يُدخل(?:ك)?\s+الجنة|يشفي\s+كل/ },
  { code: "fixed_count", re: /(?:\d+|[٠-٩]+)\s*(?:مرة|مرات|مره)|مائة\s+مرة|ألف\s+مرة/ },
  { code: "special_time", re: /(?:أفضل|أحسن|أنسب)\s+(?:وقت|ساعة|ليلة|يوم)|بعد\s+(?:الفجر|المغرب|العشاء)\s+(?:اقرأ|ردد|قل)/ },
  { code: "limited_to_99", re: /(?:فقط|حصرا|حصراً|إلا)\s*(?:تسعة وتسعون|99|٩٩)|(?:99|٩٩)\s*اسما\s*فقط/ },
  // ---- Urdu
  { code: "guaranteed_acceptance", re: /ضمانت|یقینی طور پر قبول|ضرور قبول|لازمی قبول|کبھی رد نہیں/ },
  { code: "invented_virtue", re: /پڑھنے\s+(?:کا|سے)\s+(?:ثواب|اجر)|ثواب\s+ملتا|جنت\s+میں\s+داخل|ہر\s+بیماری\s+کا\s+علاج/ },
  { code: "fixed_count", re: /(?:\d+|[٠-٩۰-۹]+)\s*(?:بار|مرتبہ|دفعہ)|سو\s+بار|ہزار\s+بار/ },
  { code: "special_time", re: /(?:بہترین|خاص|افضل)\s+(?:وقت|گھڑی|رات|دن)|(?:فجر|مغرب|عشاء)\s+کے\s+بعد\s+(?:پڑھ|وظیفہ)/ },
  { code: "limited_to_99", re: /صرف\s+(?:99|۹۹|ننانوے)\s+(?:نام|اسماء)|(?:99|۹۹)\s+(?:ہی|فقط)\s+(?:نام|اسماء)/ },
];

export function checkAsmaText(text: string, context: TextContext = "normal"): TextViolation[] {
  if (context === "misconception") return [];
  const found = new Set<TextViolation>();
  for (const r of RULES) if (r.re.test(text)) found.add(r.code);
  return [...found].sort();
}

/** Throws a readable error when any listed field breaks the guard (used by the importer and the admin API). */
export function assertAsmaText(fields: Record<string, string | null | undefined>, context: TextContext = "normal"): void {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    const found = checkAsmaText(v, context);
    if (found.length) bad.push(`${k}: ${found.join(", ")}`);
  }
  if (bad.length) throw new Error(`Text refused by the Asma' al-Husna content guard (${bad.join("; ")})`);
}
