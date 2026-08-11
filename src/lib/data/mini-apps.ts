import "server-only";
import { ROUTES } from "@/lib/app-config";

/**
 * Catálogo de mini-apps. Es la única fuente de datos de /mini-apps y de la
 * grilla de favoritos, y hoy está vacío: la app está sin datos a propósito
 * hasta que exista el backend. Acá va el fetch/query real.
 */
export interface MiniApp {
  id: string;
  name: string;
  description: string;
  category: "Finanzas" | "Productividad" | "Utilidades";
  /** Nombre del ícono en components/atoms/icons */
  icon:
    | "wallet"
    | "qr"
    | "calculator"
    | "clock"
    | "grid"
    | "sparkle"
    | "link"
    | "roulette"
    | "dumbbell";
  /** Requiere sesión para abrirse. */
  requiresAuth: boolean;
  /**
   * Ruta propia, montada en `(app)` o `(public)` según `requiresAuth`. Ausente
   * mientras la mini-app no tiene pantalla real: la grilla muestra un aviso de
   * "próxima versión" en su lugar (ver `MiniAppsGrid`).
   */
  path?: string;
}

const MINI_APPS: MiniApp[] = [
  {
    id: "billetera",
    name: "Billetera",
    description: "Tu período de gastos y una billetera para cada cosa.",
    category: "Finanzas",
    icon: "wallet",
    requiresAuth: true,
    path: ROUTES.miniAppBilletera,
  },
  {
    id: "split-gastos",
    name: "Split de gastos",
    description: "Dividí cuentas entre amigos sin vueltas.",
    category: "Finanzas",
    icon: "wallet",
    requiresAuth: true,
    path: ROUTES.miniAppSplitGastos,
  },
  {
    id: "cobrar-qr",
    name: "Cobrar con QR",
    description: "Generá un QR para que te paguen al toque.",
    category: "Finanzas",
    icon: "qr",
    requiresAuth: true,
  },
  {
    id: "calculadora-propinas",
    name: "Calculadora de propinas",
    description: "Calculá la propina y dividila entre la mesa.",
    category: "Utilidades",
    icon: "calculator",
    requiresAuth: false,
    path: ROUTES.miniAppCalculadoraPropinas,
  },
  {
    id: "recordatorio-pagos",
    name: "Recordatorio de pagos",
    description: "Nunca más te olvides una fecha de vencimiento.",
    category: "Productividad",
    icon: "clock",
    requiresAuth: true,
  },
  {
    id: "panel-accesos",
    name: "Panel de accesos",
    description: "Todos tus atajos favoritos en un solo lugar.",
    category: "Productividad",
    icon: "grid",
    requiresAuth: false,
  },
  {
    id: "sorteo-expres",
    name: "Sorteo exprés",
    description: "Sorteá uno o varios ganadores entre tus participantes.",
    category: "Utilidades",
    icon: "sparkle",
    requiresAuth: false,
    path: ROUTES.miniAppSorteoExpres,
  },
  {
    id: "generador-qr",
    name: "Generador de QR",
    description: "Convertí un enlace en un QR estilizado, con título y subtítulo.",
    category: "Utilidades",
    icon: "qr",
    requiresAuth: false,
    path: ROUTES.miniAppGeneradorQr,
  },
  {
    id: "links-guardados",
    name: "Links guardados",
    description: "Guardá enlaces con su preview y abrilos cuando quieras.",
    category: "Productividad",
    icon: "link",
    requiresAuth: true,
    path: ROUTES.miniAppLinks,
  },
  {
    id: "ruleta-decisiones",
    name: "Ruleta de decisiones",
    description: "Cargá tus opciones y dejá que la ruleta decida.",
    category: "Utilidades",
    icon: "roulette",
    requiresAuth: false,
    path: ROUTES.miniAppRuletaDecisiones,
  },
  {
    id: "entrenamiento",
    name: "Entrenamiento",
    description: "Armá tus rutinas, marcá los días y sostené la racha.",
    category: "Productividad",
    icon: "dumbbell",
    requiresAuth: true,
    path: ROUTES.miniAppEntrenamiento,
  },
];

export async function getMiniApps(): Promise<MiniApp[]> {
  return MINI_APPS;
}

export async function getMiniAppsByIds(ids: string[]): Promise<MiniApp[]> {
  const index = new Map(MINI_APPS.map((app) => [app.id, app]));
  return ids.map((id) => index.get(id)).filter((app): app is MiniApp => Boolean(app));
}
