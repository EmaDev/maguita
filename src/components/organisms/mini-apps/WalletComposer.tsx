"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { Button, Input, Select, Switch, useSnackbar } from "lib-kit-components";
import { AmountInput } from "@/components/molecules/AmountInput";
import { useAppSheet } from "@/components/shell/app-sheet";
import { addWalletAction, updateWalletAction } from "@/lib/data/wallets-actions";
import type { Wallet } from "@/lib/data/wallets";
import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  DEFAULT_WALLET_COLOR,
  DEFAULT_WALLET_EMOJI,
  DEFAULT_WALLET_KIND,
  WALLET_COLORS,
  WALLET_COLOR_IDS,
  WALLET_EMOJIS,
  WALLET_KIND_IDS,
  WALLET_KINDS,
  WALLET_NAME_MAX,
  WALLET_PURPOSE_MAX,
  type CurrencyCode,
  type WalletColor,
  type WalletKind,
} from "@/lib/wallet-model";

/**
 * Alta y edición de una billetera, en el mismo componente: los campos son los
 * mismos y sólo cambia qué Server Action se llama al guardar (mismo criterio
 * que `ExpenseCycleForm` con sus dos modos). Se monta dentro del sheet global.
 *
 * **Tipo y moneda sólo se eligen en el alta.** En la edición se muestran como
 * un dato fijo, no como un control: cambiar el tipo dejaría movimientos en una
 * billetera que pasó a llevar posiciones, y cambiar la moneda reinterpretaría
 * montos ya cargados en otra unidad (ver `updateWalletAction`, que además los
 * ignora del lado del server aunque el cliente los mande).
 *
 * Los campos que dependen del tipo —meta, límite, saldo inicial— aparecen o no
 * según lo que diga `WALLET_KINDS`, en vez de mostrarse todos y que el usuario
 * adivine cuáles aplican.
 */
interface WalletComposerProps {
  /** Ausente = alta. Presente = edición de esa billetera. */
  wallet?: Wallet;
  onSaved?: () => void;
}

export function WalletComposer({ wallet, onSaved }: WalletComposerProps) {
  const { closeSheet } = useAppSheet();
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();

  const editing = Boolean(wallet);
  const [kind, setKind] = useState<WalletKind>(wallet?.kind ?? DEFAULT_WALLET_KIND);
  const [currency, setCurrency] = useState<CurrencyCode>(wallet?.currency ?? DEFAULT_CURRENCY);
  const [name, setName] = useState(wallet?.name ?? "");
  const [purpose, setPurpose] = useState(wallet?.purpose ?? "");
  const [emoji, setEmoji] = useState<string>(wallet?.emoji ?? DEFAULT_WALLET_EMOJI);
  const [color, setColor] = useState<WalletColor>(wallet?.color ?? DEFAULT_WALLET_COLOR);
  const [initialBalance, setInitialBalance] = useState(wallet?.initialBalance ?? 0);
  const [hasTarget, setHasTarget] = useState(wallet?.targetAmount != null);
  const [targetAmount, setTargetAmount] = useState(wallet?.targetAmount ?? 0);
  const [creditLimit, setCreditLimit] = useState(wallet?.creditLimit ?? 0);

  const info = WALLET_KINDS[kind];
  const valid = name.trim().length > 0 && (!hasTarget || info.usesPositions || info.isDebt || targetAmount > 0);

  function save() {
    if (!valid) return;
    startTransition(async () => {
      const fields = {
        name,
        emoji,
        color,
        purpose,
        initialBalance,
        // Apagar el switch borra la meta (`null`), no la deja con el último
        // número tipeado: es lo que la card lee para decidir si dibuja la barra.
        targetAmount: hasTarget ? targetAmount : null,
        creditLimit: creditLimit > 0 ? creditLimit : null,
      };
      try {
        if (wallet) await updateWalletAction({ walletId: wallet.id, ...fields });
        else await addWalletAction({ ...fields, kind, currency });
        snack({
          message: wallet ? "Billetera actualizada." : "Billetera creada.",
          variant: "success",
        });
        closeSheet();
        onSaved?.();
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar la billetera.",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Tipo de billetera</p>
        {editing ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-alt/60 px-3 py-2.5">
            <span className="text-lg">{info.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{info.label}</p>
              <p className="text-[11px] text-muted">
                El tipo y la moneda no se pueden cambiar después de crearla.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {WALLET_KIND_IDS.map((option) => {
              const optionInfo = WALLET_KINDS[option];
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === kind}
                  disabled={pending}
                  onClick={() => setKind(option)}
                  className={[
                    "rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
                    option === kind ? "border-primary bg-primary/8" : "border-border hover:border-muted/40",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {optionInfo.emoji} {optionInfo.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted">
                    {optionInfo.description}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {editing ? (
        <p className="text-xs text-muted">
          Moneda: <span className="font-semibold text-foreground">{CURRENCIES[currency].label}</span>
        </p>
      ) : (
        <Select
          label="Moneda"
          value={currency}
          onChange={(value: string) => setCurrency(value as CurrencyCode)}
          options={CURRENCY_CODES.map((code) => ({
            value: code,
            label: `${CURRENCIES[code].symbol} · ${CURRENCIES[code].label}`,
          }))}
          hint="Todos los montos de esta billetera van en esta moneda. No se puede cambiar después."
        />
      )}

      <Input
        label="Nombre"
        placeholder={info.usesPositions ? "Ej. Cartera dólares" : "Ej. Ahorro auto"}
        value={name}
        maxLength={WALLET_NAME_MAX}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        disabled={pending}
      />

      <Input
        label="¿De qué se encarga? (opcional)"
        placeholder="Ej. Cuota y seguro"
        value={purpose}
        maxLength={WALLET_PURPOSE_MAX}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setPurpose(e.target.value)}
        disabled={pending}
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Ícono</p>
        <div className="grid grid-cols-8 gap-1.5">
          {WALLET_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={`Ícono ${option}`}
              aria-pressed={option === emoji}
              disabled={pending}
              onClick={() => setEmoji(option)}
              className={[
                "flex h-10 items-center justify-center rounded-xl border-2 text-lg transition-colors",
                option === emoji ? "border-primary bg-primary/10" : "border-border hover:border-muted/40",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Color</p>
        <div className="flex gap-2">
          {WALLET_COLOR_IDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-label={WALLET_COLORS[option].label}
              aria-pressed={option === color}
              disabled={pending}
              onClick={() => setColor(option)}
              className={[
                "flex h-10 flex-1 items-center justify-center rounded-xl border-2 transition-colors",
                option === color ? "border-primary" : "border-border hover:border-muted/40",
              ].join(" ")}
            >
              <span className={`h-4 w-4 rounded-full ${WALLET_COLORS[option].dot}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Una billetera de inversión no tiene saldo cargado a mano: su valor
          sale de las posiciones, así que pedirle un saldo inicial sería pedir
          un número que la pantalla nunca va a mostrar. */}
      {!info.usesPositions && (
        <AmountInput
          label={info.isDebt ? "Deuda actual" : "Saldo inicial"}
          value={initialBalance}
          onChange={setInitialBalance}
          disabled={pending}
          hint={
            info.isDebt
              ? "Lo que ya debés hoy. Los consumos que cargues se le suman."
              : "Con cuánto arranca. Después se ajusta con ingresos y gastos."
          }
        />
      )}

      {info.isDebt && (
        <AmountInput
          label="Límite (opcional)"
          value={creditLimit}
          onChange={setCreditLimit}
          disabled={pending}
          hint="La barra muestra cuánto del límite llevás consumido."
        />
      )}

      {!info.isDebt && !info.usesPositions && (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <Switch
            checked={hasTarget}
            onChange={setHasTarget}
            disabled={pending}
            label="Ponerle una meta"
            description="Muestra una barra de progreso con cuánto llevás juntado."
          />
          {hasTarget && (
            <AmountInput
              label="Meta"
              value={targetAmount}
              onChange={setTargetAmount}
              disabled={pending}
            />
          )}
        </div>
      )}

      {info.usesPositions && !editing && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted">
          Después de crearla vas a poder cargar cada compra: qué activo, cuándo, cuántas
          unidades y a qué precio.
        </p>
      )}

      <Button fullWidth onClick={save} disabled={!valid} loading={pending}>
        {wallet ? "Guardar cambios" : "Crear billetera"}
      </Button>
    </div>
  );
}
