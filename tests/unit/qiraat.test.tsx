import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { qiraat, qiraatStrings } from "@/lib/i18n/modules/qiraat";
import { buildRow, PermissionInput } from "@/lib/qiraat/editor";
import { AHRUF_HADITH_REFS, READERS, RIWAYAH_IDS, comparisonColumns, permissionAllowed, recordingMatchesText, riwayahLabel, variantPublishProblems } from "@/lib/qiraat/model";
import { LoadState } from "@/components/qiraat/LoadState";

const UUID = "00000000-0000-4000-8000-000000000001";

describe("reference list", () => {
  test("ten readers, two transmitters each, twenty unique ids, names only", () => {
    expect(READERS).toHaveLength(10);
    expect(READERS.every((r) => r.riwayat.length === 2)).toBe(true);
    expect(new Set(RIWAYAH_IDS).size).toBe(20);
    expect(READERS.map((r) => r.name)).toEqual(["Nafi'", "Ibn Kathir", "Abu 'Amr", "Ibn 'Amir", "'Asim", "Hamzah", "al-Kisa'i", "Abu Ja'far", "Ya'qub", "Khalaf al-'Ashir"]);
    for (const r of READERS) expect(Object.keys(r).sort()).toEqual(["id", "name", "nameAr", "riwayat"]);
  });

  test("riwayah labels", () => {
    expect(riwayahLabel("hafs")).toBe("Hafs 'an 'Asim");
    expect(riwayahLabel("duri_abu_amr")).toBe("al-Duri 'an Abi 'Amr");
    expect(riwayahLabel("duri_kisai")).toBe("al-Duri 'an al-Kisa'i");
    expect(riwayahLabel("ibn_wardan")).toBe("Ibn Wardan 'an Abi Ja'far");
  });

  test("the ahruf narrations are references with numbers only", () => {
    expect(AHRUF_HADITH_REFS.map((h) => `${h.collection} ${h.number}`)).toEqual(["bukhari 4991", "bukhari 4992", "muslim 818"]);
    for (const h of AHRUF_HADITH_REFS) expect(Object.keys(h)).not.toContain("text");
  });
});

describe("permission rules", () => {
  test("allowed = APPROVED, or CONDITIONAL with attribution recorded", () => {
    expect(permissionAllowed({ status: "APPROVED", attribution_text: null })).toBe(true);
    expect(permissionAllowed({ status: "CONDITIONAL", attribution_text: "Credit" })).toBe(true);
    expect(permissionAllowed({ status: "CONDITIONAL", attribution_text: "  " })).toBe(false);
    expect(permissionAllowed({ status: "PERMISSION_REQUIRED", attribution_text: "Credit" })).toBe(false);
    expect(permissionAllowed({ status: "BLOCKED", attribution_text: "Credit" })).toBe(false);
    expect(permissionAllowed(null)).toBe(false);
  });

  test("the registry form refuses APPROVED without evidence and CONDITIONAL without conditions", () => {
    const base = { source_id: UUID, asset_type: "text", status: "APPROVED" };
    expect(PermissionInput.safeParse(base).success).toBe(false);
    expect(PermissionInput.safeParse({ ...base, licence_ref: "Written permission 1", evidence_url: "https://example.test/p" }).success).toBe(true);
    expect(PermissionInput.safeParse({ ...base, status: "CONDITIONAL" }).success).toBe(false);
    expect(PermissionInput.safeParse({ ...base, status: "PERMISSION_REQUIRED", evidence_url: "http://insecure.test" }).success).toBe(false);
    expect(PermissionInput.safeParse({ ...base, status: "MAYBE" }).success).toBe(false);
  });
});

describe("variant and recording rules", () => {
  test("publish problems mirror the database guard", () => {
    expect(variantPublishProblems({ readings: [{ riwayah_id: "hafs", editionAllowed: true }], claims: [], reviewApproved: false })).toEqual([
      "needs readings from at least two riwayat",
      "needs an explanation claim",
      "needs a scholarly approval",
    ]);
    expect(
      variantPublishProblems({
        readings: [
          { riwayah_id: "hafs", editionAllowed: true },
          { riwayah_id: "warsh", editionAllowed: false },
        ],
        claims: [{ status: "draft" }],
        reviewApproved: true,
      }),
    ).toEqual(["every reading's edition must be APPROVED, or CONDITIONAL with attribution recorded", "every explanation claim must be approved"]);
    expect(
      variantPublishProblems({
        readings: [
          { riwayah_id: "hafs", editionAllowed: true },
          { riwayah_id: "warsh", editionAllowed: true },
        ],
        claims: [{ status: "approved" }],
        reviewApproved: true,
      }),
    ).toEqual([]);
  });

  test("text/audio riwayah matching", () => {
    expect(recordingMatchesText({ riwayah_id: "hafs", is_comparison: false, comparison_note: null }, "hafs")).toBe(true);
    expect(recordingMatchesText({ riwayah_id: "warsh", is_comparison: false, comparison_note: null }, "hafs")).toBe(false);
    expect(recordingMatchesText({ riwayah_id: "warsh", is_comparison: true, comparison_note: "short" }, "hafs")).toBe(false);
    expect(recordingMatchesText({ riwayah_id: "warsh", is_comparison: true, comparison_note: "An explained educational comparison." }, "hafs")).toBe(true);
  });

  test("comparison columns follow the reference order", () => {
    const v = { id: "1", surah: 1, ayah: 1, word_position: 1, kind: "vocalization" as const, claims: [] };
    expect(
      comparisonColumns([
        {
          ...v,
          readings: [
            { riwayah_id: "hafs", reading_text: "x", edition_id: UUID },
            { riwayah_id: "qalun", reading_text: "y", edition_id: UUID },
          ],
        },
      ]),
    ).toEqual(["qalun", "hafs"]);
  });

  test("editor rows: readings name their edition, routes carry a citation, recordings need https and an explained comparison", () => {
    expect(buildRow("reading", { variant_id: UUID, riwayah_id: "hafs", edition_id: UUID, reading_text: "x" }).ok).toBe(true);
    expect(buildRow("reading", { variant_id: UUID, riwayah_id: "nobody", edition_id: UUID, reading_text: "x" }).ok).toBe(false);
    expect(buildRow("route", { riwayah_id: "hafs", name_translit: "Fixture" }).ok).toBe(false);
    expect(buildRow("route", { riwayah_id: "hafs", name_translit: "Fixture", claim_id: UUID }).ok).toBe(true);
    const rec = { reciter_id: UUID, riwayah_id: "hafs", source_id: UUID, permission_id: UUID, url: "https://example.test/a.mp3" };
    expect(buildRow("recording", rec).ok).toBe(true);
    expect(buildRow("recording", { ...rec, url: "http://example.test/a.mp3" }).ok).toBe(false);
    expect(buildRow("recording", { ...rec, is_comparison: true, comparison_note: "short" }).ok).toBe(false);
    expect(buildRow("variant", { surah: 115, ayah: 1, word_position: 1, kind: "meaning" }).ok).toBe(false);
  });
});

describe("strings", () => {
  test("Arabic and Urdu only use English keys; only the scholarly distinction points stay English in Urdu", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const en = new Set(keys(qiraat.en));
    for (const k of keys(qiraat.ar)) expect(en.has(k)).toBe(true);
    for (const k of keys(qiraat.ur)) expect(en.has(k)).toBe(true);
    expect(qiraatStrings("ur").compare.emptyTitle).not.toBe(qiraat.en.compare.emptyTitle);
    // Scholarly statements are not translated here; they fall back to English (rendered lang="en").
    expect(qiraatStrings("ur").distinction.points).toEqual(qiraat.en.distinction.points);
    expect(qiraatStrings("ur").riwayah.label).toBe("روایت");
    expect(qiraatStrings("ar").riwayah.current).toContain("حفص");
  });

  test("the distinction panel is labelled as a draft", () => {
    expect(qiraat.en.draft).toBe("Draft — pending scholarly review");
    expect(qiraat.en.distinction.points.join(" ")).toMatch(/not simply seven tribal dialects/);
  });
});

describe("LoadState", () => {
  test("names the missing database and keeps the explanation", () => {
    render(<LoadState state="not_configured" t={qiraat.en.compare} />);
    const box = screen.getByTestId("empty-state");
    expect(within(box).getByText("No comparison can be shown yet.")).toBeInTheDocument();
    expect(within(box).getByText(/Hafs 'an 'Asim from Tanzil/)).toBeInTheDocument();
    expect(within(box).getByText(/not connected/)).toBeInTheDocument();
  });
});
