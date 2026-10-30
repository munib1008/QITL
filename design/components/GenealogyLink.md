# GenealogyLink

A node–edge–node unit of the genealogy explorer. Edge style carries the evidence: solid = sourced, double = disputed (competing lines), dotted = unknown link.

- Provide `from`, `to` (`{name, generation, current, unknown, onClick}`), `relation`, `status`.
- Every edge opens the reviewed claim behind it. Parent–child edges are never auto-derived from text.
- Do not render or imply a "last descendant of Muhammad ﷺ"; show established lines through Fatimah (رضي الله عنها) and only sourced later branches.
