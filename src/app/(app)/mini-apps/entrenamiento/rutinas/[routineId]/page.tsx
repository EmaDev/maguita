import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleLockGate } from "@/components/organisms/security/ModuleLockGate";
import { WorkoutRoutineScreen } from "@/components/organisms/mini-apps/WorkoutRoutineScreen";
import { ROUTES } from "@/lib/app-config";
import { requireSession } from "@/lib/auth/dal";
import { getCustomExercises } from "@/lib/data/exercises";
import { getProfile } from "@/lib/data/profile";
import { getWorkoutRoutineById } from "@/lib/data/workouts";
import { dayKey } from "@/lib/home-model";

/* Título fijo y no `generateMetadata` con el nombre de la rutina: resolverlo
   pediría una lectura extra de Firestore sólo para el `<title>`, y el nombre ya
   se ve como título de la pantalla. Mismo criterio que el detalle de un
   período cerrado. */
export const metadata: Metadata = { title: "Rutina" };

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { routineId } = await params;
  const session = await requireSession(ROUTES.miniAppEntrenamiento);

  const [routine, customExercises, profile] = await Promise.all([
    // `null` cubre tanto "no existe" como "es de otra cuenta" (ver
    // `getWorkoutRoutineById`) — los dos son el mismo 404, y distinguirlos
    // delataría qué ids existen.
    getWorkoutRoutineById(session.sub, routineId),
    getCustomExercises(session.sub),
    getProfile(session.sub),
  ]);
  if (!routine) notFound();

  /* El candado del módulo vale en **todas** sus rutas, no sólo en la principal:
     sin este gate, entrar por el link del detalle sería la forma de saltearlo. */
  const pinSet = Boolean(profile?.preferences.pinHash);
  const locked = pinSet && (profile?.preferences.lockedModules.includes("entrenamiento") ?? false);

  return (
    <ModuleLockGate moduleId="entrenamiento" moduleLabel="Entrenamiento" locked={locked}>
      <WorkoutRoutineScreen
        routine={routine}
        // El día lo resuelve el server y baja como prop, igual que en la
        // pantalla principal: que el cliente no lo recalcule evita que el HTML
        // del server y el primer render del browser difieran entre husos.
        today={dayKey(new Date())}
        customExercises={customExercises}
      />
    </ModuleLockGate>
  );
}
