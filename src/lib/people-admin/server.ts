import "server-only";
import { dbError, fail } from "@/lib/api";
import { plainRefusal } from "./form";

/** A guard's own words when the refusal is one of ours (see plainRefusal), otherwise the shared database-error mapping. */
export function refusal(e: { code?: string; message?: string; details?: string } | null | undefined) {
  const p = plainRefusal(e);
  return p ? fail(p.status, p.code, p.message) : dbError(e);
}
