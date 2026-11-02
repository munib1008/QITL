// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Learning Partners (migration 20261031002800) against the real migrations and RLS: what anon sees, what members may
 * do by role, who moves a listing's status, pricing rules, inquiry consent and isolation, private documents, reports and
 * the audit trail. Every text is a labelled placeholder.
 */
let db: Db;
let owner: string, owner2: string, instructor: string, inbox: string, outsider: string, learner: string, learner2: string, moderator: string, admin: string, admin2: string;
let pid: string, pid2: string, pid3: string, svc: string, cat: string, svc2: string;

const SHORT = "Fixture provider short description, long enough.";
async function newPartner(who: string, slug: string) {
  // No RETURNING: the creator becomes a member in an AFTER trigger, so the row is selectable only afterwards.
  await db.as(who, "insert into public.learning_partners (slug, provider_type, display_name, country, city, languages, short_description) values ($1, 'quran_center', $2, 'GB', 'Fixture City', array['en','ar'], $3)", [slug, `Fixture ${slug}`, SHORT]);
  const [r] = await db.as<{ id: string }>(who, "select id from public.learning_partners where slug = $1", [slug]);
  return r!.id;
}
const submit = (who: string, id: string) => db.as(who, "select public.partner_transition($1, 'submitted')", [id]);
const transition = (who: string, id: string, to: string, note: string | null = null) => db.as(who, "select public.partner_transition($1, $2, $3)", [id, to, note]);
const addBasics = async (who: string, id: string) => {
  await db.as(who, "insert into public.partner_contact_methods (partner_id, kind, value) values ($1, 'email', 'o@example.test')", [id]);
  await db.as(who, "insert into public.partner_services (partner_id, category_id, title, mode, group_type, language) values ($1, $2, 'Fixture course', 'online', 'group', 'en')", [id, cat]);
};

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  owner = await db.createUser("owner@test.local");
  owner2 = await db.createUser("owner2@test.local");
  instructor = await db.createUser("instructor@test.local");
  inbox = await db.createUser("inbox@test.local");
  outsider = await db.createUser("outsider@test.local");
  learner = await db.createUser("learner@test.local");
  learner2 = await db.createUser("learner2@test.local");
  moderator = await db.createUser("mod@test.local", ["moderator"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  admin2 = await db.createUser("admin2@test.local", ["admin"]);
  cat = (await db.admin<{ id: string }>("select id from public.partner_service_categories where slug = 'tajweed'"))[0]!.id;

  pid = await newPartner(owner, "fixture-center");
  await db.as(owner, "insert into public.partner_members (partner_id, user_id, role) values ($1, $2, 'instructor'), ($1, $3, 'inquiry_manager')", [pid, instructor, inbox]);
  await db.as(owner, "insert into public.partner_contact_methods (partner_id, kind, value, is_public) values ($1, 'email', 'private@example.test', false), ($1, 'website', 'https://example.test/fixture', true)", [pid]);
  await db.as(instructor, "insert into public.partner_services (partner_id, category_id, title, level, mode, group_type, language, status) values ($1, $2, 'Fixture tajweed course', 'beginner', 'online', 'group', 'en', 'published')", [pid, cat]);
  svc = (await db.as<{ id: string }>(owner, "select id from public.partner_services where partner_id = $1", [pid]))[0]!.id;
  await db.as(instructor, "insert into public.partner_service_pricing (service_id, pricing_type, currency, amount, unit) values ($1, 'monthly', 'GBP', 40, 'month')", [svc]);
  await db.as(instructor, "insert into public.partner_service_availability (service_id, weekday, start_time, end_time, timezone) values ($1, 2, '18:00', '19:00', 'Europe/London')", [svc]);
  await db.as(owner, "insert into public.partner_qualifications (partner_id, title, issuer, show_publicly) values ($1, 'Fixture certificate', 'Fixture issuer', true)", [pid]);
  await db.as(owner, "insert into public.partner_qualifications (partner_id, title, issuer, show_publicly) values ($1, 'Fixture hidden certificate', 'Fixture issuer', false)", [pid]);

  pid2 = await newPartner(owner2, "fixture-second");
  await db.as(owner2, "insert into public.partner_contact_methods (partner_id, kind, value, is_public) values ($1, 'email', 'second@example.test', true)", [pid2]);
  await db.as(owner2, "insert into public.partner_services (partner_id, category_id, title, level, mode, group_type, language, status) values ($1, $2, 'Fixture second course', 'all_levels', 'in_person', 'individual', 'ar', 'published')", [pid2, cat]);
  svc2 = (await db.as<{ id: string }>(owner2, "select id from public.partner_services where partner_id = $1", [pid2]))[0]!.id;
}, 240_000);

describe("taxonomy", () => {
  test("seeded trilingually across the three tracks, readable by anon", async () => {
    const rows = await db.as<{ track: string; name_en: string; name_ar: string; name_ur: string }>(null, "select track, name_en, name_ar, name_ur from public.partner_service_categories where active");
    expect(new Set(rows.map((r) => r.track))).toEqual(new Set(["quran", "arabic", "islamic"]));
    expect(rows.every((r) => r.name_en && r.name_ar && r.name_ur)).toBe(true);
  });
  test("only an admin writes the taxonomy; merging moves services and retires the old category", async () => {
    const ins = "insert into public.partner_service_categories (slug, track, name_en, name_ar, name_ur) values ('fx_cat', 'quran', 'Fixture', 'تجربة', 'تجربہ')";
    await rejects(db.as(owner, ins), /row-level security/);
    await rejects(db.as(moderator, ins), /row-level security/);
    await db.as(admin, "insert into public.partner_service_categories (slug, track, name_en, name_ar, name_ur) values ('fx_old', 'quran', 'Fixture old', 'قديم', 'پرانا'), ('fx_new', 'quran', 'Fixture new', 'جديد', 'نیا')");
    const o = (await db.admin<{ id: string }>("select id from public.partner_service_categories where slug = 'fx_old'"))[0]!.id;
    const n = (await db.admin<{ id: string }>("select id from public.partner_service_categories where slug = 'fx_new'"))[0]!.id;
    await db.as(owner2, "insert into public.partner_services (partner_id, category_id, title, mode, group_type, language) values ($1, $2, 'Fixture merge probe', 'online', 'both', 'en')", [pid2, o]);
    await rejects(db.as(owner2, "select public.partner_merge_category($1, $2)", [o, n]), /only an administrator/);
    const [m] = await db.as<{ partner_merge_category: number }>(admin, "select public.partner_merge_category($1, $2)", [o, n]);
    expect(m!.partner_merge_category).toBe(1);
    expect(await db.admin("select 1 from public.partner_services where title = 'Fixture merge probe' and category_id = $1", [n])).toHaveLength(1);
    await rejects(db.as(owner2, "insert into public.partner_services (partner_id, category_id, title, mode, group_type, language) values ($1, $2, 'Fixture retired', 'online', 'both', 'en')", [pid2, o]), /active category/);
    expect(await db.admin("select 1 from public.partner_audit_logs where action = 'category_merged'")).toHaveLength(1);
  });
});

describe("what anon sees", () => {
  test("nothing of a draft listing: not the listing, services, pricing, availability, contacts or qualifications", async () => {
    for (const t of ["learning_partners", "partner_services", "partner_service_pricing", "partner_service_availability", "partner_contact_methods", "partner_qualifications", "partner_directory"]) {
      expect(await db.as(null, `select 1 from public.${t}`), t).toHaveLength(0);
    }
  });
  test("anon cannot read the member, document, note, inquiry, report or audit tables at all", async () => {
    for (const t of ["partner_members", "partner_qualification_files", "partner_review_notes", "partner_inquiries", "partner_inquiry_messages", "partner_reports", "partner_audit_logs"]) {
      await rejects(db.as(null, `select 1 from public.${t}`), /permission denied/);
    }
  });
  test("a listing cannot become approved without an administrator", async () => {
    await submit(owner, pid);
    await rejects(transition(owner, pid, "approved"), /only an administrator approves/);
    await rejects(transition(moderator, pid, "approved"), /only an administrator approves/);
    await rejects(db.as(owner, "update public.learning_partners set listing_status = 'approved' where id = $1", [pid]), /permission denied/);
    await rejects(db.as(admin, "update public.learning_partners set listing_status = 'approved' where id = $1", [pid]), /permission denied/);
    expect(await db.as(null, "select 1 from public.learning_partners")).toHaveLength(0);
  });
  test("once approved: the listing, published service, pricing, availability and PUBLIC contact are visible; private contact and hidden qualification are not", async () => {
    await transition(moderator, pid, "under_verification");
    await transition(admin, pid, "approved", "Fixture approval");
    await submit(owner2, pid2);
    await transition(admin, pid2, "approved");
    const dir = await db.as<{ slug: string; has_paid: boolean; has_free: boolean; service_count: number }>(null, "select slug, has_paid, has_free, service_count from public.partner_directory order by slug");
    expect(dir.map((d) => d.slug)).toEqual(["fixture-center", "fixture-second"]);
    expect(dir[0]).toMatchObject({ has_paid: true, has_free: false, service_count: 1 });
    expect(await db.as(null, "select 1 from public.partner_service_pricing")).toHaveLength(1);
    expect(await db.as(null, "select 1 from public.partner_service_availability")).toHaveLength(1);
    const contacts = await db.as<{ value: string }>(null, "select value from public.partner_contact_methods where partner_id = $1", [pid]);
    expect(contacts.map((c) => c.value)).toEqual(["https://example.test/fixture"]);
    const quals = await db.as<{ title: string; status: string }>(null, "select title, status from public.partner_qualifications where partner_id = $1", [pid]);
    expect(quals).toEqual([{ title: "Fixture certificate", status: "unverified" }]);
  });
  test("a non-member signed-in user sees the same public slice, never private contacts or the team", async () => {
    const contacts = await db.as<{ value: string }>(outsider, "select value from public.partner_contact_methods where partner_id = $1", [pid]);
    expect(contacts.map((c) => c.value)).toEqual(["https://example.test/fixture"]);
    expect(await db.as(outsider, "select 1 from public.partner_members")).toHaveLength(0);
  });
  test("draft and paused services of an approved listing are hidden from anon", async () => {
    await db.as(owner, "insert into public.partner_services (partner_id, category_id, title, mode, group_type, language, status) values ($1, $2, 'Fixture draft course', 'online', 'group', 'en', 'draft'), ($1, $2, 'Fixture paused course', 'online', 'group', 'en', 'paused')", [pid, cat]);
    expect(await db.as(null, "select 1 from public.partner_services where partner_id = $1", [pid])).toHaveLength(1);
  });
  test("a requested verification is not public until it is verified", async () => {
    await db.as(owner, "select public.partner_request_verification($1, 'identity')", [pid]);
    expect(await db.as(null, "select 1 from public.partner_verifications")).toHaveLength(0);
  });
});

describe("listing status, roles and re-review", () => {
  test("a provider cannot submit an incomplete listing", async () => {
    const id = await newPartner(outsider, "fixture-incomplete");
    await rejects(submit(outsider, id), /way to contact you/);
    await db.as(outsider, "insert into public.partner_contact_methods (partner_id, kind, value) values ($1, 'email', 'o@example.test')", [id]);
    await rejects(submit(outsider, id), /at least one service/);
    await db.as(outsider, "insert into public.partner_services (partner_id, category_id, title, mode, group_type, language) values ($1, $2, 'Fixture course', 'online', 'group', 'en')", [id, cat]);
    await submit(outsider, id);
    expect(await db.admin("select 1 from public.learning_partners where id = $1 and listing_status = 'submitted' and submitted_at is not null", [id])).toHaveLength(1);
  });
  test("a moderator requests changes but cannot approve or reject; a reason is required; the provider is told with a path only", async () => {
    pid3 = await newPartner(owner2, "fixture-third");
    await addBasics(owner2, pid3);
    await submit(owner2, pid3);
    await rejects(transition(moderator, pid3, "changes_requested"), /say why/);
    await transition(moderator, pid3, "changes_requested", "Please clarify the service area.");
    await rejects(transition(moderator, pid3, "rejected", "Fixture no."), /cannot move/);
    const notes = await db.as<{ note: string }>(owner2, "select note from public.partner_review_notes where partner_id = $1", [pid3]);
    expect(notes.map((n) => n.note)).toEqual(["Please clarify the service area."]);
    const told = await db.as<{ title: string | null; link: string }>(owner2, "select title, link from public.notifications where kind = 'partner_listing'");
    expect(told.every((t) => t.title === null && t.link === "/partners/dashboard")).toBe(true);
    expect(told.length).toBeGreaterThanOrEqual(1);
    await submit(owner2, pid3);
    await rejects(transition(owner2, pid3, "under_verification"), /cannot move/);
    await transition(admin, pid3, "rejected", "Fixture rejection reason.");
    expect(await db.admin("select 1 from public.learning_partners where id = $1 and listing_status = 'rejected'", [pid3])).toHaveLength(1);
  });
  test("a provider cannot suspend; an outsider, a mere instructor and anon cannot move anything", async () => {
    await rejects(transition(owner, pid, "suspended", "Fixture reason"), /cannot move/);
    await rejects(transition(outsider, pid, "draft"), /not allowed/);
    await rejects(transition(instructor, pid, "draft"), /not allowed/);
    await rejects(db.as(null, "select public.partner_transition($1, 'draft', null)", [pid]), /permission denied/);
  });
  test("staff cannot decide a listing they belong to", async () => {
    const id = await newPartner(admin2, "fixture-admin-owned");
    await addBasics(admin2, id);
    await submit(admin2, id);
    await rejects(transition(admin2, id, "approved"), /cannot decide a listing they are a member of/);
    await transition(admin, id, "approved");
  });
  test("editing the identity of an approved listing sends it back to review and out of the directory; other edits do not", async () => {
    await db.as(owner, "update public.learning_partners set service_area = 'Fixture region' where id = $1", [pid]);
    expect(await db.admin("select 1 from public.learning_partners where id = $1 and listing_status = 'approved'", [pid])).toHaveLength(1);
    await db.as(owner, "update public.learning_partners set short_description = 'Fixture changed description, still long enough.' where id = $1", [pid]);
    const [r] = await db.admin<{ listing_status: string }>("select listing_status from public.learning_partners where id = $1", [pid]);
    expect(r!.listing_status).toBe("submitted");
    expect(await db.as(null, "select 1 from public.partner_directory where id = $1", [pid])).toHaveLength(0);
    expect(await db.admin("select 1 from public.partner_audit_logs where partner_id = $1 and action = 'key_edit_rereview'", [pid])).toHaveLength(1);
    await transition(admin, pid, "approved");
    expect(await db.as(null, "select 1 from public.partner_directory where id = $1", [pid])).toHaveLength(1);
  });
  test("a member of one listing edits nothing of another; instructors edit services but not the profile or contacts; inquiry managers edit nothing", async () => {
    await db.as(owner2, "update public.learning_partners set service_area = 'Fixture hijack' where id = $1", [pid]);
    await db.as(instructor, "update public.learning_partners set service_area = 'Fixture hijack' where id = $1", [pid]);
    await db.as(inbox, "update public.partner_services set title = 'Fixture hijack' where id = $1", [svc]);
    await db.as(owner2, "update public.partner_services set title = 'Fixture hijack' where id = $1", [svc]);
    expect(await db.admin("select 1 from public.learning_partners where id = $1 and service_area = 'Fixture hijack'", [pid])).toHaveLength(0);
    expect(await db.admin("select 1 from public.partner_services where id = $1 and title = 'Fixture hijack'", [svc])).toHaveLength(0);
    await rejects(db.as(instructor, "insert into public.partner_contact_methods (partner_id, kind, value) values ($1, 'email', 'i@example.test')", [pid]), /row-level security/);
    await rejects(db.as(owner2, "insert into public.partner_services (partner_id, category_id, title, mode, group_type, language) values ($1, $2, 'Fixture hijack', 'online', 'group', 'en')", [pid, cat]), /row-level security/);
    await db.as(instructor, "update public.partner_services set title = 'Fixture renamed course' where id = $1", [svc]);
    expect(await db.admin("select 1 from public.partner_services where id = $1 and title = 'Fixture renamed course'", [svc])).toHaveLength(1);
  });
  test("private contacts: the owner and inquiry manager read them; an instructor does not", async () => {
    expect(await db.as(instructor, "select 1 from public.partner_contact_methods where partner_id = $1 and not is_public", [pid])).toHaveLength(0);
    expect(await db.as(inbox, "select 1 from public.partner_contact_methods where partner_id = $1 and not is_public", [pid])).toHaveLength(1);
    expect(await db.as(owner, "select 1 from public.partner_contact_methods where partner_id = $1 and not is_public", [pid])).toHaveLength(1);
  });
  test("only the owner manages the team; the owner cannot be removed; a member can leave", async () => {
    await rejects(db.as(instructor, "insert into public.partner_members (partner_id, user_id, role) values ($1, $2, 'admin')", [pid, outsider]), /row-level security/);
    await rejects(db.as(owner, "insert into public.partner_members (partner_id, user_id, role) values ($1, $2, 'owner')", [pid, outsider]), /row-level security/);
    await db.as(owner, "delete from public.partner_members where partner_id = $1 and role = 'owner'", [pid]);
    expect(await db.admin("select 1 from public.partner_members where partner_id = $1 and role = 'owner'", [pid])).toHaveLength(1);
    await db.as(owner, "insert into public.partner_members (partner_id, user_id, role) values ($1, $2, 'instructor')", [pid, outsider]);
    await db.as(outsider, "delete from public.partner_members where partner_id = $1 and user_id = $2", [pid, outsider]);
    expect(await db.admin("select 1 from public.partner_members where partner_id = $1 and user_id = $2", [pid, outsider])).toHaveLength(0);
  });
  test("staff reaching private data is audited; only an admin reads the audit log", async () => {
    await db.as(moderator, "select public.partner_log_access($1, 'contacts')", [pid]);
    await rejects(db.as(owner, "select public.partner_log_access($1, 'contacts')", [pid]), /not allowed/);
    expect(await db.as(admin, "select 1 from public.partner_audit_logs where partner_id = $1 and action = 'staff_viewed_contacts'", [pid])).toHaveLength(1);
    expect(await db.as(moderator, "select 1 from public.partner_audit_logs")).toHaveLength(0);
    expect(await db.as(owner, "select 1 from public.partner_audit_logs")).toHaveLength(0);
    expect(await db.admin("select 1 from public.partner_audit_logs where action = 'status_approved'")).not.toHaveLength(0);
  });
  test("the address of a published listing does not change; a draft is deleted by its owner only", async () => {
    await rejects(db.as(owner, "update public.learning_partners set slug = 'fixture-renamed' where id = $1", [pid]), /address of a published listing/);
    const id = await newPartner(learner2, "fixture-to-delete");
    await db.as(owner2, "delete from public.learning_partners where id = $1", [id]);
    expect(await db.admin("select 1 from public.learning_partners where id = $1", [id])).toHaveLength(1);
    await db.as(learner2, "delete from public.learning_partners where id = $1", [id]);
    expect(await db.admin("select 1 from public.learning_partners where id = $1", [id])).toHaveLength(0);
  });
});

describe("pricing", () => {
  const price = (cols: string, vals: unknown[]) =>
    db.as(owner, `insert into public.partner_service_pricing (service_id, ${cols}) values ($1, ${vals.map((_, i) => `$${i + 2}`).join(", ")})`, [svc, ...vals]);
  test("free, donation and on-request carry no amount, currency, unit or fee", async () => {
    for (const t of ["free", "donation", "on_request"]) {
      await price("pricing_type", [t]);
      await rejects(price("pricing_type, amount", [t, 10]), /partner_pricing_no_amount/);
      await rejects(price("pricing_type, currency", [t, "GBP"]), /partner_pricing_no_amount/);
      await rejects(price("pricing_type, registration_fee", [t, 5]), /partner_pricing_no_amount/);
    }
  });
  test("every priced type needs an amount, a currency and its matching unit; a package needs two or more classes", async () => {
    await rejects(price("pricing_type", ["hourly"]), /partner_pricing_priced/);
    await rejects(price("pricing_type, amount, currency", ["hourly", 20, "GBP"]), /partner_pricing_priced/);
    await rejects(price("pricing_type, amount, currency, unit", ["hourly", 20, "GBP", "month"]), /partner_pricing_priced/);
    await rejects(price("pricing_type, amount, currency, unit", ["hourly", 0, "GBP", "hour"]), /check/);
    await rejects(price("pricing_type, amount, currency, unit", ["hourly", -3, "GBP", "hour"]), /check/);
    await rejects(price("pricing_type, amount, currency, unit", ["hourly", 20, "gbp", "hour"]), /check/);
    await price("pricing_type, amount, currency, unit, registration_fee, fees_note", ["hourly", 20, "GBP", "hour", 10, "Fixture registration fee"]);
    await rejects(price("pricing_type, amount, currency, unit, classes_included", ["package", 100, "USD", "package", 1]), /partner_pricing_package/);
    await rejects(price("pricing_type, amount, currency, unit", ["package", 100, "USD", "package"]), /partner_pricing_package/);
    await price("pricing_type, amount, currency, unit, classes_included", ["package", 100, "USD", "package", 10]);
  });
  test("only the service's own managers write pricing", async () => {
    for (const who of [owner2, inbox, learner]) {
      await rejects(db.as(who, "insert into public.partner_service_pricing (service_id, pricing_type) values ($1, 'free')", [svc]), /row-level security/);
    }
  });
});

describe("qualifications, documents and the three verifications", () => {
  test("a provider cannot set a verdict; editing a claim drops a verdict; staff verify it", async () => {
    const q = (await db.as<{ id: string }>(owner, "select id from public.partner_qualifications where title = 'Fixture certificate'"))[0]!.id;
    await rejects(db.as(owner, "update public.partner_qualifications set status = 'verified' where id = $1", [q]), /permission denied/);
    await rejects(db.as(owner, "insert into public.partner_qualifications (partner_id, title, status) values ($1, 'Fixture self verified', 'verified')", [pid]), /permission denied/);
    await rejects(db.as(owner, "select public.partner_review_qualification($1, 'verified')", [q]), /not allowed/);
    await db.as(moderator, "select public.partner_review_qualification($1, 'verified', 'Fixture check done.')", [q]);
    const status = async () => (await db.as<{ status: string }>(null, "select status from public.partner_qualifications where id = $1", [q]))[0]!.status;
    expect(await status()).toBe("verified");
    await db.as(owner, "update public.partner_qualifications set show_publicly = true where id = $1", [q]);
    expect(await status()).toBe("verified");
    await db.as(owner, "update public.partner_qualifications set title = 'Fixture certificate (changed)' where id = $1", [q]);
    expect(await status()).toBe("unverified");
  });
  test("evidence files are readable by that provider's owner/admin and staff only", async () => {
    const q = (await db.as<{ id: string }>(owner, "select id from public.partner_qualifications where title like 'Fixture certificate%'"))[0]!.id;
    const ins = (who: string, partner: string, path: string) =>
      db.as(who, "insert into public.partner_qualification_files (qualification_id, partner_id, storage_path, mime_type, size_bytes) values ($1, $2, $3, 'application/pdf', 1000)", [q, partner, path]);
    await ins(owner, pid, `${pid}/ijazah.pdf`);
    await rejects(ins(owner, pid, `${pid2}/x.pdf`), /check/);
    await rejects(ins(owner, pid, `${pid}/../x.pdf`), /check/);
    await rejects(ins(owner2, pid2, `${pid2}/y.pdf`), /row-level security/);
    await rejects(db.as(null, "select 1 from public.partner_qualification_files"), /permission denied/);
    for (const who of [outsider, owner2, instructor, inbox, learner]) expect(await db.as(who, "select 1 from public.partner_qualification_files"), who).toHaveLength(0);
    expect(await db.as(owner, "select 1 from public.partner_qualification_files")).toHaveLength(1);
    expect(await db.as(moderator, "select 1 from public.partner_qualification_files")).toHaveLength(1);
  });
  test("identity, qualifications and religious/scholarly verification are separate; none implies another", async () => {
    await db.as(owner, "select public.partner_request_verification($1, 'qualifications')", [pid]);
    await db.as(owner, "select public.partner_request_verification($1, 'religious_scholarly')", [pid]);
    await rejects(db.as(owner, "select public.partner_request_verification($1, 'identity')", [pid]), /already/);
    await rejects(db.as(owner, "select public.partner_decide_verification($1, 'identity', 'verified', 'Fixture note', 'Fixture scope')", [pid]), /not allowed/);
    await db.as(moderator, "select public.partner_decide_verification($1, 'identity', 'in_review', null)", [pid]);
    await rejects(db.as(moderator, "select public.partner_decide_verification($1, 'identity', 'verified', 'Fixture note done', null)", [pid]), /exactly what was verified/);
    await db.as(moderator, "select public.partner_decide_verification($1, 'identity', 'verified', 'Fixture note done', 'Fixture: name matched a document')", [pid]);
    await rejects(db.as(moderator, "select public.partner_decide_verification($1, 'religious_scholarly', 'verified', 'Fixture note done', 'Fixture scope here')", [pid]), /only an administrator/);
    const pub = await db.as<{ kind: string; status: string; scope_statement: string }>(null, "select kind, status, scope_statement from public.partner_verifications where partner_id = $1", [pid]);
    expect(pub).toEqual([{ kind: "identity", status: "verified", scope_statement: "Fixture: name matched a document" }]);
    await db.as(admin, "select public.partner_decide_verification($1, 'religious_scholarly', 'rejected', 'Fixture decision', null)", [pid]);
    expect(await db.as(null, "select 1 from public.partner_verifications where partner_id = $1", [pid])).toHaveLength(1);
    expect(await db.as(owner, "select 1 from public.partner_verifications where partner_id = $1", [pid])).toHaveLength(3);
    expect(await db.as(owner2, "select 1 from public.partner_verifications where partner_id = $1 and status <> 'verified'", [pid])).toHaveLength(0);
    await rejects(db.as(owner, "update public.partner_verifications set status = 'verified' where partner_id = $1", [pid]), /permission denied/);
  });
});

describe("inquiries", () => {
  let inq: string;
  const send = (who: string, partner: string, over: Partial<{ message: string; consent: boolean }> = {}) =>
    db.as<{ id: string }>(who, "insert into public.partner_inquiries (partner_id, service_id, subject, message, consent, consent_version, learner_alias) values ($1, $2, 'Fixture inquiry subject', $3, $4, 'v1', 'Fixture learner') returning id",
      [partner, partner === pid ? svc : svc2, over.message ?? "Fixture inquiry message, long enough.", over.consent ?? true]);
  test("consent is required", async () => {
    await rejects(send(learner, pid, { consent: false }), /check|row-level/);
    expect(await db.admin("select 1 from public.partner_inquiries")).toHaveLength(0);
  });
  test("a learner sends an inquiry; the provider's authorised members, the learner and staff see it; others do not", async () => {
    inq = (await send(learner, pid))[0]!.id;
    for (const who of [learner, owner, inbox, moderator, admin]) expect(await db.as(who, "select 1 from public.partner_inquiries where id = $1", [inq]), who).toHaveLength(1);
    for (const who of [instructor, outsider, learner2, owner2]) expect(await db.as(who, "select 1 from public.partner_inquiries where id = $1", [inq]), who).toHaveLength(0);
    await rejects(db.as(null, "select 1 from public.partner_inquiries"), /permission denied/);
  });
  test("no cross-provider leakage: another provider's inbox is empty of it and cannot answer or change it", async () => {
    await send(learner2, pid2, { message: "Fixture second inquiry message." });
    expect(await db.as(owner2, "select 1 from public.partner_inquiries")).toHaveLength(1);
    expect(await db.as(owner, "select 1 from public.partner_inquiries")).toHaveLength(1);
    await rejects(db.as(owner2, "insert into public.partner_inquiry_messages (inquiry_id, body) values ($1, 'Fixture intrusion')", [inq]), /not allowed|row-level security/);
    await db.as(owner2, "update public.partner_inquiries set status = 'spam' where id = $1", [inq]);
    expect(await db.admin("select 1 from public.partner_inquiries where id = $1 and status = 'new'", [inq])).toHaveLength(1);
  });
  test("a member cannot inquire at their own listing; the provider must be approved; the service must belong to it", async () => {
    await rejects(db.as(owner, "insert into public.partner_inquiries (partner_id, subject, message, consent, consent_version) values ($1, 'Fixture self', 'Fixture message long enough', true, 'v1')", [pid]), /own listing/);
    const draft = await newPartner(instructor, "fixture-draft-target");
    await rejects(db.as(learner, "insert into public.partner_inquiries (partner_id, subject, message, consent, consent_version) values ($1, 'Fixture draft', 'Fixture message long enough', true, 'v1')", [draft]), /not accepting/);
    await rejects(db.as(learner, "insert into public.partner_inquiries (partner_id, service_id, subject, message, consent, consent_version) values ($1, $2, 'Fixture mismatch', 'Fixture message long enough', true, 'v1')", [pid, svc2]), /not offered/);
    await rejects(db.as(learner, "insert into public.partner_inquiries (partner_id, learner_id, subject, message, consent, consent_version) values ($1, $2, 'Fixture forged', 'Fixture message long enough', true, 'v1')", [pid, learner2]), /permission denied/);
  });
  test("a provider reply moves it to responded and tells the learner (a path only); the learner can reply and close", async () => {
    await db.as(inbox, "update public.partner_inquiries set status = 'viewed' where id = $1", [inq]);
    await db.as(inbox, "insert into public.partner_inquiry_messages (inquiry_id, body) values ($1, 'Fixture provider reply')", [inq]);
    expect(await db.admin("select 1 from public.partner_inquiries where id = $1 and status = 'responded'", [inq])).toHaveLength(1);
    expect(await db.as(learner, "select kind, title, link from public.notifications where kind = 'partner_reply'")).toEqual([{ kind: "partner_reply", title: null, link: "/partners/inquiries" }]);
    await db.as(learner, "insert into public.partner_inquiry_messages (inquiry_id, body) values ($1, 'Fixture learner reply')", [inq]);
    const msgs = await db.as<{ sender_side: string }>(learner, "select sender_side from public.partner_inquiry_messages where inquiry_id = $1 order by created_at, id", [inq]);
    expect(msgs.map((m) => m.sender_side)).toEqual(["partner", "learner"]);
    expect(await db.as(learner2, "select 1 from public.partner_inquiry_messages")).toHaveLength(0);
    expect(await db.as(instructor, "select 1 from public.partner_inquiry_messages")).toHaveLength(0);
    await rejects(db.as(learner, "update public.partner_inquiries set status = 'spam' where id = $1", [inq]), /only close/);
    await rejects(db.as(inbox, "update public.partner_inquiries set status = 'new' where id = $1", [inq]), /not available/);
    await rejects(db.as(inbox, "update public.partner_inquiries set message = 'Fixture edited message' where id = $1", [inq]), /permission denied/);
    await db.as(learner, "update public.partner_inquiries set status = 'closed' where id = $1", [inq]);
    await rejects(db.as(inbox, "insert into public.partner_inquiry_messages (inquiry_id, body) values ($1, 'Fixture late')", [inq]), /closed/);
  });
  test("the owner and inquiry manager were notified with a path only; an instructor was not", async () => {
    expect((await db.as(owner, "select title, link from public.notifications where kind = 'partner_inquiry'"))[0]).toEqual({ title: null, link: "/partners/dashboard/inquiries" });
    expect((await db.as(inbox, "select 1 from public.notifications where kind = 'partner_inquiry'")).length).toBeGreaterThan(0);
    expect(await db.as(instructor, "select 1 from public.notifications where kind = 'partner_inquiry'")).toHaveLength(0);
  });
  test("spam guards: link stuffing, duplicates and rate limits", async () => {
    await rejects(send(outsider, pid, { message: "Fixture http://a.test http://b.test http://c.test spam" }), /too many links/);
    await send(outsider, pid, { message: "Fixture unique message one" });
    await rejects(send(outsider, pid, { message: "Fixture unique message one" }), /already sent/);
    await send(outsider, pid, { message: "Fixture unique message two" });
    await rejects(send(outsider, pid, { message: "Fixture unique message three" }), /rate_limited/);
  });
});

describe("reports", () => {
  test("a signed-in user reports a published listing; the provider never sees who; staff handle it in order", async () => {
    await db.as(learner2, "insert into public.partner_reports (partner_id, reason, details) values ($1, 'misleading_claims', 'Fixture report details')", [pid]);
    await rejects(db.as(learner2, "insert into public.partner_reports (partner_id, reason) values ($1, 'other')", [pid]), /duplicate|unique/);
    await rejects(db.as(owner, "insert into public.partner_reports (partner_id, reason) values ($1, 'other')", [pid]), /own listing/);
    expect(await db.as(owner, "select 1 from public.partner_reports")).toHaveLength(0);
    expect(await db.as(learner, "select 1 from public.partner_reports")).toHaveLength(0);
    expect(await db.as(learner2, "select 1 from public.partner_reports")).toHaveLength(1);
    expect(await db.as(moderator, "select 1 from public.partner_reports")).toHaveLength(1);
    await db.as(learner2, "update public.partner_reports set status = 'dismissed', decision_note = 'Fixture self dismissal' where partner_id = $1", [pid]);
    const id = (await db.admin<{ id: string }>("select id from public.partner_reports limit 1"))[0]!.id;
    expect(await db.admin("select 1 from public.partner_reports where id = $1 and status = 'open'", [id])).toHaveLength(1);
    await db.as(moderator, "update public.partner_reports set status = 'reviewing' where id = $1", [id]);
    await db.as(moderator, "update public.partner_reports set status = 'actioned', decision_note = 'Fixture action taken' where id = $1", [id]);
    expect(await db.admin("select 1 from public.partner_reports where id = $1 and status = 'actioned' and handled_by = $2", [id, moderator])).toHaveLength(1);
    await rejects(db.as(moderator, "update public.partner_reports set status = 'reviewing' where id = $1", [id]), /moves open/);
    expect(await db.admin("select 1 from public.partner_audit_logs where action = 'report_actioned'")).toHaveLength(1);
  });
});

describe("suspension", () => {
  test("a moderator can suspend a published listing at once; it leaves the directory and cannot take inquiries; the owner cannot edit it; only an admin reinstates it", async () => {
    await transition(moderator, pid2, "suspended", "Fixture safety suspension");
    expect(await db.as(null, "select 1 from public.partner_directory where id = $1", [pid2])).toHaveLength(0);
    expect(await db.as(null, "select 1 from public.partner_services where partner_id = $1", [pid2])).toHaveLength(0);
    await rejects(db.as(learner, "insert into public.partner_inquiries (partner_id, subject, message, consent, consent_version) values ($1, 'Fixture suspended', 'Fixture message long enough', true, 'v1')", [pid2]), /not accepting/);
    await db.as(owner2, "update public.learning_partners set service_area = 'Fixture edit' where id = $1", [pid2]);
    expect(await db.admin("select 1 from public.learning_partners where id = $1 and service_area = 'Fixture edit'", [pid2])).toHaveLength(0);
    await rejects(transition(moderator, pid2, "approved"), /only an administrator/);
    await transition(admin, pid2, "approved");
    expect(await db.as(null, "select 1 from public.partner_directory where id = $1", [pid2])).toHaveLength(1);
  });
});
