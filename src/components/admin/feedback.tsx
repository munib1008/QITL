import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminSharedStrings } from "@/lib/i18n/modules/adminShared";

/**
 * A status or error line in the admin editors. In English the text is exactly what it always was. In Arabic and Urdu
 * the text is a localised sentence and `server` carries a message that came from the server or the database: it is the
 * audit wording, so it is shown verbatim in a lang="en" span after the localised prefix.
 */
export type AdminMsg = { tone: "ok" | "err"; text: string; server?: string } | null;

/** An error: English shows the message alone; Arabic and Urdu show the localised prefix and then the message verbatim. */
export function errMsg(locale: string, prefix: string, message: string, notConfigured?: string): NonNullable<AdminMsg> {
  if (notConfigured && message === "Not configured") return { tone: "err", text: notConfigured };
  return locale === "en" ? { tone: "err", text: message } : { tone: "err", text: prefix, server: message };
}

/** A success line that ends with a server-provided note (for example the next step the API names). */
export function okMsg(text: string, server?: string): NonNullable<AdminMsg> {
  return server ? { tone: "ok", text, server } : { tone: "ok", text };
}

export function ServerText({ children }: { children: ReactNode }) {
  return (
    <span lang="en" dir="ltr">
      {children}
    </span>
  );
}

export function AdminFeedback({ msg }: { msg: AdminMsg }) {
  if (!msg) return null;
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
      {msg.text}
      {msg.server ? (
        <>
          {" "}
          <ServerText>{msg.server}</ServerText>
        </>
      ) : null}
    </p>
  );
}

/** A load error: "Not configured" is the screen's own word and is localised; anything else is the database's message, kept verbatim. */
export function LoadErrorText({ error }: { error: string }) {
  const t = adminSharedStrings(useLocale());
  return error === "Not configured" ? <>{t.notConfigured}</> : <ServerText>{error}</ServerText>;
}
