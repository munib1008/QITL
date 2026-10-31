/**
 * Next.js instrumentation: every uncaught server error (rendering, route handlers, server actions, middleware) is
 * logged as one scrubbed JSON line and, when SENTRY_DSN is set, reported. See src/lib/observability/errors.ts for what
 * is (and is never) sent.
 */
export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routeType?: string; renderSource?: string },
) {
  const { reportError } = await import("@/lib/observability/errors");
  await reportError(error, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    renderSource: context.renderSource,
    digest: (error as { digest?: string })?.digest,
  });
}
