import "server-only";

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
  icon: "wallet" | "qr" | "calculator" | "clock" | "grid" | "sparkle";
  /** Requiere sesión para abrirse. */
  requiresAuth: boolean;
}

const MINI_APPS: MiniApp[] = [];

export async function getMiniApps(): Promise<MiniApp[]> {
  return MINI_APPS;
}

export async function getMiniAppsByIds(ids: string[]): Promise<MiniApp[]> {
  const index = new Map(MINI_APPS.map((app) => [app.id, app]));
  return ids.map((id) => index.get(id)).filter((app): app is MiniApp => Boolean(app));
}
