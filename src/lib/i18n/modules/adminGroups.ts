import { moduleStrings } from "./index";
import type { AdminGroupId } from "@/lib/admin-groups";

/** The admin navigation groups. Arabic and Urdu are drafts for a translator. */
type Labels = Record<AdminGroupId, string>;
const en: Labels = { overview: "Overview", content: "Content", sources: "Religious sources", learning: "Learning content", media: "Media", reviews: "Reviews", community: "Community", platform: "Platform" };
const ar: Labels = { overview: "نظرة عامة", content: "المحتوى", sources: "المصادر الدينية", learning: "محتوى التعلم", media: "الوسائط", reviews: "المراجعات", community: "المجتمع", platform: "المنصة" };
const ur: Labels = { overview: "جائزہ", content: "مواد", sources: "دینی مآخذ", learning: "تعلیمی مواد", media: "میڈیا", reviews: "جائزے", community: "کمیونٹی", platform: "پلیٹ فارم" };

export const adminGroupRaw = { en: { groups: en }, ar: { groups: ar }, ur: { groups: ur } };
export const adminGroupStrings = (locale: string) => moduleStrings(locale, adminGroupRaw);
