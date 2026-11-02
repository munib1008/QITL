import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { INQUIRY_CONSENT_VERSION } from "@/lib/partners/constants";
import { InquiryInput } from "@/lib/partners/validation";

/**
 * A learner's inquiry to a provider. The learner must have ticked the consent text (stored with the version). It is
 * visible only to the learner, the provider's inquiry-authorised members and staff; rate limits, link limits and
 * duplicate checks live in the database (guard_partner_inquiry), so they hold across server instances.
 */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, InquiryInput);
  if (isResponse(b)) return b;
  const { data, error } = await a.sb
    .from("partner_inquiries")
    .insert({
      partner_id: b.partner_id,
      service_id: b.service_id,
      learner_alias: b.learner_alias,
      for_child: b.for_child,
      subject: b.subject,
      message: b.message,
      consent: true,
      consent_version: INQUIRY_CONSENT_VERSION,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  return json({ ok: true, id: data.id }, 201);
}
