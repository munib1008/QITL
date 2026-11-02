import type { PricingRow } from "./types";

/** Strings the price line needs (from partnersStrings(locale).pricing). */
export interface PriceLabels {
  types: Record<string, string>;
  units: Record<string, string>;
  per: (amount: string, unit: string) => string;
  classes: (n: number) => string;
  registrationFee: (amount: string) => string;
  materialsFee: (amount: string) => string;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * One price as the PROVIDER states it, e.g. "£40.00 / month". Free, donation and on-request show their name only: the
 * database guarantees they carry no amount. Fees are listed separately, never summed into a total, because QITL does
 * not compute or collect what a learner pays.
 */
export function priceLines(p: PricingRow, labels: PriceLabels, locale: string): string[] {
  const out: string[] = [];
  const amount = num(p.amount);
  if (amount === null || !p.currency) out.push(labels.types[p.pricing_type] ?? p.pricing_type);
  else out.push(labels.per(formatMoney(amount, p.currency, locale), labels.units[p.unit ?? ""] ?? p.unit ?? ""));
  if (p.classes_included) out.push(labels.classes(p.classes_included));
  const reg = num(p.registration_fee);
  const mat = num(p.materials_fee);
  if (reg !== null && p.currency) out.push(labels.registrationFee(formatMoney(reg, p.currency, locale)));
  if (mat !== null && p.currency) out.push(labels.materialsFee(formatMoney(mat, p.currency, locale)));
  if (p.fees_note) out.push(p.fees_note);
  return out;
}
