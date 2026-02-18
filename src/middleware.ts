import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter for /api/auth/* endpoints.
// Viable because the app runs as a single Docker instance.
// ---------------------------------------------------------------------------
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const CLEANUP_INTERVAL = 1_000; // clean stale entries every N checks

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let checkCounter = 0;

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Periodic cleanup to prevent unbounded memory growth
  checkCounter++;
  if (checkCounter >= CLEANUP_INTERVAL) {
    checkCounter = 0;
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit auth endpoints (brute-force / magic-link flood protection)
  if (pathname.startsWith("/api/auth")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("cf-connecting-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  // Get session cookie — Better Auth uses "__Secure-" prefix when useSecureCookies is enabled
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token");
  const isAuthenticated = !!sessionCookie;

  // Protect admin routes
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Note: role check (isAdmin) is enforced at the server action level,
    // not in middleware, because middleware cannot easily query the DB.
    // Middleware provides the first gate; server actions provide the second.
  }

  // Protect member routes
  if (pathname.startsWith("/member")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/magic-link", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/member/:path*", "/api/auth/:path*"],
};
