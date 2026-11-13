import { describe, expect, it } from "vitest";
import { LazyMotion, domAnimation } from "motion/react";

/**
 * Smoke import only. `motion` is installed for the Phase 2 map and is not used by any component yet.
 * Haptics are not implemented; when they arrive in Phase 2 they ship OFF by default.
 */
describe("motion dependency", () => {
  it("exposes LazyMotion and the domAnimation feature bundle", () => {
    expect(LazyMotion).toBeDefined();
    expect(domAnimation).toBeDefined();
  });
});
