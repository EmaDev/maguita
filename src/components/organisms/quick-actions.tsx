"use client";

import { useState } from "react";
import {
  Button,
  Input,
  ShareButton,
  Textarea,
  useSnackbar,
} from "lib-kit-components";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { useExpenseDrafts, useNoteDrafts } from "@/lib/data/local-drafts";

/**
 * Contenido de los tres sheets del FAB del shell (`FabActionSheets`).
 *
 * Importante: `FabActionSheets` monta los tres sheets a la vez y sólo abre el
 * que corresponde, así que estos componentes **no** pueden hacer fetch ni pedir
 * permisos al montarse — sólo estado local.
 *
 * Todavía no hay backend de altas: lo que se carga queda en el dispositivo
 * (`lib/data/local-drafts`) y el snack lo aclara. Cuando exista la API, lo
 * único que cambia es el cuerpo de `save()`.
 *
 * La pantalla de Inicio lee esos mismos borradores y los mezcla con los datos
 * del server, así que lo que se carga acá aparece enseguida en su tab.
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

export function NewExpenseSheet() {
  const { snack } = useSnackbar();
  const [expenses, setExpenses] = useExpenseDrafts();
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");

  const parsed = Number(amount.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0 && concept.trim().length > 0;

  function save() {
    if (!valid) return;
    setExpenses((prev) => [
      { id: Date.now(), amount: parsed, concept: concept.trim() },
      ...prev,
    ]);
    setAmount("");
    setConcept("");
    snack({ message: "Gasto guardado en este dispositivo.", variant: "success" });
  }

  return (
    <div className="space-y-3">
      <Input
        label="Monto"
        // inputMode numérico: abre el teclado de números sin bloquear la coma
        // decimal, que `type="number"` sí rechaza en varios teclados móviles.
        inputMode="decimal"
        value={amount}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
      />
      <Input
        label="Concepto"
        value={concept}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConcept(e.target.value)}
      />
      <Button fullWidth onClick={save} disabled={!valid}>
        Guardar gasto
      </Button>
      <p className="text-xs text-muted">
        {expenses.length === 0
          ? "Todavía no cargaste ningún gasto."
          : `${expenses.length} ${expenses.length === 1 ? "gasto cargado" : "gastos cargados"} en este dispositivo.`}
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
