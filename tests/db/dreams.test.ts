// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Migration 1700: the Dream Understanding Centre. Every privacy rule is exercised here: only the submitter and the
 * qualified scholars assigned to a request can read it, administrators work from metadata only, audit rows hold no
 * dream text, consent can be withdrawn, and the submitter can export, shorten retention and delete.
 */
const DREAM = "FIXTURE-DREAM-TEXT a placeholder dream description used only in tests";

let db: Db;
let admin: string, reviewer: string, mod: string, alice: string, bob: string, carol: string, dave: string;
let s1: string, s2: string, s3: string, s4: string;

const submit = async (who: string, text = DREAM) => {
  const [r] = await db.as<{ id: string }>(who, "select public.submit_dream_request($1, $2, 'en', 'v1') as id", [text, "Fixture question"]);
  return r!.id;
};
const visible = (who: string | null, id: string) => db.as(who, "select id from public.dream_requests where id = $1", [id]);
const assign = (req: string, scholar: string, role = "primary") =>
  db.as(admin, "insert into public.dream_request_assignments (request_id, scholar_id, role, assigned_by) values ($1, $2, $3, $4)", [req, scholar, role, admin]);
const respond = async (scholar: string, req: string, extra = "") => {
  const [r] = await db.as<{ id: string }>(
    scholar,
    `insert into public.dream_scholar_responses (request_id, scholar_id, outcome, body_md, status${extra ? ", second_opinion_id" : ""}) values ($1, $2, 'meaning_unknown', 'Fixture response text long enough.', 'submitted'${extra ? ", $3" : ""}) returning id`,
    extra ? [req, scholar, extra] : [req, scholar],
  );
  return r!.id;
};
const approve = (reviewerId: string, resp: string, version = 1) =>
  db.as(reviewerId, "insert into public.dream_content_reviews (response_id, response_version, reviewer_id, decision) values ($1, $2, $3, 'approved')", [resp, version, reviewerId]);
const status = async (id: string) => (await db.admin<{ status: string }>("select status from public.dream_requests where id = $1", [id]))[0]?.status;

async function scholar(email: string, dream: boolean): Promise<string> {
  const id = await db.createUser(email, ["mufti"]);
  await db.as(id, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture scholar', 'Fixture credentials')", [id]);
  await db.as(admin, "update public.mufti_profiles set verified_by = $2, verified_at = now() where user_id = $1", [id, admin]);
  if (dream) await db.as(admin, "update public.mufti_profiles set dream_qualified_by = $2, dream_qualified_at = now() where user_id = $1", [id, admin]);
  return id;
}

beforeAll(async () => {
  db = await createDb();
  admin = await db.createUser("admin@test.local", ["admin"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  mod = await db.createUser("mod@test.local", ["moderator"]);
  alice = await db.createUser("alice@test.local");
  bob = await db.createUser("bob@test.local");
  carol = await db.createUser("carol@test.local");
  dave = await db.createUser("dave@test.local");
  s1 = await scholar("s1@test.local", true);
  s2 = await scholar("s2@test.local", true);
  s3 = await scholar("s3@test.local", false); // a verified mufti without the dream qualification
  s4 = await scholar("s4@test.local", true);
}, 180_000);

describe("dream-interpretation qualification", () => {
  test("only an administrator grants it, as their own act, and only to a verified mufti", async () => {
    const m = await db.createUser("self@test.local", ["mufti"]);
    await rejects(
      db.as(m, "insert into public.mufti_profiles (user_id, display_name, credentials_md, dream_qualified_by, dream_qualified_at) values ($1, 'x', 'y', $1, now())", [m]),
      /only an administrator/,
    );
    await db.as(m, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture', 'Fixture credentials')", [m]);
    await rejects(db.as(m, "update public.mufti_profiles set dream_qualification_note = 'self' where user_id = $1", [m]), /only an administrator/);
    await rejects(db.as(admin, "update public.mufti_profiles set dream_qualified_by = $2, dream_qualified_at = now() where user_id = $1", [m, admin]), /check constraint/); // not verified
    await db.as(admin, "update public.mufti_profiles set verified_by = $2, verified_at = now() where user_id = $1", [m, admin]);
    await rejects(db.as(admin, "update public.mufti_profiles set dream_qualified_by = $2, dream_qualified_at = now() where user_id = $1", [m, s1]), /granted by you/);
    await db.as(admin, "update public.mufti_profiles set dream_qualified_by = $2, dream_qualified_at = now() where user_id = $1", [m, admin]);
    const [q] = await db.admin<{ ok: boolean }>("select public.is_dream_scholar($1) as ok", [m]);
    expect(q!.ok).toBe(true);
    const [n] = await db.admin<{ ok: boolean }>("select public.is_dream_scholar($1) as ok", [s3]);
    expect(n!.ok).toBe(false);
  });

  test("dream responses are registered as a review entity type", async () => {
    expect(await db.admin("select type from public.review_entity_types where type = 'dream_response' and module = 'dreams'")).toHaveLength(1);
  });
});

describe("dream requests are private", () => {
  let req: string;

  test("signed-out visitors can neither submit nor read", async () => {
    await rejects(db.as(null, "select public.submit_dream_request('x', null, 'en', 'v1')"), /permission denied/);
    await rejects(db.as(null, "select id from public.dream_requests"), /permission denied/);
  });

  test("the submitter's retention preference sets the limit; consent is recorded with the request", async () => {
    await db.as(alice, "insert into public.dream_privacy_preferences (user_id, retention_days) values ($1, 30)", [alice]);
    await rejects(db.as(alice, "insert into public.dream_privacy_preferences (user_id, retention_days) values ($1, 30)", [bob]), /row-level security/);
    await rejects(db.as(bob, "insert into public.dream_privacy_preferences (user_id, retention_days) values ($1, 45)", [bob]), /check constraint/);
    req = await submit(alice);
    const [r] = await db.admin<{ days: number; status: string }>("select extract(day from retain_until - created_at)::int as days, status from public.dream_requests where id = $1", [req]);
    expect(r).toEqual({ days: 30, status: "submitted" });
    expect(await db.as(alice, "select kind, granted from public.dream_request_consents where request_id = $1", [req])).toEqual([{ kind: "scholar_access", granted: true }]);
  });

  test("nobody else reads it: not other users, staff, moderators, unassigned scholars or administrators", async () => {
    expect(await visible(alice, req)).toHaveLength(1);
    for (const who of [bob, reviewer, mod, s1, s3, admin]) expect(await visible(who, req)).toHaveLength(0);
    for (const who of [bob, admin]) expect(await db.as(who, "select id from public.dream_request_consents where request_id = $1", [req])).toHaveLength(0);
  });

  test("administrators assign from metadata only; the queue never carries dream text", async () => {
    const q = await db.as<Record<string, unknown>>(admin, "select * from public.dream_admin_queue()");
    const row = q.find((r) => r.id === req)!;
    expect(row).toMatchObject({ status: "submitted", scholar_access: true });
    expect(JSON.stringify(q)).not.toContain("FIXTURE-DREAM-TEXT");
    expect(Object.keys(row)).not.toContain("dream_text");
    await rejects(db.as(bob, "select * from public.dream_admin_queue()"), /administrators only/);
    await rejects(db.as(reviewer, "select * from public.dream_admin_queue()"), /administrators only/);
  });

  test("only an admin assigns, only dream-qualified scholars, never to their own request", async () => {
    await rejects(db.as(bob, "insert into public.dream_request_assignments (request_id, scholar_id, assigned_by) values ($1, $2, $3)", [req, s1, bob]), /row-level security/);
    await rejects(assign(req, s3), /row-level security/); // verified mufti, not dream-qualified
    const own = await submit(s2, "FIXTURE-DREAM-TEXT the scholar's own dream fixture");
    await rejects(assign(own, s2), /own request/);
    await assign(req, s1);
    await assign(req, s2, "reviewer");
    expect(await status(req)).toBe("assigned");
    expect(await visible(s1, req)).toHaveLength(1);
    expect(await visible(s2, req)).toHaveLength(1);
    expect(await visible(s4, req)).toHaveLength(0);
    expect(await visible(admin, req)).toHaveLength(0);
  });

  test("losing the qualification removes access", async () => {
    await db.as(admin, "update public.mufti_profiles set dream_qualified_by = null, dream_qualified_at = null where user_id = $1", [s2]);
    expect(await visible(s2, req)).toHaveLength(0);
    await db.as(admin, "update public.mufti_profiles set dream_qualified_by = $2, dream_qualified_at = now() where user_id = $1", [s2, admin]);
    expect(await visible(s2, req)).toHaveLength(1);
  });

  test("responses: reviewers do not write one; release needs an independent review and the fallibility acknowledgement", async () => {
    await rejects(
      db.as(s2, "insert into public.dream_scholar_responses (request_id, scholar_id, outcome, body_md) values ($1, $2, 'meaning_unknown', 'Fixture reviewer response text.')", [req, s2]),
      /does not write one/,
    );
    await rejects(
      db.as(s4, "insert into public.dream_scholar_responses (request_id, scholar_id, outcome, body_md) values ($1, $2, 'meaning_unknown', 'Fixture unassigned response.')", [req, s4]),
      /row-level security|assigned to this request/,
    );
    await rejects(
      db.as(s1, "insert into public.dream_scholar_responses (request_id, scholar_id, outcome, body_md) values ($1, $2, 'symbol_lookup', 'Fixture response text long enough.')", [req, s1]),
      /check constraint/,
    );
    const resp = await respond(s1, req);
    expect(await db.as(alice, "select id from public.dream_scholar_responses where id = $1", [resp])).toHaveLength(0); // not released
    expect(await db.as(s2, "select id from public.dream_scholar_responses where id = $1", [resp])).toHaveLength(1); // the assigned reviewer
    await rejects(db.as(s1, "update public.dream_scholar_responses set status = 'released' where id = $1", [resp]), /check constraint|no independent review/);
    await rejects(approve(s1, resp), /own response/);
    await rejects(approve(s4, resp), /row-level security/); // not assigned
    await db.as(s1, "insert into public.dream_reference_links (response_id, kind, quran_surah, quran_ayah_from, quran_ayah_to) values ($1, 'quran', 12, 4, 6)", [resp]);
    await approve(s2, resp);
    await rejects(db.as(s1, "update public.dream_scholar_responses set status = 'released' where id = $1", [resp]), /check constraint/); // no acknowledgement
    await db.as(s1, "update public.dream_scholar_responses set status = 'released', fallibility_acknowledged = true where id = $1", [resp]);
    expect(await status(req)).toBe("answered");
    expect(await db.as(alice, "select outcome from public.dream_scholar_responses where id = $1", [resp])).toEqual([{ outcome: "meaning_unknown" }]);
    expect(await db.as(alice, "select kind from public.dream_reference_links where response_id = $1", [resp])).toEqual([{ kind: "quran" }]);
    for (const who of [bob, admin, reviewer]) expect(await db.as(who, "select id from public.dream_scholar_responses where id = $1", [resp])).toHaveLength(0);
    // An edit after release needs a new review and is hidden from the submitter until then.
    await db.as(s1, "update public.dream_scholar_responses set body_md = 'Fixture response, revised after release.' where id = $1", [resp]);
    const [after] = await db.admin<{ status: string; review_status: string; version: number }>("select status, review_status, version from public.dream_scholar_responses where id = $1", [resp]);
    expect(after).toEqual({ status: "submitted", review_status: "pending", version: 2 });
    expect(await db.as(alice, "select id from public.dream_scholar_responses where id = $1", [resp])).toHaveLength(0);
    await approve(s2, resp, 2);
    await db.as(s1, "update public.dream_scholar_responses set status = 'released' where id = $1", [resp]);
  });

  test("second opinions need their own consent and a scholar who has not already responded", async () => {
    const [first] = await db.as<{ id: string }>(alice, "select id from public.dream_scholar_responses where request_id = $1", [req]);
    await rejects(db.as(alice, "insert into public.dream_second_opinions (request_id, first_response_id, requested_by) values ($1, $2, $3)", [req, first!.id, alice]), /consent/);
    await rejects(db.as(bob, "insert into public.dream_request_consents (request_id, user_id, kind, granted, notice_version) values ($1, $2, 'second_opinion', true, 'v1')", [req, bob]), /row-level security/);
    await db.as(alice, "insert into public.dream_request_consents (request_id, user_id, kind, granted, notice_version) values ($1, $2, 'second_opinion', true, 'v1')", [req, alice]);
    const [so] = await db.as<{ id: string }>(alice, "insert into public.dream_second_opinions (request_id, first_response_id, requested_by) values ($1, $2, $3) returning id", [req, first!.id, alice]);
    await rejects(db.as(alice, "insert into public.dream_second_opinions (request_id, first_response_id, requested_by) values ($1, $2, $3)", [req, first!.id, alice]), /duplicate key/);
    await rejects(db.as(alice, "update public.dream_second_opinions set status = 'answered' where id = $1", [so!.id]), /not available to you/);
    await assign(req, s4, "second_opinion");
    const resp = await respond(s4, req, so!.id);
    await approve(s2, resp);
    await db.as(s4, "update public.dream_scholar_responses set status = 'released', fallibility_acknowledged = true where id = $1", [resp]);
    expect(await db.as(alice, "select status from public.dream_second_opinions where id = $1", [so!.id])).toEqual([{ status: "answered" }]);
    expect(await db.as(alice, "select id from public.dream_scholar_responses where request_id = $1", [req])).toHaveLength(2);
  });

  test("withdrawing consent removes every scholar's access", async () => {
    const r2 = await submit(carol);
    await assign(r2, s1);
    expect(await visible(s1, r2)).toHaveLength(1);
    await db.as(carol, "insert into public.dream_request_consents (request_id, user_id, kind, granted, notice_version) values ($1, $2, 'scholar_access', false, 'v1')", [r2, carol]);
    expect(await visible(s1, r2)).toHaveLength(0);
    await rejects(assign(r2, s4), /not consented/);
  });

  test("the submitter cannot edit the text or extend retention, but can shorten it, withdraw and delete", async () => {
    const r3 = await submit(dave);
    await rejects(db.as(dave, "update public.dream_requests set dream_text = 'FIXTURE-DREAM-TEXT edited text here' where id = $1", [r3]), /cannot be edited/);
    await rejects(db.as(dave, "update public.dream_requests set retain_until = retain_until + interval '1 day' where id = $1", [r3]), /only be shortened/);
    await rejects(db.as(dave, "update public.dream_requests set status = 'answered' where id = $1", [r3]), /not available to you/);
    await db.as(dave, "update public.dream_requests set retain_until = retain_until - interval '10 days' where id = $1", [r3]);
    expect(await db.as(bob, "delete from public.dream_requests where id = $1 returning id", [r3])).toHaveLength(0);
    await db.as(dave, "update public.dream_requests set status = 'withdrawn' where id = $1", [r3]);
    const hist = await db.as<{ from_status: string | null; to_status: string }>(dave, "select from_status, to_status from public.dream_request_status_history where request_id = $1 order by changed_at", [r3]);
    expect(hist).toEqual([
      { from_status: null, to_status: "submitted" },
      { from_status: "submitted", to_status: "withdrawn" },
    ]);
    await db.as(dave, "delete from public.dream_requests where id = $1", [r3]);
    expect(await db.admin("select id from public.dream_requests where id = $1", [r3])).toHaveLength(0);
    expect(await db.admin("select id from public.dream_request_status_history where request_id = $1", [r3])).toHaveLength(0);
  });

  test("admins decline or close with a reason code only", async () => {
    const r4 = await submit(dave, "FIXTURE-DREAM-TEXT another fixture dream for declining");
    await rejects(db.as(bob, "select public.dream_admin_set_status($1, 'declined', 'capacity')", [r4]), /administrators only/);
    await rejects(db.as(admin, "select public.dream_admin_set_status($1, 'closed', 'completed')", [r4]), /cannot move/);
    await rejects(db.as(admin, "select public.dream_admin_set_status($1, 'declined', 'free text reason')", [r4]), /check constraint/);
    await db.as(admin, "select public.dream_admin_set_status($1, 'declined', 'capacity')", [r4]);
    expect(await db.as(dave, "select reason from public.dream_request_status_history where request_id = $1 and to_status = 'declined'", [r4])).toEqual([{ reason: "capacity" }]);
  });

  test("export holds only the caller's own data", async () => {
    const [mine] = await db.as<{ d: { requests: Array<{ request: { id: string; dream_text: string }; responses: unknown[] }> } }>(alice, "select public.export_my_dream_data() as d");
    expect(mine!.d.requests.map((r) => r.request.id)).toEqual([req]);
    expect(mine!.d.requests[0]!.responses).toHaveLength(2);
    const [other] = await db.as<{ d: { requests: unknown[] } }>(bob, "select public.export_my_dream_data() as d");
    expect(other!.d.requests).toEqual([]);
  });

  test("audit rows and status history never contain dream text, questions or response text", async () => {
    const audit = await db.admin<{ c: string }>("select changes::text as c from public.audit_logs where entity_type like 'dream_%'");
    expect(audit.length).toBeGreaterThan(5);
    for (const a of audit) {
      expect(a.c).not.toContain("FIXTURE-DREAM-TEXT");
      expect(a.c).not.toContain("Fixture question");
      expect(a.c).not.toContain("Fixture response");
    }
    const cols = await db.admin<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'dream_request_status_history'");
    expect(cols.map((c) => c.column_name).sort()).toEqual(["changed_at", "changed_by", "from_status", "id", "reason", "request_id", "to_status"]);
  });

  test("expired requests are purged by the trusted job only", async () => {
    const r5 = await submit(bob);
    await rejects(db.as(bob, "select public.purge_expired_dream_requests()"), /permission denied/);
    await db.admin("update public.dream_requests set retain_until = created_at + interval '1 millisecond' where id = $1", [r5]);
    const [{ n }] = (await db.admin<{ n: number }>("select public.purge_expired_dream_requests() as n")) as [{ n: number }];
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await db.admin("select id from public.dream_requests where id = $1", [r5])).toHaveLength(0);
  });

  test("submissions are throttled", async () => {
    const u = await db.createUser("spam@test.local");
    for (let i = 0; i < 3; i++) await submit(u);
    await rejects(submit(u), /rate_limited/);
  });
});

describe("Mufti Q&A as the pages read it", () => {
  test("public list, answer counts, follows and the moderation gate", async () => {
    const [pub] = await db.as<{ id: string }>(alice, "insert into public.mufti_questions (asker_id, title, body) values ($1, 'Fixture public page question', 'A fixture question body long enough.') returning id", [alice]);
    const [priv] = await db.as<{ id: string }>(alice, "insert into public.mufti_questions (asker_id, title, body, visibility) values ($1, 'Fixture private page question', 'A fixture question body long enough.', 'private') returning id", [alice]);
    // Not accepted yet: nobody else can follow or read it, and the asker cannot accept their own question.
    await rejects(db.as(bob, "insert into public.mufti_question_follows (user_id, question_id) values ($1, $2)", [bob, pub!.id]), /row-level security/);
    expect(await db.as(alice, "update public.mufti_questions set status = 'accepted' where id = $1 returning id", [pub!.id])).toHaveLength(0);
    await db.as(mod, "update public.mufti_questions set status = 'accepted' where id in ($1, $2)", [pub!.id, priv!.id]);
    const list = await db.as<{ id: string }>(null, "select id from public.mufti_questions where visibility = 'public' and status in ('accepted', 'assigned', 'answered', 'closed')");
    expect(list.map((r) => r.id)).toContain(pub!.id);
    expect(list.map((r) => r.id)).not.toContain(priv!.id);
    await db.as(bob, "insert into public.mufti_question_follows (user_id, question_id) values ($1, $2)", [bob, pub!.id]);
    await rejects(db.as(bob, "insert into public.mufti_question_follows (user_id, question_id) values ($1, $2)", [bob, priv!.id]), /row-level security/);
    expect(await db.as(carol, "select * from public.mufti_question_follows")).toHaveLength(0);
    // A draft answer is not counted on the public page.
    await db.as(admin, "insert into public.mufti_assignments (question_id, mufti_id, assigned_by) values ($1, $2, $3)", [pub!.id, s1, admin]);
    await db.as(s1, "insert into public.mufti_answers (question_id, mufti_id, body_md) values ($1, $2, 'Fixture draft answer text here.')", [pub!.id, s1]);
    expect(await db.as(null, "select id from public.mufti_answers where question_id = $1", [pub!.id])).toHaveLength(0);
    // Signed-out visitors cannot ask.
    await rejects(db.as(null, "insert into public.mufti_questions (asker_id, title, body) values ($1, 'Fixture anonymous question', 'A fixture question body long enough.')", [alice]), /permission denied/);
  });

  test("profiles: unverified ones are hidden from the public; muftis cannot verify themselves", async () => {
    const m = await db.createUser("pending@test.local", ["mufti"]);
    await db.as(m, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture pending', 'Fixture credentials')", [m]);
    expect(await db.as(null, "select user_id from public.mufti_profiles where user_id = $1", [m])).toHaveLength(0);
    expect(await db.as(bob, "select user_id from public.mufti_profiles where user_id = $1", [m])).toHaveLength(0);
    await rejects(db.as(m, "update public.mufti_profiles set verified_by = $1, verified_at = now() where user_id = $1", [m]), /row-level security/);
    await rejects(db.as(bob, "insert into public.role_assignments (user_id, role, granted_by) values ($1, 'mufti', $1)", [bob]), /row-level security/);
  });
});
