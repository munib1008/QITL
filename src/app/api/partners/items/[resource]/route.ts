import type { NextRequest } from "next/server";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody, requireUser } from "@/lib/api";
import {
  AvailabilityInput,
  ContactInput,
  FileInput,
  MemberInput,
  QualificationInput,
  ServiceInput,
  PricingInput,
  pricingRow,
} from "@/lib/partners/validation";

/**
 * The provider's child records, one route for all of them: POST creates, PUT replaces the editable fields of one
 * (?id=), DELETE removes one (?id=). Who may write what is decided by RLS (owner and admin: profile data, contacts,
 * qualifications, documents; plus instructors: courses, prices, times; only the owner: the team). Verdict fields
 * (a qualification's status, verifications) have no column grant, so they cannot be sent through here.
 */
const uuid = z.string().uuid();
const parent = (k: string) => z.object({ [k]: uuid }).passthrough();

interface Res {
  table: string;
  parentKey: string | null;
  schema: ZodTypeAny;
  prepare?: (v: Record<string, unknown>) => Record<string, unknown>;
  updatable: boolean;
}
const RESOURCES: Record<string, Res> = {
  contacts: { table: "partner_contact_methods", parentKey: "partner_id", schema: ContactInput, updatable: true },
  services: { table: "partner_services", parentKey: "partner_id", schema: ServiceInput, updatable: true },
  pricing: { table: "partner_service_pricing", parentKey: "service_id", schema: PricingInput, prepare: (v) => pricingRow(v as never), updatable: true },
  availability: { table: "partner_service_availability", parentKey: "service_id", schema: AvailabilityInput, updatable: true },
  qualifications: { table: "partner_qualifications", parentKey: "partner_id", schema: QualificationInput, updatable: true },
  files: { table: "partner_qualification_files", parentKey: "partner_id", schema: FileInput, updatable: false },
  members: { table: "partner_members", parentKey: "partner_id", schema: MemberInput, updatable: false },
};

async function body(req: NextRequest, r: Res) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "bad_json", "The request body must be JSON.");
  }
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { [r.parentKey ?? "_"]: parentId, ...rest } = obj;
  const parsed = r.schema.safeParse(rest);
  if (!parsed.success) return fail(422, "invalid", "The request is not valid.", parsed.error.flatten());
  return { parentId, values: (r.prepare ? r.prepare(parsed.data as Record<string, unknown>) : parsed.data) as Record<string, unknown> };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const r = RESOURCES[(await params).resource];
  if (!r) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await body(req, r);
  if (isResponse(b)) return b;
  const p = r.parentKey ? parent(r.parentKey).safeParse({ [r.parentKey]: b.parentId }) : null;
  if (r.parentKey && !p?.success) return fail(422, "invalid", "The request is not valid.");
  const row: Record<string, unknown> = { ...b.values, ...(r.parentKey ? { [r.parentKey]: b.parentId } : {}) };
  if (r.table === "partner_qualification_files" && !String(row.storage_path).startsWith(`${String(b.parentId)}/`)) return fail(422, "invalid", "The file is not in this listing's folder.");
  const { data, error } = await a.sb.from(r.table).insert(row).select();
  if (error) return dbError(error);
  return json({ ok: true, row: data?.[0] ?? null }, 201);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const r = RESOURCES[(await params).resource];
  if (!r || !r.updatable) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const id = uuid.safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return fail(422, "invalid", "The request is not valid.");
  const b = await body(req, r);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb.from(r.table).update(b.values).eq("id", id.data).select();
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true, row: data[0] });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const resource = (await params).resource;
  const r = RESOURCES[resource];
  if (!r) return fail(404, "not_found", "Not found.");
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  let q = a.sb.from(r.table).delete();
  if (resource === "members") {
    // Members have a composite key: ?partner=<id>&user=<id>.
    const pid = uuid.safeParse(req.nextUrl.searchParams.get("partner"));
    const uid = uuid.safeParse(req.nextUrl.searchParams.get("user"));
    if (!pid.success || !uid.success) return fail(422, "invalid", "The request is not valid.");
    q = q.eq("partner_id", pid.data).eq("user_id", uid.data);
  } else if (resource === "files") {
    const qid = uuid.safeParse(req.nextUrl.searchParams.get("id"));
    if (!qid.success) return fail(422, "invalid", "The request is not valid.");
    q = q.eq("qualification_id", qid.data);
  } else {
    const id = uuid.safeParse(req.nextUrl.searchParams.get("id"));
    if (!id.success) return fail(422, "invalid", "The request is not valid.");
    q = q.eq("id", id.data);
  }
  const { data, error } = await q.select();
  if (error) return dbError(error);
  if (!data?.length) return fail(404, "not_found", "Not found.");
  return json({ ok: true });
}
