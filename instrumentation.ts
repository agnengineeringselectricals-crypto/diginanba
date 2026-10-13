import { logStructuredError } from './lib/diagnostics/error-log';

type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

/**
 * Next.js invokes this hook when a request fails, including server-rendering
 * and route-handler errors. Vercel captures the JSON line in Runtime Logs.
 */
export function onRequestError(
  error: unknown,
  request: Request,
  context: RequestErrorContext,
): void {
  const url = new URL(request.url);
  // Never log query parameters: they can contain codes or other sensitive data.
  logStructuredError(error, {
    event: 'next_request_error',
    requestId: request.headers.get('x-vercel-id') ?? request.headers.get('x-request-id') ?? undefined,
    method: request.method,
    path: url.pathname,
    routePath: context.routePath,
    routerKind: context.routerKind,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
    digest: (error as { digest?: string } | null)?.digest,
  });
}
