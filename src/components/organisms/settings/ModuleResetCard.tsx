"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Button, Card, Modal, Tabs, useSnackbar } from "lib-kit-components";
import { TrashIcon } from "@/components/atoms/icons";
import { SectionTitle } from "@/components/molecules/SectionTitle";
import { resetModuleDataAction } from "@/lib/data/module-reset-actions";
import type { ResettableModuleInfo, ResettableModuleKind } from "@/lib/data/module-reset";

interface ModuleResetCardProps {
  /** Sólo los módulos/mini-apps que ya tienen algún dato cargado (ver `getModulesWithData`). */
  modules: ResettableModuleInfo[];
}

/** Rótulos de las dos tabs: `kind` de `ResettableModule` → qué se ve en pantalla. */
const GROUP_LABELS: Record<ResettableModuleKind, string> = {
  "home-tab": "Módulos",
  "mini-app": "Mini-apps",
};

/**
 * "Borrar datos" de Ajustes: elimina de una todos los datos de un
 * módulo/mini-app puntual, no la cuenta entera. Separado en dos tabs —
 * Módulos (las tabs de Inicio) y Mini-apps— porque son dos catálogos
 * distintos para el usuario, aunque ambos borran de la misma forma. Sólo se
 * muestra si hay al menos un módulo con datos.
 */
export function ModuleResetCard({ modules }: ModuleResetCardProps) {
  const { snack } = useSnackbar();
  const [remaining, setRemaining] = useState(modules);
  const [target, setTarget] = useState<ResettableModuleInfo | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const byKind: Record<ResettableModuleKind, ResettableModuleInfo[]> = {
      "home-tab": [],
      "mini-app": [],
    };
    for (const item of remaining) byKind[item.kind].push(item);
    return byKind;
  }, [remaining]);

  const availableKinds = (Object.keys(GROUP_LABELS) as ResettableModuleKind[]).filter(
    (kind) => groups[kind].length > 0
  );
  const [tab, setTab] = useState<string>(availableKinds[0] ?? "home-tab");

  if (remaining.length === 0) return null;

  function closeModal() {
    if (!pending) setTarget(null);
  }

  function confirmReset() {
    const moduleToReset = target;
    if (!moduleToReset) return;

    startTransition(async () => {
      try {
        await resetModuleDataAction(moduleToReset.id);
        setRemaining((prev) => prev.filter((m) => m.id !== moduleToReset.id));
        setTarget(null);
        snack({ message: `Se borraron los datos de "${moduleToReset.name}".`, variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudieron borrar los datos.",
          variant: "error",
        });
      }
    });
  }

  function renderList(list: ResettableModuleInfo[]): ReactNode {
    return (
      <Card variant="outline" padding="none" className="divide-y divide-border overflow-hidden">
        {list.map((module) => (
          <div key={module.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <TrashIcon className="h-4 w-4 shrink-0 text-muted" />
              <p className="text-sm font-medium">{module.name}</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => setTarget(module)}>
              Borrar
            </Button>
          </div>
        ))}
      </Card>
    );
  }

  return (
    <section>
      <SectionTitle>Borrar datos</SectionTitle>
      {availableKinds.length > 1 ? (
        <Tabs
          items={availableKinds.map((kind) => ({ id: kind, label: GROUP_LABELS[kind] }))}
          value={tab}
          onChange={setTab}
          variant="segmented"
          size="sm"
          fitted
          panels={{
            "home-tab": renderList(groups["home-tab"]),
            "mini-app": renderList(groups["mini-app"]),
          }}
        />
      ) : (
        renderList(groups[availableKinds[0] ?? "home-tab"])
      )}

      <Modal
        open={target !== null}
        onClose={closeModal}
        title={target ? `Borrar datos de "${target.name}"` : ""}
        description="Esta acción no se puede deshacer: se eliminan todos los datos cargados en este módulo."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmReset} loading={pending}>
              Borrar datos
            </Button>
          </div>
        }
      />
    </section>
  );
}
