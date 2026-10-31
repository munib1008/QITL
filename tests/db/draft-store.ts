import type { Db } from "./harness";
import { IMPORT_TABLES, type Filter, type ImportStore, type ImportTable, type Row } from "../../src/lib/stories/draft-import";

/** The draft importer's ImportStore over PGlite (the owner role; the service role bypasses RLS in the same way). */
export class PgStore implements ImportStore {
  constructor(private readonly db: Db) {}
  private check(table: string, cols: string[]) {
    if (!(IMPORT_TABLES as readonly string[]).includes(table)) throw new Error(`table ${table} is not importable`);
    for (const c of cols) if (!/^[a-z_]+$/.test(c)) throw new Error(`bad column ${c}`);
  }
  private where(filter: Filter): { sql: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(filter)) {
      if (v === null) parts.push(`${k} is null`);
      else {
        params.push(v);
        parts.push(`${k} = $${params.length}`);
      }
    }
    return { sql: parts.length ? `where ${parts.join(" and ")}` : "", params };
  }
  async select(table: ImportTable, filter: Filter): Promise<Row[]> {
    this.check(table, Object.keys(filter));
    const w = this.where(filter);
    return this.db.admin<Row>(`select * from public.${table} ${w.sql}`, w.params);
  }
  async insert(table: ImportTable, row: Row): Promise<Row> {
    const cols = Object.keys(row);
    this.check(table, cols);
    const rows = await this.db.admin<Row>(`insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`, cols.map((c) => row[c]));
    return rows[0]!;
  }
  async update(table: ImportTable, id: string, patch: Row): Promise<void> {
    const cols = Object.keys(patch);
    this.check(table, cols);
    await this.db.admin(`update public.${table} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} where id = $${cols.length + 1}`, [...cols.map((c) => patch[c]), id]);
  }
  async remove(table: ImportTable, filter: Filter): Promise<void> {
    this.check(table, Object.keys(filter));
    const w = this.where(filter);
    await this.db.admin(`delete from public.${table} ${w.sql}`, w.params);
  }
}
