/**
 * Pluggable malware scanning for uploads. With MALWARE_SCAN_URL set, every upload is POSTed (raw bytes) to that
 * endpoint before it is stored; without it, nothing is scanned and the upload stays in the private pending/ folder
 * until an admin explicitly acknowledges "scan skipped".
 *
 * The endpoint contract: POST application/octet-stream, headers X-File-Sha256 and X-File-Type (and Authorization:
 * Bearer MALWARE_SCAN_TOKEN when set); it answers JSON { "result": "clean" | "infected", "engine"?: string,
 * "signature"?: string }. Anything else, a timeout or an HTTP error is "failed" (never "clean").
 */

export type ScanResult =
  | { status: "clean"; engine: string }
  | { status: "infected"; engine: string; signature?: string }
  | { status: "failed"; engine: string; reason: string }
  | { status: "not_scanned"; engine: null };

export interface MalwareScanner {
  readonly configured: boolean;
  scan(bytes: Uint8Array, meta: { sha256: string; mime: string }): Promise<ScanResult>;
}

export const noScanner: MalwareScanner = {
  configured: false,
  scan: async () => ({ status: "not_scanned", engine: null }),
};

export class HttpScanner implements MalwareScanner {
  readonly configured = true;
  constructor(
    private readonly url: string,
    private readonly token?: string,
    private readonly timeoutMs = 20_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    const u = new URL(url);
    if (u.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) {
      throw new Error("MALWARE_SCAN_URL must be https (or localhost)");
    }
  }

  async scan(bytes: Uint8Array, meta: { sha256: string; mime: string }): Promise<ScanResult> {
    const engine = new URL(this.url).host;
    try {
      const res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Sha256": meta.sha256,
          "X-File-Type": meta.mime,
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: bytes as unknown as BodyInit,
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) return { status: "failed", engine, reason: `HTTP ${res.status}` };
      const body = (await res.json()) as { result?: unknown; engine?: unknown; signature?: unknown };
      const name = typeof body.engine === "string" ? body.engine.slice(0, 120) : engine;
      if (body.result === "clean") return { status: "clean", engine: name };
      if (body.result === "infected") return { status: "infected", engine: name, signature: typeof body.signature === "string" ? body.signature.slice(0, 200) : undefined };
      return { status: "failed", engine: name, reason: "unexpected answer" };
    } catch (e) {
      return { status: "failed", engine, reason: (e as Error).name === "TimeoutError" ? "timeout" : "unreachable" };
    }
  }
}

export function getScanner(env: NodeJS.ProcessEnv = process.env): MalwareScanner {
  const url = env.MALWARE_SCAN_URL?.trim();
  if (!url) return noScanner;
  return new HttpScanner(url, env.MALWARE_SCAN_TOKEN?.trim() || undefined);
}
