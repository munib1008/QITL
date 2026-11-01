import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PeopleAdmin } from "@/components/admin/PeopleAdmin";
import { peopleAdminStrings } from "@/lib/i18n/modules/peopleAdmin";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

/**
 * The editor screen with the API faked: the lists, the group choices, the Event Universe picker (searched on the right track),
 * the claim picker (Quran references shown, no verse field), read-only published records, and the database's refusal shown
 * in its own words. The real routes and database are covered by tests/unit/people-admin.test.ts and tests/db/people-admin.test.ts.
 */
const t = peopleAdminStrings("en");
const ID = "00000000-0000-4000-8000-0000000000";

const person = (n: number, o: Record<string, unknown> = {}) => ({
  id: `${ID}${String(n).padStart(2, "0")}`,
  slug: `fixture-${n}`,
  name_en: `Fixture person ${n}`,
  name_ar: null,
  kind: "other",
  encyclopedia_kind: null,
  status: "draft",
  subject_event_id: null,
  subject: null,
  claims: [{ count: 0 }],
  ...o,
});

type Handler = (url: URL, init?: RequestInit) => { status?: number; body: unknown };
let calls: Array<{ url: string; method: string; body: unknown }>;
function fakeApi(h: Handler) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "http://localhost");
      calls.push({ url: url.pathname + url.search, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined });
      const r = h(url, init);
      return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as Response;
    }),
  );
}
const detail = (claims: unknown[] = [], aliases: unknown[] = [], review: unknown = null) => ({ aliases, claims, review });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.spyOn(window, "prompt").mockReturnValue("Fixture note");
});

describe("list", () => {
  test("shows status, kind, group, linked item and claim count, and the rules", async () => {
    fakeApi((u) => ({
      body: { items: [person(1, { encyclopedia_kind: "ruler", status: "in_review", subject: { slug: "s", title: "Fixture item", track: "people" }, claims: [{ count: 3 }] }), person(2)] },
    }));
    render(<PeopleAdmin scope="person" canEdit canReview={false} t={t} />);
    const list = await screen.findByTestId("person-admin-list");
    const first = within(list).getAllByRole("listitem")[0]!;
    expect(within(first).getByText("Fixture person 1", { selector: "p" })).toBeTruthy();
    expect(within(first).getByText("Ruler")).toBeTruthy();
    expect(within(first).getByText("Fixture item (people)")).toBeTruthy();
    expect(within(first).getByText("3")).toBeTruthy();
    expect(within(list).getByText("Not classified")).toBeTruthy();
    expect(screen.getByText(/no evidence, no publish/)).toBeTruthy();
  });
  test("communities show whether an evidence claim is set", async () => {
    fakeApi(() => ({ body: { items: [{ ...person(1), kind: undefined, claims: undefined, claim_id: ID + "99" }, { ...person(2), kind: undefined, claims: undefined, claim_id: null }] } }));
    render(<PeopleAdmin scope="community" canEdit canReview={false} t={t} />);
    const list = await screen.findByTestId("community-admin-list");
    expect(within(list).getByText("yes")).toBeTruthy();
    expect(within(list).getByText("no")).toBeTruthy();
  });
  test("the search and status filter go to the API", async () => {
    fakeApi(() => ({ body: { items: [] } }));
    render(<PeopleAdmin scope="person" canEdit canReview={false} t={t} />);
    await screen.findByText(t.none);
    fireEvent.change(screen.getByLabelText(t.search), { target: { value: "yus" } });
    fireEvent.change(screen.getByLabelText(t.statusFilter), { target: { value: "draft" } });
    await waitFor(() => expect(calls.at(-1)!.url).toBe("/api/admin/people?view=list&scope=person&q=yus&status=draft"));
  });
});

describe("editing", () => {
  const open = async (item: Record<string, unknown>) => {
    render(<PeopleAdmin scope="person" canEdit canReview t={t} />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`${t.edit}.*${item.name_en}`) }));
  };

  test("a non-prophet is never offered 'Prophet'; a prophet is offered only 'Prophet'", async () => {
    fakeApi((u) => (u.searchParams.get("view") === "detail" ? { body: detail() } : { body: { items: [person(1), person(2, { kind: "prophet", encyclopedia_kind: "prophet" })] } }));
    await open(person(1));
    let options = within(screen.getByLabelText(t.groupLabel, { selector: "select" })).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Not classified", "Individual", "Family member", "Ruler", "Unnamed"]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t.edit}`) }));
    await waitFor(() => expect(screen.getAllByLabelText(t.groupLabel, { selector: "select" })).toHaveLength(1));
    options = within(screen.getByLabelText(t.groupLabel, { selector: "select" })).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Not classified", "Prophet"]);
  });

  test("the item picker searches the matching track and saves the chosen item", async () => {
    fakeApi((u, init) => {
      const v = u.searchParams.get("view");
      if (v === "detail") return { body: detail() };
      if (v === "events") return { body: { items: [{ id: ID + "77", slug: "fixture-item", title: "Fixture item", track: u.searchParams.get("track"), status: "published" }] } };
      if (init?.method === "POST") return { body: { record: { id: "x" } } };
      return { body: { items: [person(1)] } };
    });
    await open(person(1));
    fireEvent.change(screen.getByLabelText(t.subjectLabel), { target: { value: "fix" } });
    fireEvent.click(screen.getByRole("button", { name: t.subjectSearch }));
    const hits = await screen.findByTestId("subject-hits");
    expect(calls.some((c) => c.url === "/api/admin/people?view=events&track=people&q=fix")).toBe(true);
    fireEvent.click(within(hits).getByRole("button", { name: /Use this item/ }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ scope: "person", id: person(1).id, encyclopediaKind: null, subjectEventId: ID + "77" }));
    await screen.findByText(t.saved);
  });

  test("a community's picker uses the communities track and sends no encyclopedia kind", async () => {
    fakeApi((u, init) => {
      if (u.searchParams.get("view") === "events") return { body: { items: [{ id: ID + "78", slug: "c", title: "Fixture community item", track: "communities", status: "draft" }] } };
      if (init?.method === "POST") return { body: { record: { id: "x" } } };
      return { body: { items: [{ ...person(1), kind: undefined, claims: undefined, claim_id: null }] } };
    });
    render(<PeopleAdmin scope="community" canEdit canReview={false} t={t} />);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    fireEvent.click(screen.getByRole("button", { name: t.subjectSearch }));
    fireEvent.click(await screen.findByRole("button", { name: /Use this item/ }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ scope: "community", id: person(1).id, subjectEventId: ID + "78" }));
    expect(calls.some((c) => c.url.includes("track=communities"))).toBe(true);
    expect(screen.queryByLabelText(t.groupLabel, { selector: "select" })).toBeNull();
    expect(screen.getByRole("link", { name: t.actions.reviewInLta }).getAttribute("href")).toBe("/admin/life-through-ages");
  });

  test("claims show their Quran references and are picked from existing claims, with no verse field", async () => {
    const claim = { id: ID + "55", statement: "Fixture claim statement", status: "approved", evidence: "quran", claim_references: [{ kind: "quran", quran_surah: 12, quran_ayah_from: 2, quran_ayah_to: 4 }] };
    fakeApi((u, init) => {
      const v = u.searchParams.get("view");
      if (v === "detail") return { body: detail([{ id: ID + "66", position: 1, claim_id: claim.id, claim }], [{ alias: "Fixture alias", language: "en" }]) };
      if (v === "claims") return { body: { items: [{ ...claim, id: ID + "56", statement: "Another claim", claim_references: [] }] } };
      if (init?.method === "POST") return { body: { record: { id: "x" } }, status: 201 };
      return { body: { items: [person(1)] } };
    });
    await open(person(1));
    expect(await screen.findByText(/Quran 12:2-4/)).toBeTruthy();
    expect(screen.getAllByText("Fixture alias").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(t.claimSearch), { target: { value: "another" } });
    fireEvent.click(screen.getByRole("button", { name: t.claimFind }));
    const hits = await screen.findByTestId("claim-hits");
    expect(within(hits).getByText(/no Quran reference/)).toBeTruthy();
    fireEvent.click(within(hits).getByRole("button", { name: t.claimAttach }));
    await waitFor(() => expect(calls.find((c) => c.url === "/api/admin/people/claims" && c.method === "POST")?.body).toEqual({ personId: person(1).id, claimId: ID + "56" }));
    expect(screen.queryByLabelText(/(verse|ayah|surah)/i)).toBeNull();
  });

  test("aliases are added with a language code", async () => {
    fakeApi((u, init) => (init?.method === "POST" ? { body: { ok: true }, status: 201 } : u.searchParams.get("view") === "detail" ? { body: detail() } : { body: { items: [person(1)] } }));
    await open(person(1));
    fireEvent.change(await screen.findByLabelText(t.aliasText), { target: { value: "Fixture alias" } });
    fireEvent.change(screen.getByLabelText(t.aliasLanguage), { target: { value: "ar" } });
    fireEvent.click(screen.getByRole("button", { name: t.aliasAdd }));
    await waitFor(() => expect(calls.find((c) => c.url === "/api/admin/people/aliases")?.body).toEqual({ personId: person(1).id, alias: "Fixture alias", language: "ar" }));
  });

  test("publishing shows the database's refusal whole, and guides before it", async () => {
    fakeApi((u, init) => {
      if (init?.method === "POST") return { status: 422, body: { code: "rule", error: "no evidence, no publish: person x has no evidence claim" } };
      if (u.searchParams.get("view") === "detail") return { body: detail() };
      return { body: { items: [person(1, { encyclopedia_kind: "ruler" })] } };
    });
    await open(person(1));
    const hints = await screen.findByTestId("publish-hints");
    expect(within(hints).getByText(/no evidence, no publish/)).toBeTruthy();
    expect(within(hints).getByText(/needs review/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.actions.publish }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(`${t.databaseSays}: no evidence, no publish: person x has no evidence claim`);
  });

  test("a scholarly reviewer approves through the review route", async () => {
    fakeApi((u, init) => (init?.method === "POST" ? { body: { review: { id: "r" } }, status: 201 } : u.searchParams.get("view") === "detail" ? { body: detail() } : { body: { items: [person(1)] } }));
    await open(person(1));
    fireEvent.click(await screen.findByRole("button", { name: t.actions.approve }));
    await waitFor(() => expect(calls.find((c) => c.url === "/api/admin/review")?.body).toEqual({ entityType: "person", entityId: person(1).id, decision: "approved" }));
  });
});

describe("published and read-only", () => {
  test("a published record has no edit controls; its one action is 'Move to correction', with a note", async () => {
    fakeApi((u, init) => {
      if (init?.method === "POST") return { body: { entity: { id: "x", status: "correction" } } };
      if (u.searchParams.get("view") === "detail") return { body: detail([{ id: ID + "66", position: 1, claim_id: ID + "55", claim: { id: ID + "55", statement: "S", status: "published", evidence: "quran", claim_references: [] } }], [{ alias: "A", language: "en" }]) };
      return { body: { items: [person(1, { status: "published", encyclopedia_kind: "ruler" })] } };
    });
    render(<PeopleAdmin scope="person" canEdit canReview t={t} />);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    expect(await screen.findByTestId("read-only")).toBeTruthy();
    expect(screen.getByLabelText(t.groupLabel, { selector: "select" }).matches(":disabled")).toBe(true);
    for (const name of [t.save, t.aliasAdd, t.claimFind, t.actions.publish, t.actions.sendForReview, t.actions.approve]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("button", { name: t.claimDetach })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.actions.correction }));
    await waitFor(() => expect(calls.find((c) => c.url === "/api/admin/people/status")?.body).toEqual({ scope: "person", id: person(1).id, status: "correction", revisionNote: "Fixture note" }));
  });
  test("without the editor role nothing can be changed", async () => {
    fakeApi((u) => (u.searchParams.get("view") === "detail" ? { body: detail() } : { body: { items: [person(1)] } }));
    render(<PeopleAdmin scope="person" canEdit={false} canReview t={t} />);
    expect(await screen.findByText(t.editorsOnly)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    await screen.findByText(t.reviewLabel + ": pending");
    for (const name of [t.save, t.aliasAdd, t.claimFind, t.actions.publish, t.actions.sendForReview]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.getByRole("button", { name: t.actions.approve })).toBeTruthy();
  });
});
