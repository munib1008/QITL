// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  AliasSchema,
  ClassificationSchema,
  ENCYCLOPEDIA_KINDS,
  ListQuerySchema,
  PersonClaimSchema,
  allowedKinds,
  kindIssue,
  likeTerm,
  personPublishHints,
  plainRefusal,
  quranRefs,
  trackFor,
} from "@/lib/people-admin/form";
import { peopleAdminStrings } from "@/lib/i18n/modules/peopleAdmin";

vi.mock("server-only", () => ({}));

const id = "00000000-0000-4000-8000-000000000001";

describe("kinds and tracks mirror the database", () => {
  test("a prophet is only filed as a prophet; a non-prophet is never a prophet", () => {
    expect(allowedKinds("prophet")).toEqual(["prophet"]);
    expect(allowedKinds("companion")).toEqual(["individual", "family_member", "ruler", "unnamed"]);
    for (const k of ["companion", "ahl_al_bayt", "scholar", "historical", "other"]) expect(allowedKinds(k)).not.toContain("prophet");
    expect(ENCYCLOPEDIA_KINDS).toHaveLength(5);
  });
  test("kindIssue is people_prophet_label and people_prophet_group", () => {
    expect(kindIssue("other", "prophet")).toBe("prophet_label");
    expect(kindIssue("prophet", "ruler")).toBe("prophet_group");
    expect(kindIssue("prophet", "prophet")).toBeNull();
    expect(kindIssue("prophet", null)).toBeNull();
    expect(kindIssue("other", "ruler")).toBeNull();
    expect(kindIssue("other", null)).toBeNull();
  });
  test("the subject item is on the matching track", () => {
    expect(trackFor("person", "prophet")).toBe("prophets");
    expect(trackFor("person", "other")).toBe("people");
    expect(trackFor("community")).toBe("communities");
  });
});

describe("request schemas", () => {
  test("a classification changes something, and only a person has a kind", () => {
    expect(ClassificationSchema.safeParse({ scope: "person", id }).success).toBe(false);
    expect(ClassificationSchema.safeParse({ scope: "person", id, encyclopediaKind: null }).success).toBe(true);
    expect(ClassificationSchema.safeParse({ scope: "person", id, encyclopediaKind: "king" }).success).toBe(false);
    expect(ClassificationSchema.safeParse({ scope: "community", id, subjectEventId: id }).success).toBe(true);
    expect(ClassificationSchema.safeParse({ scope: "community", id, encyclopediaKind: "ruler" }).success).toBe(false);
    expect(ClassificationSchema.safeParse({ scope: "person", id: "not-a-uuid", subjectEventId: null }).success).toBe(false);
  });
  test("aliases are short and the language is a code", () => {
    expect(AliasSchema.parse({ personId: id, alias: "  Name ", language: "AR" })).toEqual({ personId: id, alias: "Name", language: "ar" });
    expect(AliasSchema.safeParse({ personId: id, alias: " ", language: "en" }).success).toBe(false);
    expect(AliasSchema.safeParse({ personId: id, alias: "x", language: "english" }).success).toBe(false);
  });
  test("a person claim names an existing claim by id; there is no verse field", () => {
    expect(PersonClaimSchema.safeParse({ personId: id, claimId: id }).success).toBe(true);
    expect(PersonClaimSchema.safeParse({ personId: id, claimId: "free text" }).success).toBe(false);
    expect(Object.keys(PersonClaimSchema.shape)).toEqual(["personId", "claimId", "position"]);
  });
  test("list queries default to people and refuse unknown views and tracks", () => {
    expect(ListQuerySchema.parse({ view: "list" }).scope).toBe("person");
    expect(ListQuerySchema.safeParse({ view: "drop" }).success).toBe(false);
    expect(ListQuerySchema.safeParse({ view: "events", track: "events" }).success).toBe(false);
  });
  test("search terms carry no wildcard or filter syntax", () => {
    expect(likeTerm("a%b_c,(d)*\\e")).toBe("a b c d e");
    expect(likeTerm("  ")).toBeNull();
    expect(likeTerm(undefined)).toBeNull();
  });
});

describe("claims", () => {
  test("only Quran references are shown, as surah:ayah or a range", () => {
    expect(
      quranRefs([
        { kind: "quran", quran_surah: 12, quran_ayah_from: 3, quran_ayah_to: null },
        { kind: "quran", quran_surah: 2, quran_ayah_from: 255, quran_ayah_to: 257 },
        { kind: "quran", quran_surah: 5, quran_ayah_from: 4, quran_ayah_to: 4 },
        { kind: "hadith", quran_surah: null, quran_ayah_from: null, quran_ayah_to: null },
      ]),
    ).toEqual(["12:3", "2:255-257", "5:4"]);
    expect(quranRefs(null)).toEqual([]);
  });
  test("publish hints: no evidence, unapproved claims, needs review; nothing for a published record", () => {
    const base = { status: "draft", encyclopediaKind: "ruler", subjectEventId: null, claimStatuses: [] as string[], reviewDecision: null as string | null };
    expect(personPublishHints(base)).toEqual(["no_claims", "needs_review"]);
    expect(personPublishHints({ ...base, claimStatuses: ["approved", "draft"] })).toEqual(["unapproved_claims", "needs_review"]);
    expect(personPublishHints({ ...base, claimStatuses: ["approved", "published"], reviewDecision: "approved" })).toEqual([]);
    expect(personPublishHints({ ...base, encyclopediaKind: null, reviewDecision: "approved" })).toEqual([]);
    expect(personPublishHints({ ...base, status: "published" })).toEqual([]);
  });
});

describe("database refusals in plain words", () => {
  test("a guard's own message is shown whole", () => {
    expect(plainRefusal({ code: "P0001", message: "no evidence, no publish: person x has no evidence claim" })).toEqual({ status: 422, code: "rule", message: "no evidence, no publish: person x has no evidence claim" });
    expect(plainRefusal({ code: "P0001", message: "no review, no publish: person x lacks a scholarly approval" })?.message).toMatch(/^no review, no publish/);
  });
  test("constraints get a plain sentence", () => {
    expect(plainRefusal({ code: "23514", message: 'new row for relation "people" violates check constraint "people_prophet_label"' })?.message).toMatch(/Only a person whose kind is prophet/);
    expect(plainRefusal({ code: "23514", message: 'violates check constraint "people_prophet_group"' })?.message).toMatch(/never filed under another group/);
    expect(plainRefusal({ code: "23505", message: 'duplicate key value violates unique constraint "people_subject_event"' })).toMatchObject({ status: 409, code: "subject_taken" });
    expect(plainRefusal({ code: "23505", message: 'violates unique constraint "person_claims_person_id_claim_id_key"' })?.code).toBe("claim_taken");
  });
  test("anything else is left to the shared mapping", () => {
    expect(plainRefusal({ code: "42501", message: "permission denied" })).toBeNull();
    expect(plainRefusal(null)).toBeNull();
  });
});

describe("strings: Arabic and Urdu have every key the English has", () => {
  const keys = (o: unknown, p = ""): string[] => (typeof o === "object" && o !== null && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p]);
  test("shape", () => {
    const en = keys(peopleAdminStrings("en")).sort();
    expect(keys(peopleAdminStrings("ar")).sort()).toEqual(en);
    expect(keys(peopleAdminStrings("ur")).sort()).toEqual(en);
    expect(peopleAdminStrings("ar").people.title).not.toBe(peopleAdminStrings("en").people.title);
    expect(peopleAdminStrings("ur").rules.items).toHaveLength(peopleAdminStrings("en").rules.items.length);
  });
});

describe("routes: same-site only, database required", () => {
  beforeEach(() => {
    for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) vi.stubEnv(k, "");
  });
  const ORIGIN = "http://localhost:3000";
  const req = (path: string, method: string, body?: unknown, origin = ORIGIN) =>
    new NextRequest(`${ORIGIN}${path}`, { method, headers: { origin, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  test.each([
    ["people", "POST"],
    ["people/aliases", "POST"],
    ["people/aliases", "DELETE"],
    ["people/claims", "POST"],
    ["people/claims", "DELETE"],
    ["people/status", "POST"],
  ])("%s %s refuses a cross-site request, then needs the database", async (path, method) => {
    const mod = (await import(`@/app/api/admin/${path}/route`)) as Record<string, (r: NextRequest) => Promise<Response>>;
    const cross = await mod[method]!(req(`/api/admin/${path}`, method, {}, "https://evil.example"));
    expect(cross.status).toBe(403);
    expect(((await cross.json()) as { code: string }).code).toBe("bad_origin");
    const same = await mod[method]!(req(`/api/admin/${path}`, method, {}));
    expect(same.status).toBe(503);
  });
  test("GET answers 503 without a database and 422 for a bad query", async () => {
    const { GET } = await import("@/app/api/admin/people/route");
    expect((await GET(req("/api/admin/people?view=list", "GET"))).status).toBe(503);
    expect((await GET(req("/api/admin/people?view=events&track=people", "GET"))).status).toBe(503);
    expect((await GET(req("/api/admin/people?view=bogus", "GET"))).status).toBe(422);
  });
});
