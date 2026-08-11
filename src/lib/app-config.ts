/** Datos de identidad de la app, compartidos entre manifest, metadata y shell. */
export const APP_NAME = "Maguita";
export const APP_SHORT_NAME = "Maguita";
export const APP_TAGLINE = "Tus mini-apps, favoritos y asistente en un solo lugar.";
export const APP_VERSION = "1.0.0";

/** Rutas de la app en un solo lugar, para que proxy, nav y links no se desincronicen. */
export const ROUTES = {
  inicio: "/inicio",
  /** Prefijo; el id del ciclo se le agrega con `periodDetailHref`. */
  movementsPeriodos: "/inicio/periodos",
  favoritos: "/favoritos",
  asistente: "/asistente",
  ajustes: "/ajustes",
  editarPerfil: "/ajustes/perfil",
  notificaciones: "/ajustes/notificaciones",
  miniApps: "/mini-apps",
  miniAppCalculadoraPropinas: "/mini-apps/calculadora-propinas",
  miniAppSplitGastos: "/mini-apps/split-gastos",
  miniAppGeneradorQr: "/mini-apps/generador-qr",
  miniAppGeneradorQrTexto: "/mini-apps/generador-qr/texto",
  miniAppLinks: "/mini-apps/links",
  miniAppRuletaDecisiones: "/mini-apps/ruleta-decisiones",
  miniAppSorteoExpres: "/mini-apps/sorteo-expres",
  miniAppEntrenamiento: "/mini-apps/entrenamiento",
  miniAppBilletera: "/mini-apps/billetera",
  /** Herramientas de desarrollo. Sólo existe con `DEV_TOOLS=true` (ver `lib/dev-tools.ts`). */
  debug: "/debug",
  login: "/login",
  signin: "/signin",
  recuperar: "/recuperar-password",
} as const;

/** Rutas que exigen sesión. El resto es público. */
export const PROTECTED_ROUTES = [
  ROUTES.inicio,
  ROUTES.favoritos,
  ROUTES.asistente,
  ROUTES.ajustes,
  ROUTES.miniAppSplitGastos,
  ROUTES.miniAppLinks,
  ROUTES.miniAppEntrenamiento,
  ROUTES.miniAppBilletera,
  ROUTES.debug,
] as const;

/* Las pantallas de autenticación no necesitan una lista acá: son las del route
   group `(auth)`, y su layout es el que redirige a inicio cuando ya hay sesión.
   Mantener una segunda lista fue lo que se desincronizó del chequeo real. */

/** Detalle de un período cerrado del gestor de gastos (`PastExpenseCyclesSection`). */
export function periodDetailHref(cycleId: string): string {
  return `${ROUTES.movementsPeriodos}/${cycleId}`;
}

/**
 * Nombre del query param con el que se entra derecho a una billetera
 * (`/mini-apps/billetera?billetera={id}`), desde el carrusel de accesos
 * directos de Inicio.
 *
 * Es un query param y no un segmento de ruta (`/mini-apps/billetera/{id}`)
 * porque el detalle de una billetera **no es una pantalla aparte**: es un modal
 * sobre la tab "Billeteras", que necesita el resto de la mini-app montada
 * detrás. Una ruta propia obligaría a duplicar la pantalla entera sólo para
 * abrir un modal — a diferencia del detalle de un período cerrado, que sí es
 * una pantalla completa y por eso sí tiene su ruta.
 */
export const WALLET_QUERY_PARAM = "billetera";

/** Link a una billetera puntual dentro de la mini-app (`HomeWalletsCarousel`). */
export function walletDetailHref(walletId: string): string {
  return `${ROUTES.miniAppBilletera}?${WALLET_QUERY_PARAM}=${encodeURIComponent(walletId)}`;
}
