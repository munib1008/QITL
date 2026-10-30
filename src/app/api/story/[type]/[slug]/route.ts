import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, notConfigured, publicJson } from "@/lib/api";
import { getStory } from "@/lib/data/story";

const P = z.object({ type: z.enum(["person", "event"]), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });

/** A published story (sections A–F in every reading level, quizzes, approved media) for a prophet or an event. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const p = P.safeParse(await params);
  if (!p.success) return fail(404, "not_found", "Not found.");
  const r = await getStory(p.data.type === "person" ? { person: p.data.slug } : { event: p.data.slug });
  if (r.state === "not_configured") return notConfigured();
  if (r.state === "error") return fail(500, "server_error", "Something went wrong on our side.");
  return publicJson({ ...p.data, story: r.story });
}
