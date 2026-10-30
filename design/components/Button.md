# Button

Actions: one `primary` per view (the main journey — "Begin with Adam", "Publish"), `secondary` for alternatives, `quiet` for inline tools, `danger` only for destructive moderation/account actions.

- Provide `children` (a verb phrase, sentence case) and `onClick`; optional `icon`, `size="sm"`, `loading`, `disabled`.
- `loading` disables the button and sets `aria-busy`; keep the label ("Saving").
- Never style a link as a primary button for navigation inside reading flows — use a text link.
- Features not yet wired: do not render an enabled button; render `disabled` with a visible "Coming soon" note nearby, or omit it.
