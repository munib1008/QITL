/** Regenerates supabase/migrations/20261031002451_event_universe_inventory.sql from content/events/inventory.draft.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inventorySql, type Inventory } from "../src/lib/events/seed-sql";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inv = JSON.parse(readFileSync(join(root, "content", "events", "inventory.draft.json"), "utf8")) as Inventory;
writeFileSync(join(root, "supabase", "migrations", "20261031002451_event_universe_inventory.sql"), inventorySql(inv));
console.log(`Wrote ${inv.items.length} draft shells.`);
