/** Datos de identidad de la app, compartidos entre manifest, metadata y shell. */
export const APP_NAME = "Maguita";
export const APP_SHORT_NAME = "Maguita";
export const APP_TAGLINE = "Tus mini-apps, favoritos y asistente en un solo lugar.";
export const APP_VERSION = "1.0.0";

/** Rutas de la app en un solo lugar, para que proxy, nav y links no se desincronicen. */
export const ROUTES = {
  inicio: "/inicio",
  favoritos: "/favoritos",
  asistente: "/asistente",
  ajustes: "/ajustes",
  editarPerfil: "/ajustes/perfil",
  miniApps: "/mini-apps",
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
] as const;

/** Pantallas de autenticación: si ya hay sesión, no tiene sentido mostrarlas. */
export const AUTH_ROUTES = [ROUTES.login, ROUTES.signin, ROUTES.recuperar] as const;
