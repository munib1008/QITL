const BACKSLASH = String.fromCharCode(92);
const UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

/**
 * JSON for an inline <script type="application/ld+json">: escapes "<", ">", "&" and the JavaScript line separators as
 * JSON unicode escapes, so no value (a title, a URL from the environment, later perhaps editorial text) can close the
 * script element early. JSON.parse gives back the original value.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(UNSAFE, (c) => `${BACKSLASH}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
