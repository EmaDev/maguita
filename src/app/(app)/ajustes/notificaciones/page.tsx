import type { Metadata } from "next";
import { NotificationSettings } from "@/components/organisms/notifications/NotificationSettings";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getNotificationPreferences, getPushDevices } from "@/lib/data/notifications";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificacionesPage() {
  const session = await requireSession(ROUTES.notificaciones);
  const [preferences, devices] = await Promise.all([
    getNotificationPreferences(session.sub),
    getPushDevices(session.sub),
  ]);

  return (
    <NotificationSettings
      /* La clave pública VAPID es pública por diseño (viaja en cada
         `pushManager.subscribe`), pero se lee del server y baja como prop en
         vez de un `NEXT_PUBLIC_` leído en el cliente: así la pantalla puede
         mostrar "el push no está configurado" cuando falta, en vez de fallar
         adentro del navegador con un string vacío. */
      publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      preferences={preferences}
      devices={devices}
    />
  );
}
