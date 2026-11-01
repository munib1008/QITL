import { z } from "zod";
import { NOTE_MAX, NOTE_MIN, SITE_PATH, TEXT_KEY_LIST } from "./config";

const Note = z.string().trim().min(NOTE_MIN).max(NOTE_MAX);
const Href = z.string().max(60).regex(SITE_PATH);

/** The administrator's edits, as /api/admin/site receives them. Limits are checked again in config.ts and in the database. */
export const SiteEditInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("text"), key: z.enum(TEXT_KEY_LIST as [string, ...string[]]), value: z.record(z.string(), z.string().max(2000)), note: Note }).strict(),
  z.object({ action: z.literal("nav"), hrefs: z.array(Href).max(40), hidden: z.array(Href).max(40), note: Note }).strict(),
  z.object({ action: z.literal("revert"), kind: z.enum(["setting", "flag"]), key: z.string().regex(/^[a-z0-9_.]{1,80}$/), version: z.number().int().min(1), note: Note }).strict(),
]);
export type SiteEditInput = z.infer<typeof SiteEditInput>;
