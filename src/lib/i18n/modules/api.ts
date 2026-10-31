import { moduleStrings } from "./index";

/**
 * API error messages for readers. Every API error carries a stable `code` (src/lib/api.ts `fail`); the English
 * `error` text is the reviewed source. Client components show `apiErrorText(locale, body)`, which picks the message
 * for the code in the interface language, so the API routes stay language-neutral. Arabic and Urdu: drafts.
 */
export const apiStrings = (locale: string) =>
  moduleStrings(locale, {
    en: {
      codes: {
        not_found: "Not found.",
        rule: "That would break an editorial rule.",
        not_configured: "This feature needs the database, which is not configured on this deployment yet.",
        invalid: "The request is not valid.",
        forbidden: "You do not have permission to do this.",
        server_error: "Something went wrong on our side.",
        rate_limited: "Too many requests. Try again in a minute.",
        unauthorized: "Sign in to do this.",
        bad_origin: "Cross-site request refused.",
        bad_json: "The request body must be JSON.",
        duplicate: "That already exists.",
        missing_reference: "Something this refers to does not exist.",
        constraint: "That would break a data rule.",
        edit_window: "You can edit your own comment for 30 minutes after posting.",
        in_progress: "This is already running.",
        source_not_imported: "The verified Quran text has not been imported on this deployment yet.",
        note_required: "A correction needs a public revision note.",
      } as Record<string, string>,
      generic: "The request could not be completed. Try again.",
      failed: (status: number) => `Request failed (${status})`,
    },
    ar: {
      codes: {
        not_found: "غير موجود.",
        rule: "هذا يخالف قاعدة تحريرية.",
        not_configured: "تحتاج هذه الميزة إلى قاعدة البيانات، وهي غير مهيّأة في هذا النشر بعد.",
        invalid: "الطلب غير صالح.",
        forbidden: "ليست لديك صلاحية لفعل هذا.",
        server_error: "حدث خطأ من جهتنا.",
        rate_limited: "طلبات كثيرة. حاول مرة أخرى بعد دقيقة.",
        unauthorized: "سجّل الدخول لفعل هذا.",
        bad_origin: "رُفض طلب من موقع آخر.",
        bad_json: "يجب أن يكون نص الطلب بصيغة JSON.",
        duplicate: "هذا موجود بالفعل.",
        missing_reference: "شيء يشير إليه هذا غير موجود.",
        constraint: "هذا يخالف قاعدة في البيانات.",
        edit_window: "يمكنك تعديل تعليقك خلال ٣٠ دقيقة من نشره.",
        in_progress: "هذا قيد التشغيل بالفعل.",
        source_not_imported: "لم يُستورد نص القرآن الموثَّق في هذا النشر بعد.",
        note_required: "يحتاج التصحيح إلى ملاحظة مراجعة علنية.",
      },
      generic: "تعذّر إتمام الطلب. حاول مرة أخرى.",
      failed: (status: number) => `فشل الطلب (${status})`,
    },
    ur: {
      codes: {
        not_found: "نہیں ملا۔",
        rule: "اس سے ایک ادارتی اصول ٹوٹے گا۔",
        not_configured: "اس سہولت کو ڈیٹا بیس درکار ہے، جو اس تنصیب پر ابھی ترتیب نہیں دیا گیا۔",
        invalid: "درخواست درست نہیں۔",
        forbidden: "آپ کو یہ کرنے کی اجازت نہیں۔",
        server_error: "ہماری طرف سے کچھ غلط ہو گیا۔",
        rate_limited: "بہت زیادہ درخواستیں۔ ایک منٹ بعد دوبارہ کوشش کریں۔",
        unauthorized: "یہ کرنے کے لیے سائن اِن کریں۔",
        bad_origin: "کسی دوسری سائٹ کی درخواست رد کر دی گئی۔",
        bad_json: "درخواست کا متن JSON ہونا چاہیے۔",
        duplicate: "یہ پہلے سے موجود ہے۔",
        missing_reference: "جس چیز کا یہ حوالہ دیتا ہے وہ موجود نہیں۔",
        constraint: "اس سے ڈیٹا کا ایک اصول ٹوٹے گا۔",
        edit_window: "آپ اپنا تبصرہ پوسٹ کرنے کے ۳۰ منٹ تک اس میں ترمیم کر سکتے ہیں۔",
        in_progress: "یہ پہلے سے چل رہا ہے۔",
        source_not_imported: "تصدیق شدہ قرآنی متن ابھی اس تنصیب پر درآمد نہیں ہوا۔",
        note_required: "اصلاح کے لیے نظرِثانی کا عوامی نوٹ درکار ہے۔",
      },
      generic: "درخواست مکمل نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
      failed: (status: number) => `درخواست ناکام (${status})`,
    },
  });

/**
 * The reader-facing text for an API error body `{ error, code }`: the message for its code in the interface language;
 * in English the API's own message; otherwise `fallback` (or a generic message) rather than English text.
 */
export function apiErrorText(locale: string, body: { error?: string; code?: string } | null | undefined, fallback?: string): string {
  const t = apiStrings(locale);
  const byCode = body?.code ? t.codes[body.code] : undefined;
  if (locale === "en" || !["ar", "ur"].includes(locale)) return body?.error ?? byCode ?? fallback ?? t.generic;
  return byCode ?? fallback ?? t.generic;
}
