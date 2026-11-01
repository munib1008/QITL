import { moduleStrings } from "./index";

/**
 * Small admin strings shared by the editor shell pieces (full-screen editing, load errors).
 * English is the shape. Arabic and Urdu are DRAFTS for translators (glossary: docs/I18N.md). Messages that come from the
 * server or the database are shown as they are, in English, after a short localised prefix.
 */
const strings = {
  en: {
    notConfigured: "Not configured",
    fullScreen: "Full-screen editing",
    fullScreenOf: (title: string) => `${title}, full-screen editing`,
    done: "Done",
  },
  ar: {
    notConfigured: "غير مهيّأ",
    fullScreen: "التحرير بملء الشاشة",
    fullScreenOf: (title: string) => `${title}، التحرير بملء الشاشة`,
    done: "تم",
  },
  ur: {
    notConfigured: "ترتیب نہیں دی گئی",
    fullScreen: "پوری اسکرین میں ترمیم",
    fullScreenOf: (title: string) => `${title}، پوری اسکرین میں ترمیم`,
    done: "مکمل",
  },
};

/** The three languages side by side: tests/unit/admin-l10n.test.ts compares their keys. */
export const adminSharedRaw = strings;

export const adminSharedStrings = (locale: string) => moduleStrings(locale, strings);
