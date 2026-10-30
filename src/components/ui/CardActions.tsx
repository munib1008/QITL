"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkButton } from "@/components/account/BookmarkButton";
import type { BookmarkTarget } from "@/lib/validation";
import { Icon } from "./icons";

export interface CardActionsProps {
  reference: string;
  bookmark?: BookmarkTarget;
  sourceHref?: string;
  discussHref?: string;
}

/** Bookmark, copy reference, source and discuss. Actions without a target are left out, never mocked. */
export function CardActions({ reference, bookmark, sourceHref, discussHref }: CardActionsProps) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  };
  return (
    <div className="zq-actions" role="group" aria-label="Actions">
      {bookmark ? <BookmarkButton target={bookmark} variant="icon" /> : null}
      <button type="button" className="zq-iconbtn" onClick={copy} aria-live="polite">
        {copied === "done" ? <Icon.check /> : <Icon.copy />}
        {copied === "done" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy reference"}
      </button>
      {sourceHref ? (
        <Link className="zq-iconbtn" href={sourceHref}>
          <Icon.source />
          Source
        </Link>
      ) : null}
      {discussHref ? (
        <Link className="zq-iconbtn" href={discussHref}>
          <Icon.discuss />
          Discuss
        </Link>
      ) : null}
    </div>
  );
}
