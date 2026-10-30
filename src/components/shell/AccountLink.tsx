"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/account/useSession";
import { stripLocale } from "@/lib/i18n";

/** Optional account entry. Reading never needs it; when accounts are not configured it is not shown as working. */
export function AccountLink({ signInLabel, accountLabel }: { signInLabel: string; accountLabel: string }) {
  const s = useSession();
  const pathname = usePathname();
  if (s.status === "signed_in")
    return (
      <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href="/account">
        {accountLabel}
      </Link>
    );
  if (s.status === "unavailable")
    return (
      <span className="zq-soon" title="Reading never needs an account">
        Accounts coming soon
      </span>
    );
  return (
    <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href={`/sign-in?returnTo=${encodeURIComponent(stripLocale(pathname))}`} aria-disabled={s.status === "loading" || undefined}>
      {signInLabel}
    </Link>
  );
}
