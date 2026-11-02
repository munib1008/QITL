"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { AdminMsg } from "./feedback";

const TARGETS = [
  { type: "story", table: "stories" },
  { type: "person", table: "people" },
  { type: "event", table: "historical_events" },
] as const;

interface Link {
  entity_type: string;
  entity_id: string;
}

/**
 * Attaches a library item (image, GIF or clip) to a story, a person (a prophet's profile) or an event. Editors only
 * (row-level security on asset_links). The link shows nothing publicly until the ITEM is published; it never publishes it.
 */
export function AttachMedia({ assetId, t, setMsg }: { assetId: string; t: Record<string, unknown>; setMsg: (m: AdminMsg) => void }) {
  const sb = getBrowserSupabase();
  const [links, setLinks] = useState<Link[]>([]);
  const [type, setType] = useState<(typeof TARGETS)[number]["type"]>("story");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const s = t as Record<string, string>;

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("asset_links").select("entity_type, entity_id").eq("asset_id", assetId);
    setLinks((data ?? []) as Link[]);
  }, [sb, assetId]);
  useEffect(() => {
    void load();
  }, [load]);

  const attach = async (e: FormEvent) => {
    e.preventDefault();
    if (!sb) return;
    const target = TARGETS.find((x) => x.type === type)!;
    const id = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(id)) return setMsg({ tone: "err", text: s.attachBadSlug! });
    setBusy(true);
    const found = await sb.from(target.table).select("id").eq("slug", id).maybeSingle();
    if (!found.data) {
      setBusy(false);
      return setMsg({ tone: "err", text: s.attachNotFound! });
    }
    const { error } = await sb.from("asset_links").insert({ asset_id: assetId, entity_type: type, entity_id: id });
    setBusy(false);
    if (error) return setMsg({ tone: "err", text: `${s.failedPrefix} ${error.message}` });
    setSlug("");
    setMsg({ tone: "ok", text: s.attachDone! });
    await load();
  };
  const detach = async (l: Link) => {
    if (!sb) return;
    const { error } = await sb.from("asset_links").delete().eq("asset_id", assetId).eq("entity_type", l.entity_type).eq("entity_id", l.entity_id);
    if (error) return setMsg({ tone: "err", text: `${s.failedPrefix} ${error.message}` });
    await load();
  };

  return (
    <details data-testid="attach-media">
      <summary>{s.attachTitle}</summary>
      <p className="zq-meta">{s.attachHelp}</p>
      {links.length ? (
        <ul className="zq-meta">
          {links.map((l) => (
            <li key={`${l.entity_type}:${l.entity_id}`}>
              {s[`target_${l.entity_type}`] ?? l.entity_type} Â· {l.entity_id}{" "}
              <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => detach(l)}>
                {s.detach}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={attach} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
        <div className="zq-field">
          <label htmlFor={`att-t-${assetId}`}>{s.attachTo}</label>
          <select id={`att-t-${assetId}`} className="zq-input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TARGETS.map((x) => (
              <option key={x.type} value={x.type}>
                {s[`target_${x.type}`]}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor={`att-s-${assetId}`}>{s.attachSlug}</label>
          <input id={`att-s-${assetId}`} className="zq-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="yusuf" dir="ltr" />
        </div>
        <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={busy || !slug.trim()}>
          {s.attach}
        </button>
      </form>
    </details>
  );
}
