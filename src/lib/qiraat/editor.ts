import { z } from "zod";
import { ASSET_TYPES, PERMISSION_STATUSES, RIWAYAH_IDS, TRISTATE, VARIANT_KINDS } from "./model";

/**
 * Row builders for the Qira'at editors and the licence registry. Validated here and again by the database (RLS,
 * checks and guards); a draft is never published from here: status moves through /api/admin/status after review.
 */
const riwayah = z.enum(RIWAYAH_IDS as [string, ...string[]]);
const uuid = z.string().uuid();
const https = z.string().trim().regex(/^https:\/\//, "must start with https://").max(1000);
const opt = <T extends z.ZodTypeAny>(s: T) => s.optional().nullable().transform((v) => (v === undefined || v === "" ? null : v));
const text = (max: number) => opt(z.string().trim().max(max));

export const EDITOR_KINDS = {
  variant: {
    table: "qiraat_variants",
    schema: z.object({
      surah: z.coerce.number().int().min(1).max(114),
      ayah: z.coerce.number().int().min(1).max(286),
      word_position: z.coerce.number().int().min(1).max(200),
      kind: z.enum(VARIANT_KINDS),
      editor_note: text(2000),
    }),
  },
  reading: {
    table: "qiraat_variant_readings",
    schema: z.object({ variant_id: uuid, riwayah_id: riwayah, edition_id: uuid, reading_text: z.string().trim().min(1).max(200) }),
  },
  variant_claim: {
    table: "qiraat_variant_claims",
    schema: z.object({ variant_id: uuid, claim_id: uuid, position: z.coerce.number().int().min(1).max(20).default(1) }),
  },
  route: {
    table: "transmission_routes",
    schema: z
      .object({ riwayah_id: riwayah, name_translit: z.string().trim().min(2).max(200), name_ar: text(200), description: text(4000), claim_id: opt(uuid), source_id: opt(uuid), locator: text(500) })
      .refine((r) => r.claim_id || (r.source_id && r.locator), { message: "a route needs its citation: an evidence claim, or a source with a locator" }),
  },
  misconception: {
    table: "qiraat_misconceptions",
    schema: z.object({ question: z.string().trim().min(5).max(300), claim_id: uuid, position: z.coerce.number().int().min(1).max(100).default(1) }),
  },
  reciter: {
    table: "reciters",
    schema: z.object({ name_translit: z.string().trim().min(2).max(200), name_ar: text(200) }),
  },
  recording: {
    table: "audio_recordings",
    schema: z
      .object({
        reciter_id: uuid,
        riwayah_id: riwayah,
        source_id: uuid,
        permission_id: uuid,
        surah: opt(z.coerce.number().int().min(1).max(114)),
        url: https,
        url_kind: z.enum(["file", "stream"]).default("file"),
        shown_with_edition_id: opt(uuid),
        is_comparison: z.boolean().default(false),
        comparison_note: text(2000),
      })
      .refine((r) => !r.is_comparison || (r.comparison_note ?? "").length >= 20, { message: "an educational comparison needs an explanation of at least 20 characters" }),
  },
} as const;

export type EditorKind = keyof typeof EDITOR_KINDS;
export const EDITOR_KIND_KEYS = Object.keys(EDITOR_KINDS) as EditorKind[];

export function buildRow(kind: EditorKind, data: unknown): { ok: true; table: string; row: Record<string, unknown> } | { ok: false; issues: string[] } {
  const def = EDITOR_KINDS[kind];
  const r = (def.schema as z.ZodTypeAny).safeParse(data);
  if (!r.success) return { ok: false, issues: r.error.issues.map((i) => `${i.path.join(".") || kind}: ${i.message}`) };
  return { ok: true, table: def.table, row: r.data as Record<string, unknown> };
}

const tri = z.enum(TRISTATE).default("unknown");

/** A licence registry row (admins only). APPROVED is stamped with the acting admin by the database. */
export const PermissionInput = z
  .object({
    source_id: uuid,
    asset_type: z.enum(ASSET_TYPES),
    scope: z.string().trim().regex(/^[a-z0-9_-]{1,60}$/, "lower-case letters, digits, _ and - only").default("all"),
    status: z.enum(PERMISSION_STATUSES),
    rights_holder: text(300),
    official_url: opt(https),
    edition_version: text(200),
    riwayah_id: opt(riwayah),
    qiraah_riwayah_note: text(300),
    licence_ref: text(500),
    commercial_use: tri,
    local_hosting: tri,
    modification: tri,
    offline_distribution: tri,
    derivative_sync: tri,
    attribution_required: z.boolean().nullable().default(null),
    attribution_text: text(1000),
    api_cache_limits: text(2000),
    obligations: text(2000),
    conditions: text(4000),
    evidence_url: opt(https),
    evidence_summary: text(4000),
    evidence_checked_on: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    notes: text(4000),
    verify: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    if (p.status === "APPROVED" && (!p.licence_ref || !p.evidence_url))
      ctx.addIssue({ code: "custom", path: ["status"], message: "APPROVED needs a licence or written-permission reference and an evidence URL" });
    if (p.status === "CONDITIONAL" && !p.conditions) ctx.addIssue({ code: "custom", path: ["conditions"], message: "CONDITIONAL needs its conditions" });
  });
export type PermissionInput = z.infer<typeof PermissionInput>;
