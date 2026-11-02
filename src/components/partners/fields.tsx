"use client";

import type { ReactNode } from "react";

/** Small labelled form controls shared by the dashboard and the admin console (the repo's zq-field / zq-input classes). */
export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
  min,
  max,
  step,
  help,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  help?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="zq-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="zq-input" type={type} value={value} required={required} maxLength={maxLength} min={min} max={max} step={step} dir={dir} aria-describedby={help ? `${id}-d` : undefined} onChange={(e) => onChange(e.target.value)} />
      {help ? (
        <span className="zq-help" id={`${id}-d`}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

export function AreaField({ id, label, value, onChange, rows = 4, maxLength, required, help }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; required?: boolean; help?: string }) {
  return (
    <div className="zq-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="zq-textarea" rows={rows} value={value} maxLength={maxLength} required={required} aria-describedby={help ? `${id}-d` : undefined} onChange={(e) => onChange(e.target.value)} />
      {help ? (
        <span className="zq-help" id={`${id}-d`}>
          {help}
        </span>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
  blank,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  required?: boolean;
  blank?: string;
}) {
  return (
    <div className="zq-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="zq-input" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
        {blank !== undefined ? <option value="">{blank}</option> : null}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({ id, label, checked, onChange }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pt-choice" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
