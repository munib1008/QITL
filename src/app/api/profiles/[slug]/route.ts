import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, notConfigured, publicJson } from "@/lib/api";
import { getPersonProfile } from "@/lib/data/profiles";

/** A prophet's published profile: facts and the three reading depths, each section with its evidence. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!z.string().regex(/^[a-z0-9-]{1,80}$/).safeParse(slug).success) return fail(404, "not_found", "Not found.");
  const r = await getPersonProfile(slug);
  if (r.state === "not_configured") return notConfigured();
  if (r.state === "error") return fail(500, "server_error", "Something went wrong on our side.");
  return publicJson({ slug, profile: r.profile });
}
