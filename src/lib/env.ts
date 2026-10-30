/**
 * Environment access. Public values are read through NEXT_PUBLIC_*; server-only secrets never leave the server.
 * When Supabase is not configured, account features render a visible "not configured" state instead of failing.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  mapTilesUrl: process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "",
  mapAttribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? "",
};

export function supabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function mapConfigured(): boolean {
  return Boolean(publicEnv.mapTilesUrl && publicEnv.mapAttribution);
}
