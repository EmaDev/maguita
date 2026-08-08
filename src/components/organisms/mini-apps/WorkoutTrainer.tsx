"use client";

import type { WorkoutRoutine, WorkoutSession } from "@/lib/data/workouts";
import type { ExerciseInfo } from "@/lib/exercise-catalog";
import { useShellTabs } from "@/components/shell/shell-tabs";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { WorkoutRoutinesPanel } from "./WorkoutRoutinesPanel";
import { isWorkoutTab, type WorkoutTab } from "./workout-tabs";

interface WorkoutTrainerProps {
  /** Día de referencia (`yyyy-mm-dd`) resuelto en el server: que el cliente no lo recalcule evita un mismatch de hidratación entre husos. */
  today: string;
  routines: WorkoutRoutine[];
  sessions: WorkoutSession[];
  /** Ejercicios propios del usuario. El catálogo base no viaja como prop: lo importa la biblioteca. */
  customExercises: ExerciseInfo[];
  pinSet: boolean;
  locked: boolean;
}

/**
 * Mini-app privada de entrenamiento. Las tabs no las monta esta pantalla:
 * viven en la fila extra del `AppHeader` del shell, declaradas en
 * `nav-config`; acá se lee cuál está activa y se muestra su panel — mismo
 * patrón que `HomeBoard` con las tabs de Inicio.
 *
 * Los datos se resuelven una sola vez en la página y bajan a los dos paneles:
 * las rutinas las necesita la biblioteca (para poder agregarles ejercicios) y
 * los ejercicios propios los necesita el panel de rutinas (para resolver la
 * ficha de cada fila), así que separarlos por tab haría dos lecturas de lo
 * mismo.
 */
export function WorkoutTrainer({
  today,
  routines,
  sessions,
  customExercises,
  pinSet,
  locked,
}: WorkoutTrainerProps) {
  const { tab } = useShellTabs();
  const active: WorkoutTab = isWorkoutTab(tab) ? tab : "rutinas";

  if (active === "ejercicios") {
    return <ExerciseLibrary customExercises={customExercises} routines={routines} />;
  }

  return (
    <WorkoutRoutinesPanel
      today={today}
      routines={routines}
      sessions={sessions}
      customExercises={customExercises}
      pinSet={pinSet}
      locked={locked}
    />
  );
}
