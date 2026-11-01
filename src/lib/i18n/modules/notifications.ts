/**
 * In-app notification strings (en, ar, ur): the bell in the account area and the panel on My library. A notification
 * carries a kind, an optional title (the question's own title) and a same-site link; the sentence for the kind is here.
 * Arabic and Urdu are first drafts awaiting review by a qualified translator.
 */
import type { Locale } from "../dict";
import { resolveLocale } from "../locales";

const en = {
  bell: {
    none: "Notifications",
    unread: (n: number) => `Notifications, ${n} unread`,
  },
  panel: {
    title: "Notifications",
    lead: "Updates about your questions and applications. Only a title and a link are kept here, never an answer.",
    empty: "No notifications yet.",
    loadError: "Notifications could not be loaded.",
    markAll: "Mark all as read",
    markOne: "Mark as read",
    open: "Open",
    unread: "Unread",
    read: "Read",
    unreadCount: (n: number) => (n === 1 ? "1 unread" : `${n} unread`),
    working: "Saving…",
  },
  kinds: {
    mufti_assigned: "A question was assigned to you",
    mufti_answered: "Your question has a published answer",
    mufti_closed: "Your question was closed",
    mufti_application: "Your scholar application was updated",
    reply: "Someone replied to you",
    thread_activity: "New activity in a discussion you follow",
    moderation: "A moderation update",
    correction: "An update on your correction",
    system: "A notice from QITL",
  } as Record<string, string>,
};

const ar: typeof en = {
  bell: {
    none: "الإشعارات",
    unread: (n: number) => `الإشعارات، ${n} غير مقروء`,
  },
  panel: {
    title: "الإشعارات",
    lead: "مستجدات عن أسئلتك وطلباتك. يُحفظ هنا عنوان ورابط فقط، ولا يُحفظ أي جواب.",
    empty: "لا توجد إشعارات بعد.",
    loadError: "تعذّر تحميل الإشعارات.",
    markAll: "تعليم الكل كمقروء",
    markOne: "تعليم كمقروء",
    open: "فتح",
    unread: "غير مقروء",
    read: "مقروء",
    unreadCount: (n: number) => `${n} غير مقروء`,
    working: "جارٍ الحفظ…",
  },
  kinds: {
    mufti_assigned: "أُسند إليك سؤال",
    mufti_answered: "نُشر جواب على سؤالك",
    mufti_closed: "أُغلق سؤالك",
    mufti_application: "تغيّرت حالة طلبك للانضمام عالمًا",
    reply: "ردّ عليك أحدهم",
    thread_activity: "نشاط جديد في نقاش تتابعه",
    moderation: "مستجد من الإشراف",
    correction: "مستجد بشأن تصحيحك",
    system: "إشعار من QITL",
  },
};

const ur: typeof en = {
  bell: {
    none: "اطلاعات",
    unread: (n: number) => `اطلاعات، ${n} نہ پڑھی ہوئی`,
  },
  panel: {
    title: "اطلاعات",
    lead: "آپ کے سوالات اور درخواستوں کی تازہ کاری۔ یہاں صرف عنوان اور لنک رکھا جاتا ہے، کوئی جواب نہیں۔",
    empty: "ابھی کوئی اطلاع نہیں۔",
    loadError: "اطلاعات لوڈ نہ ہو سکیں۔",
    markAll: "سب کو پڑھا ہوا نشان زد کریں",
    markOne: "پڑھا ہوا نشان زد کریں",
    open: "کھولیں",
    unread: "نہ پڑھی ہوئی",
    read: "پڑھی ہوئی",
    unreadCount: (n: number) => `${n} نہ پڑھی ہوئی`,
    working: "محفوظ ہو رہا ہے…",
  },
  kinds: {
    mufti_assigned: "ایک سوال آپ کو سونپا گیا",
    mufti_answered: "آپ کے سوال کا جواب شائع ہو گیا",
    mufti_closed: "آپ کا سوال بند کر دیا گیا",
    mufti_application: "عالم کے طور پر آپ کی درخواست کی صورتِ حال بدل گئی",
    reply: "کسی نے آپ کو جواب دیا",
    thread_activity: "آپ کی پیروی کردہ گفتگو میں نئی سرگرمی",
    moderation: "نگرانی کی طرف سے اطلاع",
    correction: "آپ کی تصحیح کے بارے میں اطلاع",
    system: "QITL کی طرف سے اطلاع",
  },
};

export const notificationStrings: Record<Locale, typeof en> = { en, ar, ur };
export type NotificationStrings = typeof en;
export function notificationsT(locale: string | Locale): NotificationStrings {
  return notificationStrings[resolveLocale(locale)];
}
