import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { decodeIntent, encodeIntent, safeReturnTo } from "@/lib/validation";

/**
 * Magic-link and OAuth callback. Exchanges the code for a session, then returns the reader to the page they
 * came from. A pending action (e.g. a bookmark) is carried back as ?intent= and the page asks the reader to
 * confirm it; nothing is saved automatically.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const intent = decodeIntent(url.searchParams.get("intent"));
  const sb = await getServerSupabase();
  if (!sb || !code) return NextResponse.redirect(new URL(`/sign-in?error=callback&returnTo=${encodeURIComponent(returnTo)}`, url.origin));
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/sign-in?error=expired&returnTo=${encodeURIComponent(returnTo)}`, url.origin));
  const dest = new URL(returnTo, url.origin);
  if (intent) dest.searchParams.set("intent", encodeIntent(intent));
  return NextResponse.redirect(dest);
}
