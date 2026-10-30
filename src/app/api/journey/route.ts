import { getJourney } from "@/content/journey";
import { publicJson } from "@/lib/api";

/** The journey content (draft until reviewed; `status` says so). */
export function GET() {
  return publicJson(getJourney(), 3600);
}
