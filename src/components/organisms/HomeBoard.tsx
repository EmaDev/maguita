"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Button, FloatingButton, type FabAction } from "lib-kit-components";
import { FlameIcon, NoteIcon, ReceiptIcon, ShareIcon } from "@/components/atoms/icons";
import { useAppSheet } from "@/components/shell/app-sheet";
import { useShellTabs } from "@/components/shell/shell-tabs";
import { ShareAppSheet } from "@/components/organisms/quick-actions";
import { APP_NAME } from "@/lib/app-config";
import { HabitComposer } from "./home/HabitComposer";
import { HabitsPanel } from "./home/HabitsPanel";
import { MovementsPanel } from "./home/MovementsPanel";
import { NewExpenseMovementSheet } from "./home/NewExpenseMovementSheet";
import { NotesPanel } from "./home/NotesPanel";
import { SummaryPanel } from "./home/SummaryPanel";
import { isHomeTab, type HomeTab } from "./home/tabs";
import type { HomeData } from "@/lib/data/home";
import { byDayDesc } from "@/lib/home-model";

/**
 * Contenido de Inicio. Las tabs no las monta la pantalla: viven en la fila
 * extra del `AppHeader` del shell (su slot `children`), declaradas en
 * `nav-config`. Acá leemos cuál está activa y mostramos su panel.
 *
 * Los datos se resuelven una sola vez a este nivel y bajan a los cuatro
 * paneles: el resumen es el índice de las otras tres tabs, así que si cada
 * panel hiciera su propia mezcla terminarían mostrando números distintos.
 *
 * El FAB de altas rápidas también vive acá (y no en el shell): es específico
 * de Inicio, no tiene sentido flotando sobre Favoritos, Asistente, Mini-apps
 * o Ajustes. Al montarse una sola vez para las cuatro tabs (fuera del
 * `switch` de abajo) se mantiene visible al cambiar de tab sin desmontarse.
 */

/**
 * Contenido del sheet "Nuevo gasto" del FAB cuando todavía no hay ciclo
 * activo: cargar un gasto no tiene sentido sin un período contra el cual
 * cargarlo.
 */
function NoActiveExpenseCycleNotice({ onGoToMovimientos }: { onGoToMovimientos: () => void }) {
  return (
    <div className="space-y-3 py-2 text-center">
      <p className="text-sm text-muted">
        Todavía no armaste tu gestor de gastos. Creá un período desde la tab
        Movimientos para poder cargar gastos.
      </p>
      <Button fullWidth onClick={onGoToMovimientos}>
        Ir a Movimientos
      </Button>
    </div>
  );
}

export function HomeBoard({ data }: { data: HomeData }) {
  const { today } = data;
  const { tab, setTab } = useShellTabs();
  const active: HomeTab = isHomeTab(tab) ? tab : "resumen";
  const { openSheet, closeSheet } = useAppSheet();

  /**
   * Un contador, no un booleano: "Nueva nota" tiene que poder enfocar el
   * composer también cuando ya estamos parados en la tab Notas, y un booleano
   * que ya está en `true` no dispararía nada la segunda vez.
   */
  const [noteFocusSignal, setNoteFocusSignal] = useState(0);

  const focusNewNote = useCallback(() => {
    setTab("notas");
    setNoteFocusSignal((signal) => signal + 1);
  }, [setTab]);

  // Notas ya van directo a Firestore (ver `NoteComposer`, en el header de la
  // tab): acá sólo se ordenan para el resumen, sin mezclar ningún borrador.
  const notes = useMemo(() => byDayDesc(data.notes), [data.notes]);

  /**
   * Crear un hábito abre el mismo composer que usa la tab (no un formulario
   * aparte) y, al guardar, lleva a Hábitos: si el sheet se cerrara dejando al
   * usuario en Resumen, el hábito recién creado no se vería por ningún lado.
   */
  const openNewHabit = useCallback(() => {
    openSheet(
      <HabitComposer
        onSaved={() => {
          closeSheet();
          setTab("habitos");
        }}
      />,
      { title: "Nuevo hábito" }
    );
  }, [openSheet, closeSheet, setTab]);

  /**
   * "Nuevo gasto", "Nuevo hábito" y "Compartir" abren el mismo sheet global
   * que usa Movimientos (`useAppSheet()`), no el `<FabActionSheets>` de la
   * librería: ese monta sus propios `BottomSheet` y no expone ninguna forma
   * de cerrarlos desde adentro de su `content` — con `openSheet` acá, "Nuevo
   * gasto" puede pasarle `onSaved={closeSheet}` a `NewExpenseMovementSheet`
   * (ver ese componente) y cerrarse solo al guardar, igual que ya hacía desde
   * Movimientos, y "Nuevo hábito" hace lo mismo con `HabitComposer`. "Nueva
   * nota" es la excepción: no abre ningún sheet, lleva al composer que ya
   * vive arriba de la tab Notas y lo enfoca.
   *
   * Depende de `data.expenseCycle`/`data.expenseCategories`: a diferencia de
   * compartir, "Nuevo gasto" no es estático — sin ciclo activo no hay contra
   * qué cargar un gasto, así que el sheet cambia por un aviso. Por eso el
   * array ya no es una constante de módulo (no puede serlo y depender de
   * props a la vez).
   */
  const quickActions = useMemo<FabAction[]>(
    () => [
      {
        icon: <NoteIcon />,
        label: "Nueva nota",
        // No abre un sheet con otro composer: lleva al que ya está siempre
        // visible arriba de la tab Notas y lo enfoca. Duplicarlo en un sheet
        // significaría mantener dos formularios con el mismo estado.
        onClick: focusNewNote,
      },
      {
        icon: <ReceiptIcon />,
        label: "Nuevo gasto",
        tone: "accent",
        onClick: () =>
          data.expenseCycle
            ? openSheet(
                <NewExpenseMovementSheet
                  cycleId={data.expenseCycle.id}
                  date={today}
                  categories={data.expenseCategories}
                  onSaved={closeSheet}
                />,
                { title: "Nuevo gasto" }
              )
            : openSheet(
                <NoActiveExpenseCycleNotice onGoToMovimientos={() => setTab("movimientos")} />,
                { title: "Nuevo gasto" }
              ),
      },
      {
        icon: <FlameIcon />,
        label: "Nuevo hábito",
        tone: "success",
        onClick: openNewHabit,
      },
      {
        icon: <ShareIcon />,
        label: "Compartir",
        onClick: () => openSheet(<ShareAppSheet />, { title: `Compartir ${APP_NAME}` }),
      },
    ],
    [
      data.expenseCategories,
      data.expenseCycle,
      today,
      setTab,
      openSheet,
      closeSheet,
      focusNewNote,
      openNewHabit,
    ]
  );

  let panel: ReactNode;
  switch (active) {
    case "movimientos":
      panel = (
        <MovementsPanel
          today={today}
          expenseCycle={data.expenseCycle}
          cycleMovements={data.movements}
          expenseCategories={data.expenseCategories}
        />
      );
      break;
    case "notas":
      panel = <NotesPanel today={today} notes={notes} focusSignal={noteFocusSignal} />;
      break;
    case "habitos":
      panel = <HabitsPanel today={today} habits={data.habits} />;
      break;
    default:
      panel = (
        <SummaryPanel
          today={today}
          movements={data.movements}
          expenseCycle={data.expenseCycle}
          notes={notes}
          habits={data.habits}
          onGoTo={setTab}
        />
      );
  }

  return (
    <>
      {panel}
      {/* pb sube el FAB por encima del BottomNav — el contenedor está anclado
          por `bottom`, así que el padding lo empuja hacia arriba sin tocar el
          anclaje. md:pb-0 lo devuelve abajo cuando la nav desaparece. */}
      <FloatingButton
        actions={quickActions}
        label="Crear"
        className="pb-18 md:pb-0"
      />
    </>
  );
}
