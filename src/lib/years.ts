/**
 * Astronomical year numbering (used in the database: 1 BCE = 0, 2 BCE = -1) to labels people read.
 * There is no year zero in BCE/CE, which is why the database does not store BCE/CE directly.
 */
export function formatYear(astronomical: number): string {
  return astronomical <= 0 ? `${1 - astronomical} BCE` : `${astronomical} CE`;
}

/** "c. 570 CE", "610–632 CE", "5 BCE–30 CE", with AH when the record has it. */
export function formatRange(start: number | null, end: number | null, startAh?: number | null, endAh?: number | null, estimated = false): string | undefined {
  if (start == null) return undefined;
  const sameEra = end == null || (start > 0) === (end > 0);
  let ce: string;
  if (end == null || end === start) ce = formatYear(start);
  else if (sameEra) ce = `${start > 0 ? start : 1 - start}–${formatYear(end)}`;
  else ce = `${formatYear(start)}–${formatYear(end)}`;
  const ah = startAh == null ? "" : ` · ${endAh != null && endAh !== startAh ? `${startAh}–${endAh}` : startAh} AH`;
  return `${estimated ? "c. " : ""}${ce}${ah}`;
}
