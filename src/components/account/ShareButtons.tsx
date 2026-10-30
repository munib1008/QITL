"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";

export function CopyCitationButton({ text, label = "Cite this page" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <button
      type="button"
      className="zq-btn zq-btn-quiet"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "done" ? <Icon.check /> : <Icon.copy />}
      {state === "done" ? "Citation copied" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}

/** Native share sheet where available; otherwise copies the link. */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="zq-btn zq-btn-quiet"
      aria-live="polite"
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            // dismissed: fall through to copy
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // nothing else to do
        }
      }}
    >
      <Icon.share />
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
