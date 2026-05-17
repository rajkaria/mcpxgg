import { NextResponse, type NextRequest } from "next/server";

/**
 * S4-T03: auth moved to Privy (client-managed). The Supabase session
 * middleware is retired. Dashboard routes guard themselves server-side via
 * lib/auth/current-user (Privy token cookie); unauthenticated users are
 * bounced to the home page where <PrivyConnect /> lives.
 */
export function middleware(request: NextRequest) {
  const hasPrivy =
    request.cookies.has("privy-token") || request.cookies.has("privy-id-token");
  if (request.nextUrl.pathname.startsWith("/dashboard") && !hasPrivy) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("signin", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
