// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/** Concept art in design/concepts/ is unreviewed: no app code, style or public file may point into it. */
const root = join(__dirname, "..", "..");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe("concept assets stay out of the site", () => {
  test("src/ never references design/concepts", () => {
    const hits = walk(join(root, "src"))
      .filter((f) => /\.(tsx?|css|json|mjs)$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("design/concepts"));
    expect(hits).toEqual([]);
  });
  test("no concept file was copied into public/", () => {
    const concepts = new Set(walk(join(root, "design", "concepts")).map((f) => f.split(/[\\/]/).pop()));
    const copied = walk(join(root, "public")).filter((f) => concepts.has(f.split(/[\\/]/).pop()));
    expect(copied).toEqual([]);
  });
});
