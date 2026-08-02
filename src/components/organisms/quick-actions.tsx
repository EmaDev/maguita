"use client";

import { useState } from "react";
import { Button, ShareButton, Textarea, useSnackbar } from "lib-kit-components";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { useNoteDrafts } from "@/lib/data/local-drafts";

/**
 * Contenido de los sheets del FAB de Inicio (`FabActionSheets` en
 * `HomeBoard`). El de gastos vive en `home/NewExpenseMovementSheet` — ya
 * tiene backend propio (el gestor de gastos), así que no encaja acá.
 *
 * Importante: `FabActionSheets` monta los tres sheets a la vez y sólo abre el
 * que corresponde, así que estos componentes **no** pueden hacer fetch ni pedir
 * permisos al montarse — sólo estado local.
 *
 * Notas todavía no tienen backend: lo que se carga queda en el dispositivo
 * (`lib/data/local-drafts`) y el snack lo aclara. La pantalla de Inicio lee
 * esos mismos borradores y los mezcla con los datos del server, así que lo
 * que se carga acá aparece enseguida en su tab.
 */

export function NewNoteSheet() {
  const { snack } = useSnackbar();
  const [notes, setNotes] = useNoteDrafts();
  const [text, setText] = useState("");

  const value = text.trim();

  function save() {
    if (!value) return;
    setNotes((prev) => [{ id: Date.now(), text: value }, ...prev]);
    setText("");
    snack({ message: "Nota guardada en este dispositivo.", variant: "success" });
  }

  return (
    <div className="space-y-3">
      <Textarea
        label="Nota"
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        rows={4}
        maxLength={280}
        showCount
        autoResize
      />
      <Button fullWidth onClick={save} disabled={!value}>
        Guardar nota
      </Button>
      <p className="text-xs text-muted">
        {notes.length === 0
          ? "Todavía no guardaste ninguna nota."
          : `${notes.length} ${notes.length === 1 ? "nota guardada" : "notas guardadas"} en este dispositivo.`}
      </p>
    </div>
  );
}

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
