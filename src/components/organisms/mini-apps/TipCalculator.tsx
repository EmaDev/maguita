"use client";

import { useState, type ChangeEvent } from "react";
import { Button, Card, Input, StatCard } from "lib-kit-components";
import { formatMoney } from "@/lib/home-model";

const QUICK_TIPS = [10, 15, 20, 25];

/** Mini-app pública: calcula propina y el monto por persona. Todo en el cliente, sin guardar nada. */
export function TipCalculator() {
  const [amountStr, setAmountStr] = useState("");
  const [tipPercent, setTipPercent] = useState(10);
  const [peopleStr, setPeopleStr] = useState("1");

  const amount = Number(amountStr.replace(",", "."));
  const validAmount = Number.isFinite(amount) && amount > 0;
  const people = Math.max(1, Math.floor(Number(peopleStr)) || 1);

  const tip = validAmount ? (amount * tipPercent) / 100 : 0;
  const total = validAmount ? amount + tip : 0;
  const perPerson = validAmount ? total / people : 0;

  return (
    <div className="space-y-4">
      <Card variant="outline" padding="md" className="space-y-4">
        <Input
          label="Monto de la cuenta"
          inputMode="decimal"
          value={amountStr}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setAmountStr(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium mb-2">Propina</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TIPS.map((pct) => (
              <Button
                key={pct}
                size="sm"
                variant={tipPercent === pct ? "primary" : "outline"}
                onClick={() => setTipPercent(pct)}
              >
                {pct}%
              </Button>
            ))}
          </div>
        </div>

        <Input
          label="Personas"
          inputMode="numeric"
          value={peopleStr}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setPeopleStr(e.target.value.replace(/\D/g, ""))
          }
        />
      </Card>

      {validAmount ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Propina" value={formatMoney(tip)} tone="accent" />
          <StatCard label="Total con propina" value={formatMoney(total)} tone="primary" />
          {people > 1 && (
            <div className="col-span-2">
              <StatCard label="Por persona" value={formatMoney(perPerson)} tone="success" />
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-muted py-6">
          Ingresá el monto de la cuenta para calcular la propina.
        </p>
      )}
    </div>
  );
}
