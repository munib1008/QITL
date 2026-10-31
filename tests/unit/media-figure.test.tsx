import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MediaFigure } from "@/components/media/MediaFigure";
import type { PublicMediaRow } from "@/lib/media/render";

vi.mock("server-only", () => ({}));

const row: PublicMediaRow = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "image",
  category: "pattern",
  alt_text: "A geometric rosette in green",
  alt_text_ar: "زخرفة هندسية",
  alt_text_ur: null,
  caption_en: "A rosette from the fixture set",
  caption_ar: null,
  caption_ur: null,
  credit: "Fixture credit",
  file_id: "22222222-2222-4222-8222-222222222222",
  version: 1,
  storage_path: "assets/22222222-2222-4222-8222-222222222222/original.png",
  mime_type: "image/png",
  width: 800,
  height: 600,
  variants: [
    { w: 320, h: 240, name: "w320.webp" },
    { w: 640, h: 480, name: "w640.webp" },
  ],
  attribution: "Fixture licence attribution",
  licence: null,
  license_url: null,
};

describe("<MediaFigure>", () => {
  test("renders a WebP rendition with alt text in the reader's language and a visible credit line", () => {
    render(<MediaFigure row={row} locale="ar" supabaseUrl="https://x.supabase.co" />);
    const img = screen.getByRole("img", { name: "زخرفة هندسية" });
    expect(img).toHaveAttribute("lang", "ar");
    expect(img.getAttribute("src")).toMatch(/\/storage\/v1\/object\/public\/media\/assets\/22222222-2222-4222-8222-222222222222\/w\d+\.webp$/);
    expect(img.getAttribute("srcset")).toContain("w640.webp");
    expect(screen.getByTestId("media-credit")).toHaveTextContent("Fixture credit · Fixture licence attribution");
    // No Arabic caption: the English one, marked as English.
    expect(screen.getByText("A rosette from the fixture set")).toHaveAttribute("lang", "en");
  });

  test("falls back to English alt text", () => {
    render(<MediaFigure row={row} locale="ur" supabaseUrl="https://x.supabase.co" />);
    expect(screen.getByRole("img", { name: "A geometric rosette in green" })).toHaveAttribute("lang", "en");
  });

  test("never renders a file still in pending/", () => {
    render(<MediaFigure row={{ ...row, storage_path: "pending/22222222-2222-4222-8222-222222222222/original.png" }} locale="en" supabaseUrl="https://x.supabase.co" fallback={<p>fallback</p>} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });
});

describe("<MediaImage>", () => {
  test("renders the fallback when the database is not configured or the asset is not public", async () => {
    vi.resetModules();
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    vi.doMock("@/lib/supabase/server", () => ({
      getPublicSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    }));
    const { MediaImage } = await import("@/components/media/MediaImage");
    render(await MediaImage({ assetId: row.id, locale: "en", fallback: <p>not public</p> }));
    expect(screen.getByText("not public")).toBeInTheDocument();
    expect(maybeSingle).toHaveBeenCalledOnce();
    render(await MediaImage({ assetId: "not-a-uuid", locale: "en", fallback: <p>bad id</p> }));
    expect(screen.getByText("bad id")).toBeInTheDocument();
  });
});
