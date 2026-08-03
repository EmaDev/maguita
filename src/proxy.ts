import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_ROUTES, ROUTES } from "@/lib/app-config";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * En Next.js 16 `middleware` pasó a llamarse `proxy` (mismo comportamiento,
 * runtime nodejs fijo).
 *
 * Acá sólo hacemos un chequeo **optimista**: ¿existe la cookie de sesión? Es un
 * filtro barato para no renderizar pantallas protegidas de gente sin sesión.
 * La validación real de la firma vive en `requireSession()` (lib/auth/dal.ts),
 * que corre en cada layout protegido.
 *
 * Importante: el proxy corre en cada request (incluidos los prefetch), así que
 * no puede verificar la firma — eso cuesta un viaje de red. Por eso sólo sabe
 * decir "no hay cookie", nunca "la sesión es válida", y las dos direcciones del
 * redirect no son simétricas:
 *
 * - falta la cookie + ruta protegida  → a login, lo decide el proxy (barato).
 * - hay sesión válida + pantalla auth → a inicio, lo decide `(auth)/layout.tsx`,
 *   que verifica de verdad.
 *
 * Mandar a inicio desde acá, con sólo mirar que la cookie exista, generaba un
 * bucle infinito: una cookie presente pero inválida (vencida, revocada o de
 * otro proyecto de Firebase) rebotaba de `/login` a `/inicio`, y de ahí el
 * `redirect()` de `requireSession()` la devolvía a `/login`, para siempre.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.search = "";
    // Guardamos el destino para volver ahí después de ingresar.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /* Deja pasar los assets, el manifest y el service worker sin tocarlos:
     si el proxy redirige /sw.js, el registro del service worker se rompe. */
  matcher: [
    "/((?!_next/static|_next/image|icons/|sw\\.js|manifest\\.webmanifest|favicon\\.ico).*)",
  ],
};
