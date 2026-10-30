import { notFound } from "next/navigation";

/** Any unmatched path inside a locale renders the designed 404. */
export default function CatchAll() {
  notFound();
}
