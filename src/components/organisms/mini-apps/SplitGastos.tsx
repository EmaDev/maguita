"use client";

import { useState, type ChangeEvent } from "react";
import {
  BillSplitter,
  Card,
  Input,
  TagInput,
  useSnackbar,
  type SplitParticipant,
} from "lib-kit-components";
import { formatMoney } from "@/lib/home-model";

/** Mini-app privada: divide un gasto entre participantes cargados a mano. Sin persistencia todavía. */
export function SplitGastos() {
  const { snack } = useSnackbar();
  const [totalStr, setTotalStr] = useState("");
  const [names, setNames] = useState<string[]>([]);

  const total = Number(totalStr.replace(",", "."));
  const validTotal = Number.isFinite(total) && total > 0;
  const participants: SplitParticipant[] = names.map((name) => ({ id: name, name }));

  function handleConfirm(shares: Record<string, number>) {
    const resumen = Object.entries(shares)
      .map(([name, monto]) => `${name}: ${formatMoney(monto)}`)
      .join(" · ");
    snack({ message: `División lista — ${resumen}`, variant: "success" });
  }

  return (
    <div className="space-y-4">
      <Card variant="outline" padding="md" className="space-y-4">
        <Input
          label="Monto total"
          inputMode="decimal"
          value={totalStr}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTotalStr(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium mb-2">Participantes</p>
          <TagInput value={names} onChange={setNames} placeholder="Agregar persona…" />
        </div>
      </Card>

      {validTotal && participants.length > 0 ? (
        <BillSplitter total={total} participants={participants} onConfirm={handleConfirm} />
      ) : (
        <p className="text-center text-sm text-muted py-6">
          {validTotal
            ? "Agregá al menos una persona para dividir la cuenta."
            : "Ingresá el monto total y sumá a los participantes."}
        </p>
      )}
    </div>
  );
}
