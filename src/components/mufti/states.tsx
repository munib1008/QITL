import Link from "next/link";
import { EmptyState } from "@/components/ui/misc";
import { getDict } from "@/lib/i18n";

/** Designed "not configured" state: the feature needs the database, and nothing is mocked. */
export function NotConfigured({ locale, title, body }: { locale: string; title: string; body: string }) {
  const { t } = getDict(locale);
  return (
    <EmptyState tone="soon" label={<span className="zq-soon">{t.bottom.soon}</span>} title={title}>
      <p>{body}</p>
    </EmptyState>
  );
}

/** Signed-out state for a page that needs an account. */
export function SignInNeeded({ title, link, returnTo }: { title: string; link: string; returnTo: string }) {
  return (
    <EmptyState title={title}>
      <p>
        <Link className="zq-btn zq-btn-primary" href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
          {link}
        </Link>
      </p>
    </EmptyState>
  );
}
