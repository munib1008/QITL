"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/account/useSession";
import { stripLocale } from "@/lib/i18n";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { useLocale } from "@/lib/i18n/useLocale";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/** Optional account entry. Reading never needs it; when accounts are not configured it is not shown as working. */
export function AccountLink({ signInLabel, accountLabel }: { signInLabel: string; accountLabel: string }) {
  const s = useSession();
  const pathname = usePathname();
  const t = uiStrings(useLocale()).shell;
  if (s.status === "signed_in")
    return (
      <>
        <NotificationBell />
        <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" href="/account" prefetch={false}>
          {accountLabel}
        </Link>
      </>
    );
  if (s.status === "unavailable")
    return (
      <span className="zq-soon" title={t.accountsSoonTitle}>
        {t.accountsSoon}
      </span>
    );
  return (
    <Link className="zq-btn zq-btn-secondary zq-btn-sm zq-btn-link" prefetch={false} href={`/sign-in?returnTo=${encodeURIComponent(stripLocale(pathname))}`} aria-disabled={s.status === "loading" || undefined}>
      {signInLabel}
    </Link>
  );
}
