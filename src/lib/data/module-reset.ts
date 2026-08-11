import "server-only";
import { COLLECTIONS, collection, type CollectionName } from "@/lib/firebase/collections";

/**
 * Una colección que pertenece a un módulo resettable. La mayoría se filtran
 * por `ownerId` (muchos documentos por usuario); `expenseCategories` es un
 * singleton con id = uid, así que se borra/consulta por id de documento en
 * vez de por query.
 */
interface ModuleCollection {
  name: CollectionName;
  keyedBy: "ownerId" | "docId";
}

/**
 * De dónde sale el id: una tab de Inicio (`HomeTab`, `home/tabs.ts`) o una
 * mini-app del catálogo (`MiniApp.id`, `lib/data/mini-apps.ts`). Es lo que
 * separa "Módulos" de "Mini-apps" en las dos tabs de `ModuleResetCard`.
 */
export type ResettableModuleKind = "home-tab" | "mini-app";

export interface ResettableModule {
  id: string;
  name: string;
  kind: ResettableModuleKind;
  collections: ModuleCollection[];
}

/**
 * Módulos/mini-apps con datos propios en Firestore, ofrecidos en Ajustes para
 * borrado individual. Sólo se listan los que ya tienen backend real — el resto
 * de las mini-apps del catálogo (`mini-apps.ts`) son utilidades sin
 * persistencia o todavía no tienen pantalla, así que no hay nada que borrar.
 */
export const RESETTABLE_MODULES: ResettableModule[] = [
  {
    /**
     * Id de `HomeTab` (`home/tabs.ts`), no de `MiniApp`: el gestor de gastos
     * (`expenseCycles`/`expenseMovements`/`expenseCategories`) hoy sólo lo
     * lee/escribe la tab **Movimientos** de Inicio — la mini-app
     * `split-gastos` del catálogo es un placeholder sin persistencia (ver
     * `SplitGastos.tsx`), así que no tiene datos propios que ofrecer borrar.
     */
    id: "movimientos",
    name: "Movimientos",
    kind: "home-tab",
    collections: [
      { name: COLLECTIONS.expenseCycles, keyedBy: "ownerId" },
      { name: COLLECTIONS.expenseMovements, keyedBy: "ownerId" },
      { name: COLLECTIONS.expenseCategories, keyedBy: "docId" },
    ],
  },
  {
    id: "notas",
    name: "Notas",
    kind: "home-tab",
    collections: [{ name: COLLECTIONS.notes, keyedBy: "ownerId" }],
  },
  {
    id: "habitos",
    name: "Hábitos",
    kind: "home-tab",
    collections: [{ name: COLLECTIONS.habits, keyedBy: "ownerId" }],
  },
  {
    /**
     * Sólo las colecciones **propias** de la mini-app. El gestor de gastos por
     * período que muestra su tab "Principal" es el módulo `movimientos` de
     * arriba: se sigue borrando desde ahí, para que restablecer las billeteras
     * no se lleve puesto el período en curso de Inicio (y viceversa).
     */
    id: "billetera",
    name: "Billetera",
    kind: "mini-app",
    collections: [
      { name: COLLECTIONS.wallets, keyedBy: "ownerId" },
      { name: COLLECTIONS.walletMovements, keyedBy: "ownerId" },
      { name: COLLECTIONS.walletTrades, keyedBy: "ownerId" },
    ],
  },
  {
    id: "links-guardados",
    name: "Links guardados",
    kind: "mini-app",
    collections: [{ name: COLLECTIONS.links, keyedBy: "ownerId" }],
  },
  {
    id: "entrenamiento",
    name: "Entrenamiento",
    kind: "mini-app",
    collections: [
      { name: COLLECTIONS.workoutRoutines, keyedBy: "ownerId" },
      { name: COLLECTIONS.workoutSessions, keyedBy: "ownerId" },
      { name: COLLECTIONS.customExercises, keyedBy: "ownerId" },
    ],
  },
];

export function findResettableModule(id: string): ResettableModule | undefined {
  return RESETTABLE_MODULES.find((module) => module.id === id);
}

async function collectionHasData(col: ModuleCollection, uid: string): Promise<boolean> {
  if (col.keyedBy === "docId") {
    const snapshot = await collection(col.name).doc(uid).get();
    return snapshot.exists;
  }
  const snapshot = await collection(col.name).where("ownerId", "==", uid).limit(1).get();
  return !snapshot.empty;
}

export interface ResettableModuleInfo {
  id: string;
  name: string;
  kind: ResettableModuleKind;
}

/**
 * Módulos con al menos un dato cargado, para que Ajustes sólo ofrezca borrar
 * lo que el usuario realmente tiene. Se consulta con `limit(1)` por
 * colección: alcanza para saber si hay algo, sin traer el módulo entero.
 */
export async function getModulesWithData(uid: string): Promise<ResettableModuleInfo[]> {
  const withData = await Promise.all(
    RESETTABLE_MODULES.map(async (module) => {
      for (const col of module.collections) {
        if (await collectionHasData(col, uid)) return module;
      }
      return null;
    })
  );

  return withData
    .filter((module): module is ResettableModule => module !== null)
    .map(({ id, name, kind }) => ({ id, name, kind }));
}
