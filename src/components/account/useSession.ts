"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/env";

export type SessionState =
  | { status: "loading" }
  | { status: "unavailable" } // Supabase is not configured in this deployment
  | { status: "signed_out" }
  | { status: "signed_in"; user: User };

export function useSession(): SessionState {
  const [s, setS] = useState<SessionState>({ status: "loading" });
  useEffect(() => {
    if (!supabaseConfigured()) {
      setS({ status: "unavailable" });
      return;
    }
    // Loaded on demand so reading pages don't ship the auth client in their first load.
    let live = true;
    let unsub: (() => void) | undefined;
    import("@/lib/supabase/browser").then(({ getBrowserSupabase }) => {
      const sb = getBrowserSupabase();
      if (!sb || !live) return;
      sb.auth.getUser().then(({ data }) => {
        if (live) setS(data.user ? { status: "signed_in", user: data.user } : { status: "signed_out" });
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
        if (live) setS(session?.user ? { status: "signed_in", user: session.user } : { status: "signed_out" });
      });
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => {
      live = false;
      unsub?.();
    };
  }, []);
  return s;
}
