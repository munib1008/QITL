import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { partnersRaw, partnersT } from "@/lib/i18n/modules/partners";
import {
  CONTACT_KINDS,
  GROUP_TYPES,
  INQUIRY_STATUSES,
  LEVELS,
  LISTING_STATUSES,
  MEMBER_ROLES,
  PRICING_TYPES,
  PROVIDER_TYPES,
  REPORT_REASONS,
  SERVICE_MODES,
  SERVICE_STATUSES,
  VERIFICATION_KINDS,
} from "@/lib/partners/constants";
import { directoryHref, filterDirectory, paginate, parseDirectoryQuery, PAGE_SIZE } from "@/lib/partners/directory";
import { priceLines } from "@/lib/partners/pricing";
import { categoryName, groupByTrack, resolveMerged } from "@/lib/partners/taxonomy";
import type { CategoryRow, DirectoryRow, PricingRow } from "@/lib/partners/types";
import { AvailabilityInput, ContactInput, InquiryInput, PricingInput, ProfileInput, ReportInput, TransitionInput, VerificationDecisionInput, pricingRow, slugify } from "@/lib/partners/validation";

const MIGRATION = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "20261031002800_learning_partners.sql"), "utf8");

/** The values of a CHECK (col in (...)) list in the migration, by the column the list belongs to. */
function checkList(column: string): string[] {
  const re = new RegExp(`${column}[^\\n]*?check \\(${column} in \\(([^)]*)\\)`, "s");
  const m = re.exec(MIGRATION) ?? new RegExp(`${column} text not null check \\(${column} in \\(([^)]*)\\)`, "s").exec(MIGRATION);
  if (!m) throw new Error(`no check list for ${column}`);
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
}

describe("constants stay in step with the migration", () => {
  test.each([
    ["provider_type", PROVIDER_TYPES],
    ["listing_status", LISTING_STATUSES],
    ["pricing_type", PRICING_TYPES],
    ["mode", SERVICE_MODES],
    ["group_type", GROUP_TYPES],
    ["level", LEVELS],
  ])("%s", (col, list) => {
    expect([...checkList(col)].sort()).toEqual([...list].sort());
  });
  test("roles, kinds and statuses", () => {
    expect(MEMBER_ROLES).toEqual(["owner", "admin", "instructor", "inquiry_manager"]);
    expect(CONTACT_KINDS).toContain("address");
    expect(VERIFICATION_KINDS).toEqual(["identity", "qualifications", "religious_scholarly"]);
    expect(SERVICE_STATUSES).toEqual(["draft", "published", "paused", "archived"]);
    expect(INQUIRY_STATUSES).toEqual(["new", "viewed", "responded", "follow_up", "closed", "spam"]);
    expect(REPORT_REASONS).toContain("safeguarding");
    for (const v of [...MEMBER_ROLES, ...VERIFICATION_KINDS, ...INQUIRY_STATUSES, ...REPORT_REASONS]) expect(MIGRATION).toContain(`'${v}'`);
  });
});

describe("pricing rules (mirror the database constraints)", () => {
  const ok = (v: unknown) => PricingInput.safeParse(v).success;
  test("free, donation and on-request carry nothing else", () => {
    for (const t of ["free", "donation", "on_request"]) {
      expect(ok({ pricing_type: t })).toBe(true);
      expect(ok({ pricing_type: t, amount: 5 })).toBe(false);
      expect(ok({ pricing_type: t, currency: "GBP" })).toBe(false);
      expect(ok({ pricing_type: t, registration_fee: 5 })).toBe(false);
    }
  });
  test("priced types need an amount and a currency; a package needs two or more classes", () => {
    expect(ok({ pricing_type: "hourly" })).toBe(false);
    expect(ok({ pricing_type: "hourly", amount: 20 })).toBe(false);
    expect(ok({ pricing_type: "hourly", amount: 20, currency: "GBP" })).toBe(true);
    expect(ok({ pricing_type: "hourly", amount: 0, currency: "GBP" })).toBe(false);
    expect(ok({ pricing_type: "hourly", amount: -1, currency: "GBP" })).toBe(false);
    expect(ok({ pricing_type: "hourly", amount: 20, currency: "gbp" })).toBe(false);
    expect(ok({ pricing_type: "package", amount: 90, currency: "USD", classes_included: 1 })).toBe(false);
    expect(ok({ pricing_type: "package", amount: 90, currency: "USD", classes_included: 10 })).toBe(true);
  });
  test("the unit follows the type and is never chosen by the caller", () => {
    expect(pricingRow(PricingInput.parse({ pricing_type: "monthly", amount: 40, currency: "GBP" })).unit).toBe("month");
    expect(pricingRow(PricingInput.parse({ pricing_type: "per_class", amount: 4, currency: "GBP" })).unit).toBe("class");
    expect(pricingRow(PricingInput.parse({ pricing_type: "free" })).unit).toBeNull();
    expect(PricingInput.safeParse({ pricing_type: "monthly", amount: 4, currency: "GBP", unit: "hour" }).success).toBe(false);
  });
  test("the price line shows what the provider stated, fees separately, never a total", () => {
    const labels = partnersT("en").pricing;
    const row = (o: Partial<PricingRow>): PricingRow => ({ id: "x", service_id: "y", pricing_type: "monthly", currency: "GBP", amount: "40.00", unit: "month", classes_included: null, registration_fee: null, materials_fee: null, fees_note: null, updated_at: "2026-11-01T00:00:00Z", ...o });
    expect(priceLines(row({}), labels, "en")).toEqual(["£40.00 per month"]);
    expect(priceLines(row({ registration_fee: "10.00", fees_note: "Fixture note" }), labels, "en")).toEqual(["£40.00 per month", "Registration fee £10.00", "Fixture note"]);
    expect(priceLines(row({ pricing_type: "free", currency: null, amount: null, unit: null }), labels, "en")).toEqual(["Free"]);
    expect(priceLines(row({ pricing_type: "on_request", currency: null, amount: null, unit: null }), labels, "ar")).toHaveLength(1);
  });
});

describe("request validation", () => {
  test("profile: slug, country and languages", () => {
    const base = { slug: "fixture-centre", provider_type: "quran_center", display_name: "Fixture centre", country: "gb", languages: ["en"] };
    expect(ProfileInput.parse(base).country).toBe("GB");
    expect(ProfileInput.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, provider_type: "bank" }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, languages: [] }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, short_description: "too short" }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, owner_id: "x" }).success).toBe(false); // strict: no owner, no listing_status
    expect(ProfileInput.safeParse({ ...base, listing_status: "approved" }).success).toBe(false);
  });
  test("slugify", () => {
    expect(slugify("  Al-Noor Quran Centre!! ")).toBe("al-noor-quran-centre");
    expect(slugify("Café Ünïcode")).toBe("cafe-unicode");
  });
  test("contacts: https only for websites, an address-shaped email", () => {
    expect(ContactInput.safeParse({ kind: "website", value: "http://example.test" }).success).toBe(false);
    expect(ContactInput.safeParse({ kind: "website", value: "https://example.test/x" }).success).toBe(true);
    expect(ContactInput.safeParse({ kind: "email", value: "not an email" }).success).toBe(false);
    expect(ContactInput.parse({ kind: "phone", value: "+44 20 0000 0000" }).is_public).toBe(false); // private by default
  });
  test("availability ends after it starts", () => {
    expect(AvailabilityInput.safeParse({ weekday: 1, start_time: "18:00", end_time: "17:00", timezone: "UTC" }).success).toBe(false);
    expect(AvailabilityInput.safeParse({ weekday: 1, start_time: "18:00", end_time: "19:00", timezone: "UTC" }).success).toBe(true);
  });
  test("an inquiry needs consent and carries no extra fields", () => {
    const base = { partner_id: "11111111-1111-4111-8111-111111111111", subject: "Fixture subject", message: "Fixture message long enough." };
    expect(InquiryInput.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(InquiryInput.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(InquiryInput.safeParse(base).success).toBe(false);
    expect(InquiryInput.safeParse({ ...base, consent: true, learner_id: "x" }).success).toBe(false);
  });
  test("a transition that needs a reason says so; decisions record what was verified", () => {
    expect(TransitionInput.safeParse({ to: "rejected" }).success).toBe(false);
    expect(TransitionInput.safeParse({ to: "rejected", note: "Fixture reason" }).success).toBe(true);
    expect(TransitionInput.safeParse({ to: "approved" }).success).toBe(true);
    expect(TransitionInput.safeParse({ to: "banana" }).success).toBe(false);
    expect(VerificationDecisionInput.safeParse({ kind: "identity", status: "verified", note: "Fixture done" }).success).toBe(false);
    expect(VerificationDecisionInput.safeParse({ kind: "identity", status: "verified", note: "Fixture done", scope: "Fixture: name matched" }).success).toBe(true);
    expect(ReportInput.safeParse({ partner_id: "11111111-1111-4111-8111-111111111111", reason: "payment_pressure" }).success).toBe(true);
  });
});

describe("directory filtering", () => {
  const row = (o: Partial<DirectoryRow>): DirectoryRow => ({
    id: "1", slug: "a", display_name: "Fixture A", provider_type: "quran_center", country: "GB", city: "London", service_area: null, languages: ["en", "ar"],
    short_description: "Fixture description text", years_experience: null, approved_at: null, category_ids: ["c1"], modes: ["online"], group_types: ["group"],
    levels: ["beginner"], teaching_languages: ["ar"], has_free: false, has_paid: true, service_count: 1, ...o,
  });
  const rows = [
    row({}),
    row({ id: "2", slug: "b", display_name: "Fixture B", country: "PK", city: "Lahore", category_ids: ["c2"], modes: ["in_person"], group_types: ["individual"], levels: ["all_levels"], has_free: true, has_paid: false }),
    row({ id: "3", slug: "c", display_name: "Fixture C", city: null, modes: ["hybrid"], group_types: ["both"], levels: ["advanced"], languages: ["ur"], teaching_languages: ["ur"] }),
  ];
  const f = (q: Record<string, string>) => filterDirectory(rows, parseDirectoryQuery(q)).map((r) => r.slug);
  test("each filter", () => {
    expect(f({})).toEqual(["a", "b", "c"]);
    expect(f({ category: "11111111-1111-4111-8111-111111111111" })).toEqual([]);
    expect(f({ country: "pk" })).toEqual(["b"]);
    expect(f({ city: "london" })).toEqual(["a"]);
    expect(f({ mode: "online" })).toEqual(["a", "c"]); // hybrid offers online too
    expect(f({ mode: "in_person" })).toEqual(["b", "c"]);
    expect(f({ language: "ur" })).toEqual(["c"]);
    expect(f({ price: "free" })).toEqual(["b"]);
    expect(f({ price: "paid" })).toEqual(["a", "c"]);
    expect(f({ level: "beginner" })).toEqual(["a", "b"]); // an "all levels" course fits a beginner
    expect(f({ group: "group" })).toEqual(["a", "c"]);
    expect(f({ group: "individual" })).toEqual(["b", "c"]);
    expect(f({ q: "lahore" })).toEqual(["b"]);
  });
  test("junk query values are dropped, not errors", () => {
    expect(parseDirectoryQuery({ mode: "teleport", country: "ZZZ", page: "-3", q: "x".repeat(200) })).toEqual({});
    expect(f({ mode: "teleport" })).toEqual(["a", "b", "c"]);
  });
  test("pagination and links", () => {
    const many = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => i);
    expect(paginate(many, 1).items).toHaveLength(PAGE_SIZE);
    expect(paginate(many, 2).items).toHaveLength(3);
    expect(paginate(many, 99).page).toBe(2);
    expect(directoryHref({ country: "GB", page: 1 })).toBe("/partners?country=GB");
    expect(directoryHref({})).toBe("/partners");
  });
  test("a directory row carries no street address, contact or owner", () => {
    expect(Object.keys(rows[0]!).filter((k) => /address|phone|email|owner|contact/.test(k))).toEqual([]);
    expect(MIGRATION.slice(MIGRATION.indexOf("create view public.partner_directory"), MIGRATION.indexOf("-- Privileges and RLS"))).not.toMatch(/contact|owner|address|qualification|evidence/);
  });
});

describe("taxonomy helpers", () => {
  const c = (o: Partial<CategoryRow>): CategoryRow => ({ id: "1", slug: "a", track: "quran", name_en: "A", name_ar: "ا", name_ur: "الف", active: true, sort_order: 10, merged_into: null, ...o });
  test("names by locale", () => {
    expect(categoryName(c({}), "en")).toBe("A");
    expect(categoryName(c({}), "ar")).toBe("ا");
    expect(categoryName(c({}), "ur")).toBe("الف");
  });
  test("grouped by track, ordered, hiding inactive and merged", () => {
    const rows = [c({ id: "1", slug: "z", sort_order: 5 }), c({ id: "2", slug: "y", sort_order: 1 }), c({ id: "3", active: false }), c({ id: "4", merged_into: "1" }), c({ id: "5", track: "arabic" })];
    const g = groupByTrack(rows);
    expect(g.map((x) => x.track)).toEqual(["quran", "arabic"]);
    expect(g[0]!.items.map((x) => x.id)).toEqual(["2", "1"]);
  });
  test("a merge chain resolves to the survivor; a cycle terminates", () => {
    expect(resolveMerged([c({ id: "1", merged_into: "2" }), c({ id: "2", merged_into: "3" }), c({ id: "3" })], "1")).toBe("3");
    expect(resolveMerged([c({ id: "1", merged_into: "2" }), c({ id: "2", merged_into: "1" })], "1")).toMatch(/^[12]$/);
  });
  test("the migration seeds all three tracks with Arabic and Urdu names", () => {
    const seed = MIGRATION.slice(MIGRATION.indexOf("insert into public.partner_service_categories"));
    for (const track of ["quran", "arabic", "islamic"]) expect(seed).toContain(`'${track}'`);
    const rows = [...seed.matchAll(/\('([a-z_]+)', '(quran|arabic|islamic)', '([^']*(?:''[^']*)*)', '([^']+)', '([^']+)', (\d+)\)/g)];
    expect(rows.length).toBeGreaterThanOrEqual(20);
    for (const r of rows) {
      expect(r[4]).toMatch(/[؀-ۿ]/);
      expect(r[5]).toMatch(/[؀-ۿ]/);
    }
  });
});

describe("required statements, in all three languages", () => {
  const PAYMENTS_EN = "QITL helps learners discover educational providers. Course arrangements, fees and payments are handled directly with the provider. QITL does not process course payments.";
  test("the payments sentence is exact in English and present in Arabic and Urdu", () => {
    expect(partnersT("en").notices.payments).toBe(PAYMENTS_EN);
    for (const l of ["ar", "ur"]) {
      const s = partnersT(l).notices.payments;
      expect(s).toContain("QITL");
      expect(s).not.toBe(PAYMENTS_EN);
      expect(s).toMatch(/[؀-ۿ]/);
    }
  });
  test("verification guarantees are stated separately from payments, and name what it does not guarantee", () => {
    const en = partnersT("en").notices;
    expect(en.verification).toMatch(/does not guarantee/);
    expect(en.verification).toMatch(/never implies another/);
    expect(en.verification).not.toBe(en.payments);
    expect(en.instruction).toMatch(/not the same as issuing a fatwa/);
    expect(en.claims).toMatch(/stated by the provider/);
  });
  test("en, ar and ur have the same keys at every depth and nothing is empty", () => {
    const keys = (o: unknown, p = ""): string[] =>
      typeof o === "string" || typeof o === "function" ? [p] : Array.isArray(o) ? o.flatMap((v, i) => keys(v, `${p}[${i}]`)) : Object.entries(o as object).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k));
    expect(keys(partnersRaw.ar).sort()).toEqual(keys(partnersRaw.en).sort());
    expect(keys(partnersRaw.ur).sort()).toEqual(keys(partnersRaw.en).sort());
  });
  test("every vocabulary used by a page has a label in every language", () => {
    for (const l of ["en", "ar", "ur"]) {
      const t = partnersT(l);
      for (const v of PROVIDER_TYPES) expect(t.providerTypes[v], `${l} ${v}`).toBeTruthy();
      for (const v of LISTING_STATUSES) expect(t.listingStatus[v], `${l} ${v}`).toBeTruthy();
      for (const v of PRICING_TYPES) expect(t.pricing.types[v], `${l} ${v}`).toBeTruthy();
      for (const v of REPORT_REASONS) expect(t.report.reasons[v], `${l} ${v}`).toBeTruthy();
      for (const v of INQUIRY_STATUSES) expect(t.learner.status[v] && t.dashboard.inquiryStatus[v], `${l} ${v}`).toBeTruthy();
      for (const v of CONTACT_KINDS) expect(t.contactKinds[v], `${l} ${v}`).toBeTruthy();
      expect(t.weekdays).toHaveLength(7);
    }
  });
});

describe("QITL is not a payment platform", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|sql)$/.test(e.name)) files.push(p);
    }
  };
  test("no payment provider, checkout, escrow, commission or invoicing in the module's code or schema", () => {
    const root = join(__dirname, "..", "..");
    for (const d of ["src/lib/partners", "src/components/partners", "src/app/api/partners", "src/app/[locale]/partners"]) walk(join(root, d));
    files.push(join(root, "supabase", "migrations", "20261031002800_learning_partners.sql"));
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8").replace(/^\s*(\/\/|\*|\/\*|--).*$/gm, "");
      if (/stripe|paypal|checkout|escrow|commission|invoice|payment_intent|payout|iban|card_number/i.test(text)) hits.push(f);
    }
    expect(hits).toEqual([]);
  });
  test("the schema stores no rating, review or statistic", () => {
    const body = MIGRATION.replace(/--.*$/gm, "");
    expect(body).not.toMatch(/rating|review_score|stars|testimonial|student_count|students_taught/i);
  });
});
