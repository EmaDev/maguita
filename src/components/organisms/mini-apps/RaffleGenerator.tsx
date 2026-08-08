"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import {
  Button,
  Card,
  Confetti,
  Input,
  RaffleDraw,
  useClipboard,
  useHaptics,
} from "lib-kit-components";

/**
 * Techo de ganadores por tanda. El reel de `RaffleDraw` tarda ~1,9s por ganador
 * con el botón bloqueado: 10 ya son casi 20 segundos de espera.
 */
const MAX_WINNERS = 10;

/**
 * Tope del cargador de números. Los chips de participantes viven en un panel de
 * 8rem con scroll: más allá de esto la lista deja de poder revisarse a mano.
 */
const MAX_NUMBERS = 200;

const DEFAULT_AMOUNT = "50";

/**
 * `onDraw` entrega el **acumulado** de ganadores, no los de la tanda que recién
 * terminó. Normalmente alcanza con cortar por el largo anterior, pero el botón
 * «Reiniciar» del panel de ganadores vacía la lista interna sin avisarnos:
 * cuando el acumulado ya no arranca con lo que teníamos, la cuenta volvió a
 * empezar y la tanda es todo lo que llegó.
 */
function roundWinners(accumulated: string[], seen: string[]): string[] {
  const continues =
    accumulated.length >= seen.length && seen.every((w, i) => accumulated[i] === w);
  return continues ? accumulated.slice(seen.length) : accumulated;
}

/**
 * Mini-app pública: sortea uno o varios ganadores entre una lista de
 * participantes. `RaffleDraw` trae el bolillero completo (carga de nombres,
 * cantidad de ganadores, "no repetir" y la animación); acá le sumamos el
 * cargador de números, el festejo y el copiado del resultado.
 *
 * Todo corre en el cliente y nada se guarda: no hace falta cuenta para usarla.
 */
export function RaffleGenerator() {
  const { haptic } = useHaptics();
  const { copy, copied } = useClipboard();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [lastRound, setLastRound] = useState<string[]>([]);
  const [shots, setShots] = useState(0);

  /**
   * `RaffleDraw` es **no controlado**: `defaultEntries` sólo alimenta su estado
   * inicial. La única forma de cargarle una lista nueva es remontarlo, así que
   * la sembramos junto a un id que usamos como `key`.
   */
  const [seed, setSeed] = useState<{ id: number; entries: string[] }>({
    id: 0,
    entries: [],
  });
  /** Id del montaje vigente, para descartar resultados de una instancia vieja. */
  const mounted = useRef(seed.id);
  /** Ganadores que ya vimos, para quedarnos sólo con los de la última tanda. */
  const seen = useRef<string[]>([]);

  const count = Math.floor(Number(amount));
  const validCount = Number.isFinite(count) && count >= 2 && count <= MAX_NUMBERS;

  /**
   * Los `setTimeout` del reel no se cancelan al desmontar: si se carga una lista
   * nueva en medio de un sorteo, el resultado que llega es de un bolillero que
   * ya no existe. Lo descartamos en vez de festejar un ganador fantasma.
   */
  const handleDraw = useCallback(
    (accumulated: string[]) => {
      if (mounted.current !== seed.id) return;
      const round = roundWinners(accumulated, seen.current);
      seen.current = accumulated;
      if (round.length === 0) return;
      haptic("success");
      // Confetti dispara con cada *cambio* de `fire`: hay que incrementarlo.
      setShots((s) => s + 1);
      setLastRound(round);
    },
    [haptic, seed.id]
  );

  /** Reemplaza la lista de participantes remontando el bolillero desde cero. */
  function loadEntries(entries: string[]) {
    const id = seed.id + 1;
    mounted.current = id;
    setSeed({ id, entries });
    // Lista nueva, sorteo nuevo: los ganadores anteriores ya no aplican.
    seen.current = [];
    setLastRound([]);
  }

  const winnersText = lastRound.map((w, i) => `${i + 1}º ${w}`).join("\n");

  return (
    <div className="space-y-4">
      <Card variant="outline" padding="md" className="space-y-3">
        <div>
          <p className="text-sm font-medium">Sortear por número</p>
          <p className="mt-0.5 text-xs text-muted leading-relaxed">
            Cargá los números del 1 al que elijas, para sortear por orden de
            inscripción o por número de ticket sin escribirlos a mano.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Input
            label="Hasta el número"
            inputMode="numeric"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setAmount(e.target.value.replace(/\D/g, ""))
            }
            className="flex-1"
          />
          <Button
            variant="outline"
            disabled={!validCount}
            onClick={() =>
              loadEntries(Array.from({ length: count }, (_, i) => String(i + 1)))
            }
          >
            Cargar
          </Button>
        </div>
        {/* Una sola línea que hace de ayuda y de validación: el mensaje de error
            del Input crecería debajo del campo y correría el botón de lugar. */}
        {amount !== "" && !validCount ? (
          <p className="text-xs text-danger">
            Elegí un número entre 2 y {MAX_NUMBERS}.
          </p>
        ) : (
          <p className="text-xs text-muted">
            Reemplaza la lista de participantes de abajo, donde también podés
            pegar nombres (uno por línea).
          </p>
        )}
      </Card>

      {/* `relative`: el canvas del confeti se posiciona `absolute inset-0` sobre
          esta card y no captura clicks, así que no tapa el botón de sortear. */}
      <Card variant="outline" padding="md" className="relative">
        <RaffleDraw
          key={seed.id}
          defaultEntries={seed.entries}
          maxWinners={MAX_WINNERS}
          onDraw={handleDraw}
        />
        <Confetti fire={shots} count={140} />
      </Card>

      {lastRound.length > 0 && (
        <Card variant="outline" padding="md" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {/* El panel de `RaffleDraw` lista el acumulado de todas las tandas;
                esta card destaca sólo la que recién salió. */}
            <p className="text-sm font-medium">
              {lastRound.length === 1 ? "Ganador de la última tanda" : "Ganadores de la última tanda"}
            </p>
            <Button size="sm" variant="ghost" onClick={() => copy(winnersText)}>
              {copied ? "¡Copiado!" : "Copiar"}
            </Button>
          </div>
          <ol className="flex flex-wrap gap-2">
            {lastRound.map((winner, i) => (
              <li
                key={`${winner}-${i}`}
                className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
              >
                {winner}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <p className="px-1 text-xs text-muted leading-relaxed">
        El sorteo se hace en tu dispositivo con el azar del navegador y los
        participantes no se guardan: si salís de la pantalla, la lista se borra.
        Sirve para un giveaway o un premio entre amigos, no como sorteo
        auditable.
      </p>
    </div>
  );
}
