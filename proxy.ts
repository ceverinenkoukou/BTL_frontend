import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("btl_access_token")?.value;
  const { pathname } = request.nextUrl;

  const protectedPaths = ["/dashboard", "/admin", "/hostess", "/supervisor"];
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  // Non authentifié → redirige vers login
  if (isProtectedPath && !accessToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Déjà authentifié → redirige hors des pages auth (sauf change-password)
  if (
    accessToken &&
    pathname.startsWith("/auth") &&
    pathname !== "/auth/change-password"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
