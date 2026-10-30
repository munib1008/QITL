/** Pure helpers for the Life Guidance editor (unit-tested; the database enforces the same rules again). */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClaimLinkInput {
  claim_id: string;
  layer: "revelation" | "scholarly_interpretation";
  scholar_name: string | null;
  work_title: string | null;
  locator: string | null;
  position: number;
}

/** Revelation claim ids, separated by spaces, commas or new lines. */
export function parseRevelationIds(text: string): { rows: ClaimLinkInput[]; errors: string[] } {
  const ids = text.split(/[\s,]+/).filter(Boolean);
  const errors = ids.filter((id) => !UUID.test(id)).map((id) => `"${id}" is not a claim id`);
  const rows = ids
    .filter((id) => UUID.test(id))
    .map((claim_id, i) => ({ claim_id: claim_id.toLowerCase(), layer: "revelation" as const, scholar_name: null, work_title: null, locator: null, position: i + 1 }));
  return { rows, errors };
}

/** One scholarly explanation per line: "claim id | scholar | work | locator (optional)". */
export function parseScholarLines(text: string): { rows: ClaimLinkInput[]; errors: string[] } {
  const rows: ClaimLinkInput[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [id = "", scholar = "", work = "", locator = ""] = line.split("|").map((p) => p.trim());
      if (!UUID.test(id)) return errors.push(`Line ${i + 1}: the first part must be a claim id`);
      if (scholar.length < 2 || work.length < 2) return errors.push(`Line ${i + 1}: name the scholar and the work`);
      rows.push({ claim_id: id.toLowerCase(), layer: "scholarly_interpretation", scholar_name: scholar, work_title: work, locator: locator || null, position: i + 1 });
    });
  return { rows, errors };
}
