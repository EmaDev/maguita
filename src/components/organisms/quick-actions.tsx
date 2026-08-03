"use client";

import { ShareButton } from "lib-kit-components";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";

/**
 * Contenido de los sheets del FAB de Inicio. El de gastos vive en
 * `home/NewExpenseMovementSheet` — tiene backend propio (el gestor de
 * gastos), así que no encaja acá. "Nueva nota" tampoco: notas tiene su propio
 * composer siempre visible en el header de su tab (`home/NoteComposer`), así
 * que no hace falta un sheet aparte para darla de alta.
 */

export function ShareAppSheet() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted leading-relaxed">
        Pasale {APP_NAME} a alguien más: se instala desde el navegador, sin tienda
        de aplicaciones.
      </p>
      {/* Sin `url`: ShareButton usa `window.location.href`, que es la pantalla
          en la que está el usuario. */}
      <ShareButton
        title={APP_NAME}
        text={APP_TAGLINE}
        label={`Compartir ${APP_NAME}`}
        className="w-full justify-center"
      />
    </div>
  );
}
