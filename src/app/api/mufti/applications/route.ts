import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { APPLICATION_CONSENT_VERSION, ApplyInput } from "@/lib/mufti-apply";

/**
 * Apply to be considered as a mufti. The application is a request to administrators: it grants no role, creates no
 * profile and verifies nothing. One open application per person, rate limited here (per user) and in the database
 * (throttle trigger); the consent version is stored with it.
 */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, ApplyInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb
    .from("mufti_applications")
    .insert({
      applicant_id: a.user.id,
      applicant_name: b.name,
      credentials_md: b.credentials,
      madhhab: b.madhhab ?? null,
      field: b.field ?? null,
      links: b.links,
      consent_version: APPLICATION_CONSENT_VERSION,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ ok: true, id: data.id }, 201);
}
