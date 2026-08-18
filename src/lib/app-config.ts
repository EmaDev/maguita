/** Datos de identidad de la app, compartidos entre manifest, metadata y shell. */
export const APP_NAME = "Maguita";
export const APP_SHORT_NAME = "Maguita";
export const APP_TAGLINE = "Tus mini-apps, favoritos y asistente en un solo lugar.";
/**
 * Versión de la app. **Fuente única de verdad**: bumpear esta constante es lo
 * que publica una versión.
 *
 * No sale de una variable de entorno a propósito. La versión es parte del
 * código que se sube, no de la configuración del entorno donde corre: con una
 * env var había que acordarse de tocarla aparte en cada entorno después de
 * deployar, y hasta que eso pasaba la app mostraba una versión que no era la
 * que estaba corriendo.
 *
 * Además es lo único que hay que tocar para que al usuario le aparezca el
 * aviso de "hay una versión nueva": la versión viaja en `SW_URL`, así que
 * cambiarla cambia el service worker registrado — ver `SW_URL`.
 *
 * Cuándo sube el patch, cuándo el minor y cuándo el major: `docs/versionado.md`.
 * En criollo: MAJOR si algo que el usuario ya tenía guardado deja de leerse o
 * desaparece, MINOR si puede hacer algo que antes no podía, PATCH para todo lo
 * demás. Y todo deploy sube al menos el patch, porque este número es lo que
 * invalida las caches y dispara el aviso.
 */
export const APP_VERSION = "1.2.0";

/**
 * URL con la que se registra el service worker, versionada.
 *
 * El navegador considera "otro" service worker a uno con distinta scriptURL, y
 * el query string cuenta como parte de la URL. Entonces, con la misma
 * `/sw.js` de siempre, subir `APP_VERSION` alcanza para que en la próxima
 * carga el navegador instale un worker nuevo, lo deje en `waiting` y
 * `UpdatePrompt` muestre el aviso de actualización.
 *
 * Antes la versión que disparaba eso era `CACHE_VERSION`, hardcodeada adentro
 * de `public/sw.js`: un segundo número, en otro archivo, que había que
 * acordarse de bumpear a mano y que se desincronizaba del de la app. Ahora
 * `sw.js` lee este `?v=` de su propia `self.location` para nombrar sus
 * caches, así que la versión invalida también lo cacheado.
 */
export const SW_URL = `/sw.js?v=${APP_VERSION}`;

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
  /** Prefijo; el id de la rutina se le agrega con `routineDetailHref`. */
  miniAppEntrenamientoRutinas: "/mini-apps/entrenamiento/rutinas",
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
 * Detalle de una rutina de entrenamiento: el plan completo con una tab por día
 * (`WorkoutRoutineScreen`).
 *
 * Es una ruta propia y no un modal con query param como el detalle de una
 * billetera, porque acá **no hace falta la mini-app montada detrás**: el
 * detalle de una rutina es una pantalla de lectura completa (una tab por día,
 * los ejercicios de cada uno y las acciones sobre la rutina), igual que el
 * detalle de un período cerrado. Y es lo que descarga la pantalla principal,
 * que es el motivo por el que existe: la lista de rutinas volvió a ser una
 * lista para elegir, no el lugar donde se lee el plan entero.
 */
export function routineDetailHref(routineId: string): string {
  return `${ROUTES.miniAppEntrenamientoRutinas}/${encodeURIComponent(routineId)}`;
}

/**
 * Patrón de ruta del detalle de una rutina, para `revalidatePath(…, "page")`:
 * invalida **todas** las páginas de detalle de una sola llamada, que es lo que
 * hace falta cuando una escritura toca más de una rutina — ver
 * `revalidateRoutines` en `workouts-actions.ts`.
 */
export const ROUTINE_DETAIL_PATTERN = `${ROUTES.miniAppEntrenamientoRutinas}/[routineId]`;

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
