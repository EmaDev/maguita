import "server-only";
import type { AppNotification } from "lib-kit-components";

/**
 * Notificaciones del usuario: alimentan la campana del `AppHeader`. Vacío
 * hasta que haya backend — el panel ya resuelve el estado "Todo al día".
 */
export async function getNotifications(_userId: string): Promise<AppNotification[]> {
  return [];
}
