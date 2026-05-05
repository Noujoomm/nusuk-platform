import { NextResponse } from 'next/server';

/**
 * Render health-check endpoint.
 *
 * Returns 200 OK as soon as Next.js is up, without depending on the
 * NestJS API or the database. This decouples web readiness from API
 * readiness — during a brief API restart Render won't tear down the
 * container, and Blueprint sync stops timing out waiting on a route
 * that didn't exist.
 *
 * Precedence note: the `/api/:path*` rewrite in next.config.js is
 * `afterFiles` by default, so this local route handler wins over the
 * proxy. For a deeper health check (DB + API), use /api/debug.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
