type ErrorLogContext = {
  event?: string;
  requestId?: string;
  method?: string;
  path?: string;
  routePath?: string;
  routerKind?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
  digest?: string;
  extra?: Record<string, unknown>;
};

function safeText(value: unknown, maxLength = 4000): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .replace(/(authorization|cookie|set-cookie|password|secret|token|api[_-]?key|database_url)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, maxLength);
}

/**
 * Emit one machine-readable JSON record per error.
 * On Vercel, stdout/stderr are collected as runtime logs; local files are not durable
 * across serverless invocations, so this intentionally does not append to disk.
 */
export function logStructuredError(
  error: unknown,
  context: ErrorLogContext = {},
): void {
  const value = error instanceof Error ? error : undefined;
  const record = {
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'diginanba-web',
    event: context.event ?? 'application_error',
    message: safeText(value?.message ?? error) ?? 'Unknown error',
    errorName: safeText(value?.name),
    stack: safeText(value?.stack),
    digest: safeText(context.digest ?? (error as { digest?: unknown } | null)?.digest, 300),
    request: {
      id: safeText(context.requestId, 200),
      method: safeText(context.method, 20),
      path: safeText(context.path, 500),
      routePath: safeText(context.routePath, 500),
      routerKind: safeText(context.routerKind, 100),
      routeType: safeText(context.routeType, 100),
      renderSource: safeText(context.renderSource, 100),
      revalidateReason: safeText(context.revalidateReason, 100),
    },
    extra: context.extra,
  };
  // Keep this as a single JSON line so it can be filtered and copied as JSON.
  console.error(JSON.stringify(record));
}
