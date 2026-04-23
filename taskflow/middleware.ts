import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.get("taskflow_auth")?.value === "1";
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Cookie olsa da /login acik kalsin: aciklama metni, cikis, baska hesap

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/boards/:path*"],
};
