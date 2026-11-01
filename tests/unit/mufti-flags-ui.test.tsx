import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The client pieces of backlog 27 and 28 with a stubbed database client and fetch: the bell's count, the notifications
 * panel, the application form's consent, the administrator's review buttons, and the /admin/site editor (note required,
 * validation messages, menu preview, locked sections, nothing sent without a change).
 */
const state = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]>, rpc: {} as Record<string, unknown>, calls: [] as Array<{ url: string; body: unknown }> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
}));
vi.mock("@/lib/supabase/browser", () => {
  const builder = (table: string) => {
    const result = () => ({ data: state.tables[table] ?? [], error: null, count: (state.tables[table] ?? []).length });
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "like", "order", "limit", "in"]) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return b;
  };
  return { getBrowserSupabase: () => ({ from: builder, rpc: (name: string) => Promise.resolve({ data: state.rpc[name] ?? null, error: null }) }) };
});

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationsPanel } from "@/components/notifications/NotificationsPanel";
import { ApplyForm } from "@/components/mufti/ApplyForm";
import { AdminApplications } from "@/components/mufti/AdminApplications";
import { AdminSite } from "@/components/admin/AdminSite";

beforeEach(() => {
  state.tables = {};
  state.rpc = {};
  state.calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      state.calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("notifications", () => {
  test("the bell shows the unread count in its accessible name and links to the panel", async () => {
    state.tables.notifications = [{}, {}, {}];
    render(<NotificationBell />);
    const bell = await screen.findByTestId("notification-bell");
    await waitFor(() => expect(bell).toHaveAttribute("aria-label", "Notifications, 3 unread"));
    expect(bell).toHaveAttribute("href", "/account#notifications");
    expect(screen.getByTestId("notification-count")).toHaveTextContent("3");
  });

  test("with nothing unread the bell has a plain name and no count", async () => {
    render(<NotificationBell />);
    const bell = await screen.findByTestId("notification-bell");
    expect(bell).toHaveAttribute("aria-label", "Notifications");
    expect(screen.queryByTestId("notification-count")).toBeNull();
  });

  test("the panel lists a sentence for the kind, the title and a link, and marks read through the API", async () => {
    state.tables.notifications = [
      { id: "11111111-1111-4111-8111-111111111111", kind: "mufti_answered", title: "Fixture question", link: "/community/questions/abc", created_at: "2026-11-01T10:00:00Z", read_at: null },
      { id: "22222222-2222-4222-8222-222222222222", kind: "mufti_application", title: null, link: "/mufti/apply", created_at: "2026-11-01T09:00:00Z", read_at: "2026-11-01T09:30:00Z" },
    ];
    render(<NotificationsPanel locale="en" />);
    expect(await screen.findByText("Your question has a published answer")).toBeInTheDocument();
    expect(screen.getByText("Fixture question")).toBeInTheDocument();
    expect(screen.getByText("Your scholar application was updated")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open" }).map((a) => a.getAttribute("href"))).toEqual(["/community/questions/abc", "/mufti/apply"]);
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(state.calls).toEqual([{ url: "/api/notifications", body: { all: true } }]));
  });
});

describe("scholar application", () => {
  test("the form will not send without the consent, and sends no role or status", async () => {
    render(<ApplyForm locale="en" />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Fixture Name" } });
    fireEvent.change(screen.getByLabelText("Credentials and ijazah"), { target: { value: "Fixture credentials, long enough here." } });
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect(state.calls).toEqual([]);
    fireEvent.change(screen.getByLabelText(/Links that support/), { target: { value: "https://example.test/a\n\nhttps://example.test/b\n" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(state.calls.length).toBe(1));
    expect(state.calls[0]!.url).toBe("/api/mufti/applications");
    expect(state.calls[0]!.body).toEqual({
      name: "Fixture Name",
      credentials: "Fixture credentials, long enough here.",
      madhhab: null,
      field: null,
      links: ["https://example.test/a", "https://example.test/b"],
      consent: true,
    });
  });

  test("an administrator moves an application forward; a decision needs a note; a moderator can only read", async () => {
    state.rpc.has_role = true;
    state.tables.mufti_applications = [
      { id: "a1", applicant_name: "Fixture One", credentials_md: "Fixture credentials text.", madhhab: null, field: null, links: ["https://example.test/x"], status: "submitted", decision_note: null, created_at: "2026-11-01T10:00:00Z" },
      { id: "a2", applicant_name: "Fixture Two", credentials_md: "Fixture credentials text.", madhhab: "hanafi", field: "Fixture field", links: [], status: "under_review", decision_note: null, created_at: "2026-11-01T09:00:00Z" },
    ];
    render(<AdminApplications locale="en" />);
    fireEvent.click(await screen.findByRole("button", { name: "Start review" }));
    await waitFor(() => expect(state.calls).toEqual([{ url: "/api/admin/mufti/applications", body: { id: "a1", status: "under_review" } }]));
    const verify = screen.getByRole("button", { name: "Mark verified" });
    expect(verify).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Note for the applicant/), { target: { value: "Credentials checked" } });
    expect(verify).toBeEnabled();
    fireEvent.click(verify);
    await waitFor(() => expect(state.calls[1]).toEqual({ url: "/api/admin/mufti/applications", body: { id: "a2", status: "verified", note: "Credentials checked" } }));
    expect(screen.getByRole("link", { name: "https://example.test/x" })).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  test("without the administrator role there are no buttons to move an application", async () => {
    state.rpc.has_role = false;
    state.tables.mufti_applications = [{ id: "a1", applicant_name: "Fixture One", credentials_md: "Fixture credentials text.", madhhab: null, field: null, links: [], status: "submitted", decision_note: null, created_at: "2026-11-01T10:00:00Z" }];
    render(<AdminApplications locale="en" />);
    expect(await screen.findByText("Fixture One")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start review" })).toBeNull();
    expect(screen.getByText(/Only an administrator can move an application/)).toBeInTheDocument();
  });
});

describe("/admin/site", () => {
  const links = [
    { href: "/prophets", label: "Prophets", locked: false },
    { href: "/stories", label: "Stories", locked: false },
    { href: "/quran", label: "Quran", locked: true },
  ];
  const fallbacks = Object.fromEntries(
    ["home.hero.kicker", "home.hero.title", "home.hero.lead", "home.intro.kicker", "home.intro.title", "home.intro.body"].map((k) => [k, { en: `Built-in ${k}`, ar: "نص مدمج", ur: "بنا بنایا متن" }]),
  ) as never;

  test("the editor shows the built-in wording, needs a note, refuses HTML and sends a validated value", async () => {
    render(<AdminSite locale="en" links={links} fallbacks={fallbacks} />);
    const block = await screen.findByTestId("text-home.hero.title");
    const en = block.querySelector<HTMLTextAreaElement>("#home-hero-title-en")!;
    const save = block.querySelector<HTMLButtonElement>("button.zq-btn-primary")!;
    expect(en.value).toBe("");
    expect(block).toHaveTextContent("Built-in home.hero.title");
    fireEvent.change(en, { target: { value: "<b>Bold</b>" } });
    const note = block.querySelector<HTMLInputElement>("#home-hero-title-note")!;
    expect(save).toBeDisabled(); // no note yet
    fireEvent.change(note, { target: { value: "Try HTML" } });
    fireEvent.click(save);
    expect(await screen.findByText(/HTML is not allowed/)).toBeInTheDocument();
    expect(state.calls).toEqual([]);
    fireEvent.change(en, { target: { value: "A new title" } });
    fireEvent.click(save);
    await waitFor(() => expect(state.calls).toEqual([{ url: "/api/admin/site", body: { action: "text", key: "home.hero.title", value: { en: "A new title" }, note: "Try HTML" } }]));
  });

  test("menus: reorder, hide, preview; the Quran has no hide button; saving sends the order and the hidden list", async () => {
    render(<AdminSite locale="en" links={links} fallbacks={fallbacks} />);
    const editor = await screen.findByTestId("menu-editor");
    expect(editor.querySelector("[aria-label='Hide Quran']")).toBeNull();
    expect(editor).toHaveTextContent("Always shown");
    fireEvent.click(screen.getByRole("button", { name: "Move Stories up" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Prophets" }));
    expect(screen.getByTestId("menu-preview").textContent).toBe("StoriesQuran");
    const save = screen.getByRole("button", { name: "Save menus" });
    expect(save).toBeDisabled();
    fireEvent.change(document.getElementById("sa-menu-note")!, { target: { value: "Rework menus" } });
    fireEvent.click(save);
    await waitFor(() => expect(state.calls).toEqual([{ url: "/api/admin/site", body: { action: "nav", hrefs: ["/stories", "/prophets", "/quran"], hidden: ["/prophets"], note: "Rework menus" } }]));
  });

  test("history offers a revert for an older version only, and needs a note", async () => {
    state.tables.feature_flags = [{ key: "module.stories", enabled: false, version: 2 }];
    state.tables.site_config_revisions = [
      { id: 2, kind: "flag", key: "module.stories", version: 2, value: { enabled: false }, note: "Hide it", changed_at: "2026-11-01T10:00:00Z" },
      { id: 1, kind: "flag", key: "module.stories", version: 1, value: { enabled: true }, note: "Show it", changed_at: "2026-11-01T09:00:00Z" },
    ];
    render(<AdminSite locale="en" links={links} fallbacks={fallbacks} />);
    const list = await screen.findByTestId("site-history");
    expect(list).toHaveTextContent("Current");
    const revert = screen.getByRole("button", { name: "Revert to this version" });
    expect(revert).toBeDisabled();
    fireEvent.change(document.getElementById("sa-revert-note")!, { target: { value: "Show it again" } });
    fireEvent.click(revert);
    await waitFor(() => expect(state.calls).toEqual([{ url: "/api/admin/site", body: { action: "revert", kind: "flag", key: "module.stories", version: 1, note: "Show it again" } }]));
  });
});
