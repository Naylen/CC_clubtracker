import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ["/admin/:path*", "/member/:path*"],
};
