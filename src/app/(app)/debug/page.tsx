import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotificationsDebugTool } from "@/components/organisms/debug/NotificationsDebugTool";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getNotificationsDebugState } from "@/lib/data/debug";
import { isDevToolsEnabled } from "@/lib/dev-tools";

export const metadata: Metadata = { title: "Debug" };

/**
 * Herramientas de desarrollo. **Sólo existe con `DEV_TOOLS=true`** en el
 * entorno del server.
 *
 * Con la flag apagada devuelve `notFound()` y no un error ni un redirect: para
 * quien no la tenga prendida, la ruta no existe — que es la respuesta que uno
 * quiere de una pantalla que ni siquiera debería insinuar que está ahí.
 *
 * El gate se repite en cada Server Action (`assertDevTools()`, ver
 * `lib/data/debug-actions.ts`): esconder la pantalla no esconde a las acciones,
 * que son endpoints públicos apenas se exportan.
 *
 * **Para sumar una utilidad nueva**: escribí su componente en
 * `components/organisms/debug/`, su lectura en `lib/data/debug.ts` y sus
 * acciones en `lib/data/debug-actions.ts` (con `assertDevTools()` al principio
 * de cada una), y montalo acá abajo como una sección más.
 */
export default async function DebugPage() {
  if (!isDevToolsEnabled()) notFound();

  const session = await requireSession(ROUTES.debug);
  const notifications = await getNotificationsDebugState(session.sub);

  return (
    <div className="space-y-10">
      <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed">
        Pantalla de desarrollo, activa porque <code>DEV_TOOLS=true</code>. Todo lo
        que se emita acá es real: se escribe en Firestore y sale por push.
      </p>

      <NotificationsDebugTool state={notifications} />
    </div>
  );
}
