// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Mufti Q&A notifications and the scholar application (migrations 20261031002600 and 20261031002610), against the real
 * migrations and RLS: own rows only, who is told what (a title and a path, never an answer or a note), the application's
 * status path, and that applying grants nothing. Every text is a labelled placeholder.
 */
let db: Db;
let alice: string, bob: string, admin: string, moderator: string, reviewer: string, mufti: string, mufti2: string;
let qPublic: string;

const OK_APP = [
  "Fixture Applicant",
  "Fixture credentials: placeholder text, at least twenty characters long.",
  "hanafi",
  "Fixture field",
  ["https://example.test/fixture-profile"],
  "v1",
];
const apply = (who: string) =>
  db.as<{ id: string }>(
    who,
    "insert into public.mufti_applications (applicant_id, applicant_name, credentials_md, madhhab, field, links, consent_version) values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [who, ...OK_APP],
  );

async function verifiedMufti(email: string) {
  const id = await db.createUser(email, ["mufti"]);
  await db.as(id, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture scholar', 'Fixture credentials')", [id]);
  await db.as(admin, "update public.mufti_profiles set verified_by = $2, verified_at = now() where user_id = $1", [id, admin]);
  return id;
}
const inbox = (u: string) => db.as<{ kind: string; title: string | null; link: string | null; channel: string; read_at: string | null }>(u, "select kind, title, link, channel, read_at from public.notifications order by created_at, id");

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  alice = await db.createUser("alice@test.local");
  bob = await db.createUser("bob@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  moderator = await db.createUser("mod@test.local", ["moderator"]);
  reviewer = await db.createUser("rev@test.local", ["scholarly_reviewer"]);
  mufti = await verifiedMufti("m1@test.local");
  mufti2 = await verifiedMufti("m2@test.local");
  const [q] = await db.as<{ id: string }>(alice, "insert into public.mufti_questions (asker_id, title, body) values ($1, 'Fixture notification question', 'A fixture question body long enough.') returning id", [alice]);
  qPublic = q!.id;
}, 240_000);

describe("notifications: who is told, and what", () => {
  test("assigning a mufti tells that mufti, with a title and a path only", async () => {
    await db.as(moderator, "update public.mufti_questions set status = 'accepted' where id = $1", [qPublic]);
    await db.as(admin, "insert into public.mufti_assignments (question_id, mufti_id, assigned_by) values ($1, $2, $3)", [qPublic, mufti, admin]);
    const rows = await inbox(mufti);
    expect(rows).toEqual([{ kind: "mufti_assigned", title: "Fixture notification question", link: `/mufti/questions/${qPublic}`, channel: "in_app", read_at: null }]);
    expect(await inbox(mufti2)).toEqual([]);
    expect(await inbox(alice)).toEqual([]);
  });

  test("a published answer tells the asker; an unpublished one does not", async () => {
    const [a] = await db.as<{ id: string }>(mufti, "insert into public.mufti_answers (question_id, mufti_id, body_md, status) values ($1, $2, 'Fixture answer body that is long enough.', 'submitted') returning id", [qPublic, mufti]);
    expect(await inbox(alice)).toEqual([]);
    await db.as(mufti, "insert into public.mufti_answer_citations (answer_id, kind, work) values ($1, 'scholar', 'Fixture work')", [a!.id]);
    await db.as(reviewer, "insert into public.mufti_answer_reviews (answer_id, answer_version, reviewer_id, decision) values ($1, 1, $2, 'approved')", [a!.id, reviewer]);
    expect(await inbox(alice)).toEqual([]); // approved is not published
    await db.as(mufti, "update public.mufti_answers set status = 'published' where id = $1", [a!.id]);
    const rows = await inbox(alice);
    expect(rows).toEqual([{ kind: "mufti_answered", title: "Fixture notification question", link: `/community/questions/${qPublic}`, channel: "in_app", read_at: null }]);
    // Nothing of the answer travels in the notification.
    expect(JSON.stringify(rows)).not.toMatch(/answer body|Fixture work/);
  });

  test("closing a question tells the asker once", async () => {
    await db.as(moderator, "update public.mufti_questions set status = 'closed' where id = $1", [qPublic]);
    await db.as(moderator, "update public.mufti_questions set moderation_note = 'again' where id = $1", [qPublic]);
    const rows = await inbox(alice);
    expect(rows.map((r) => r.kind)).toEqual(["mufti_answered", "mufti_closed"]);
  });

  test("rows are own-only, readable and markable as read by their owner, and nothing else is writable", async () => {
    expect(await inbox(bob)).toEqual([]);
    expect(await db.as(bob, "select id from public.notifications")).toEqual([]);
    expect(await db.as(null, "select id from public.notifications").catch(() => [])).toEqual([]);
    // Bob cannot mark Alice's row read; Alice can, and only read_at.
    expect(await db.as(bob, "update public.notifications set read_at = now() where user_id = $1 returning id", [alice])).toEqual([]);
    await rejects(db.as(alice, "update public.notifications set title = 'rewritten'"), /permission denied/);
    await rejects(db.as(alice, "update public.notifications set user_id = $1", [bob]), /permission denied/);
    await rejects(db.as(alice, "insert into public.notifications (user_id, kind, title) values ($1, 'system', 'forged')", [alice]), /permission denied|row-level security/);
    await rejects(db.as(alice, "delete from public.notifications"), /permission denied/);
    const n = await db.as(alice, "update public.notifications set read_at = now() where read_at is null returning id");
    expect(n.length).toBe(2);
    expect((await inbox(alice)).every((r) => r.read_at)).toBe(true);
  });

  test("a link must be a same-site path", async () => {
    await rejects(db.admin("insert into public.notifications (user_id, kind, link) values ($1, 'system', 'https://elsewhere.test/')", [alice]), /check constraint/);
    await rejects(db.admin("insert into public.notifications (user_id, kind, link) values ($1, 'system', '//elsewhere.test/')", [alice]), /check constraint/);
    await rejects(db.admin("insert into public.notifications (user_id, kind, channel) values ($1, 'system', 'sms')", [alice]), /check constraint/);
  });
});

describe("scholar application", () => {
  test("anyone signed in can apply; the applicant and staff read it; others cannot", async () => {
    const [app] = await apply(bob);
    expect((await db.as(bob, "select id from public.mufti_applications")).length).toBe(1);
    expect((await db.as(moderator, "select id from public.mufti_applications")).length).toBe(1);
    expect((await db.as(admin, "select id from public.mufti_applications")).length).toBe(1);
    expect(await db.as(alice, "select id from public.mufti_applications")).toEqual([]);
    expect(await db.as(reviewer, "select id from public.mufti_applications")).toEqual([]);
    expect(app!.id).toBeTruthy();
    await rejects(db.as(null, "select id from public.mufti_applications"), /permission denied/);
  });

  test("applying grants nothing: no role, no profile, no verification", async () => {
    const roles = await db.admin("select role from public.role_assignments where user_id = $1", [bob]);
    expect(roles).toEqual([]);
    expect(await db.admin("select 1 from public.mufti_profiles where user_id = $1", [bob])).toEqual([]);
    expect((await db.admin<{ v: boolean }>("select public.is_verified_mufti($1) as v", [bob]))[0]!.v).toBe(false);
  });

  test("one open application per person; a stranger cannot apply in someone else's name; the throttle holds", async () => {
    await rejects(apply(bob), /duplicate key|mufti_applications_one_open/);
    await rejects(
      db.as(alice, "insert into public.mufti_applications (applicant_id, applicant_name, credentials_md, consent_version) values ($1, 'Fixture', 'Fixture credentials, long enough here.', 'v1')", [bob]),
      /row-level security|your own name/,
    );
    await rejects(db.as(alice, "insert into public.mufti_applications (applicant_id, applicant_name, credentials_md) values ($1, 'Fixture', 'Fixture credentials, long enough here.')", [alice]), /null value|consent_version/);
    // The throttle: more than the per-minute allowance is refused, whatever the content.
    const spam = await db.createUser("spam@test.local");
    await apply(spam);
    await db.admin("alter table public.mufti_applications disable trigger mufti_applications_guard");
    await db.admin("update public.mufti_applications set status = 'declined', decision_note = 'seed done' where applicant_id = $1", [spam]);
    await db.admin("alter table public.mufti_applications enable trigger mufti_applications_guard");
    await apply(spam);
    await db.admin("alter table public.mufti_applications disable trigger mufti_applications_guard");
    await db.admin("update public.mufti_applications set status = 'declined', decision_note = 'seed done' where applicant_id = $1", [spam]);
    await db.admin("alter table public.mufti_applications enable trigger mufti_applications_guard");
    await rejects(apply(spam), /rate_limited/);
  });

  test("links must be https and few; text lengths are enforced", async () => {
    const carol = await db.createUser("carol@test.local");
    const bad = (links: string[]) =>
      db.as(carol, "insert into public.mufti_applications (applicant_id, applicant_name, credentials_md, links, consent_version) values ($1, 'Fixture', 'Fixture credentials, long enough here.', $2, 'v1')", [carol, links]);
    await rejects(bad(["http://example.test/x"]), /check constraint/);
    await rejects(bad(["javascript:alert(1)"]), /check constraint/);
    await rejects(bad(["https://example.test/a b"]), /check constraint/);
    await rejects(bad(Array.from({ length: 6 }, (_, i) => `https://example.test/${i}`)), /check constraint/);
    await rejects(db.as(carol, "insert into public.mufti_applications (applicant_id, applicant_name, credentials_md, consent_version) values ($1, 'Fixture', 'too short', 'v1')", [carol]), /check constraint/);
  });

  test("only an administrator moves the status, along submitted -> under_review -> verified | declined", async () => {
    const dan = await db.createUser("dan@test.local");
    const [app] = await apply(dan);
    const id = app!.id;
    // Not the applicant, not a moderator, not a scholarly reviewer: the row is not theirs to update.
    for (const who of [dan, moderator, reviewer])
      expect(await db.as(who, "update public.mufti_applications set status = 'under_review' where id = $1 returning id", [id])).toEqual([]);
    expect((await db.admin<{ status: string }>("select status from public.mufti_applications where id = $1", [id]))[0]!.status).toBe("submitted");
    // No skipping the review.
    await rejects(db.as(admin, "update public.mufti_applications set status = 'verified', decision_note = 'skipped review' where id = $1", [id]), /moves submitted, under review/);
    await db.as(admin, "update public.mufti_applications set status = 'under_review' where id = $1", [id]);
    // A decision needs a note.
    await rejects(db.as(admin, "update public.mufti_applications set status = 'declined' where id = $1", [id]), /check constraint/);
    await db.as(admin, "update public.mufti_applications set status = 'verified', decision_note = 'Fixture: credentials checked' where id = $1", [id]);
    // Final, and the submission itself never changes.
    await rejects(db.as(admin, "update public.mufti_applications set status = 'declined', decision_note = 'changed my mind' where id = $1", [id]), /moves submitted, under review/);
    await rejects(db.as(admin, "update public.mufti_applications set applicant_name = 'Edited' where id = $1", [id]), /permission denied/);
    const [row] = await db.admin<{ status: string; handled_by: string }>("select status, handled_by from public.mufti_applications where id = $1", [id]);
    expect(row).toEqual({ status: "verified", handled_by: admin });
  });

  test("a verified application still grants nothing: the role and the profile are separate administrator acts", async () => {
    const dan = (await db.admin<{ id: string }>("select id from auth.users where email = 'dan@test.local'"))[0]!.id;
    expect(await db.admin("select role from public.role_assignments where user_id = $1", [dan])).toEqual([]);
    expect(await db.admin("select 1 from public.mufti_profiles where user_id = $1", [dan])).toEqual([]);
    expect((await db.admin<{ v: boolean }>("select public.is_verified_mufti($1) as v", [dan]))[0]!.v).toBe(false);
    // No trigger or function of the application writes roles or profiles.
    const writers = await db.admin<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like '%mufti_application%' and (prosrc ilike '%role_assignments%' or prosrc ilike '%mufti_profiles%')",
    );
    expect(writers).toEqual([]);
  });

  test("the applicant is told when staff move the application, and every move is audited without the applicant's text", async () => {
    const dan = (await db.admin<{ id: string }>("select id from auth.users where email = 'dan@test.local'"))[0]!.id;
    const rows = await inbox(dan);
    expect(rows.map((r) => r.kind)).toEqual(["mufti_application", "mufti_application"]); // under_review, verified
    expect(rows.every((r) => r.title === null && r.link === "/mufti/apply")).toBe(true);
    const log = await db.admin<{ action: string; changes: Record<string, unknown> }>("select action, changes from public.audit_logs where entity_type = 'mufti_applications' order by id");
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(log)).not.toMatch(/Fixture credentials|Fixture Applicant|decision_note|checked/);
    const moves = log.filter((l) => l.action === "update").map((l) => l.changes);
    expect(moves).toContainEqual({ status: { from: "submitted", to: "under_review" } });
    expect(moves).toContainEqual({ status: { from: "under_review", to: "verified" } });
  });

  test("a verified mufti cannot also apply; deleting the account removes the application and the notifications", async () => {
    await rejects(apply(mufti), /already a verified mufti/);
    const gone = await db.createUser("gone@test.local");
    await apply(gone);
    await db.admin("delete from auth.users where id = $1", [gone]);
    expect(await db.admin("select 1 from public.mufti_applications where applicant_id = $1", [gone])).toEqual([]);
  });
});
