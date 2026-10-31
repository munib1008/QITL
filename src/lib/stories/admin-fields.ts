/** The text fields of a chapter, one per depth mode (admin form). */
export const MODE_FIELDS: Array<{ column: "body_md" | "summary_md" | "deep_md" | "kids_md" | "lessons_md"; label: string; help: string; max: number }> = [
  { column: "body_md", label: "Complete story", help: "Markdown. Paraphrase; never paste an unlicensed translation. Every statement must be one of the chapter's claims.", max: 20000 },
  { column: "summary_md", label: "One-minute summary", help: "A true summary of the reviewed chapter, in about a minute of reading. Leave empty if not written: readers see 'not established', nothing is generated.", max: 4000 },
  { column: "deep_md", label: "Deep study", help: "Scholarly detail added to the complete story (disagreements, language notes, context). Cite it through the chapter's claims.", max: 40000 },
  { column: "kids_md", label: "Kids mode", help: "Short sentences and simple lessons resting on the same claims. No dialogue or detail the sources do not give; no depiction of prophets, angels or jinn.", max: 8000 },
  { column: "lessons_md", label: "Life lessons", help: "Modern applications. Readers see them labelled as educational interpretation, not as part of the sourced account.", max: 8000 },
];
