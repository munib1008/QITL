/**
 * Regenerates the generated Event Universe migrations from content/events:
 *
 *  - supabase/migrations/20261031002451_event_universe_inventory.sql from inventory.draft.json MINUS the references listed in
 *    inventory-additions.json. That migration is already applied in production and is frozen: the file written here is
 *    byte-identical to it (tests/unit/events.test.ts compares), so running this script never changes it.
 *  - the additive migration named in inventory-additions.json (only the new event_verse_refs rows).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { additionsSql, baseInventory, inventorySql, type Inventory, type InventoryAdditions } from "../src/lib/events/seed-sql";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inv = JSON.parse(readFileSync(join(root, "content", "events", "inventory.draft.json"), "utf8")) as Inventory;
const add = JSON.parse(readFileSync(join(root, "content", "events", "inventory-additions.json"), "utf8")) as InventoryAdditions;
writeFileSync(join(root, "supabase", "migrations", "20261031002451_event_universe_inventory.sql"), inventorySql(baseInventory(inv, add)));
writeFileSync(join(root, "supabase", "migrations", add.migration), additionsSql(inv, add));
console.log(`Wrote ${inv.items.length} draft shells (base) and ${add.added.reduce((s, a) => s + a.refs.length, 0)} added references (${add.migration}).`);
