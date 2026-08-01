/**
 * Nombre de la cookie de sesión, en un módulo sin dependencias.
 * `proxy.ts` la necesita pero no puede importar `session.ts`, que es
 * `server-only` y usa `next/headers`.
 */
export const SESSION_COOKIE = "maguita_session";
