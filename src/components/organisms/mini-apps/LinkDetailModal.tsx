"use client";

import { useState, type ChangeEvent } from "react";
import { Button, Input, Modal } from "lib-kit-components";
import { ExternalLinkIcon, PencilIcon, TrashIcon } from "@/components/atoms/icons";
import type { SavedLink } from "@/lib/data/links";

function formatSavedAt(millis: number): string {
  if (!millis) return "—";
  return new Date(millis).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Fila `label`/valor del detalle. Sin valor no se renderiza — evita mostrar "—" para cada metatag que el sitio no publicó. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm break-words">{value}</p>
    </div>
  );
}

interface LinkDetailModalProps {
  link: SavedLink | null;
  onClose: () => void;
  onDelete: (link: SavedLink) => void;
  onUpdate: (link: SavedLink, updates: { note: string; category: string }) => void;
  deleting?: boolean;
}

/**
 * Detalle completo de un link guardado: todos los metatags que se le
 * pudieron sacar (`fetchLinkMetadata`) más la descripción y categoría
 * propias del usuario, que además se pueden editar desde acá (`onUpdate`).
 * Se abre desde el botón "Ver detalle" de cada `MediaCard` en `SavedLinks`.
 */
export function LinkDetailModal({ link, onClose, onDelete, onUpdate, deleting }: LinkDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");

  function startEditing() {
    if (!link) return;
    setNote(link.note ?? "");
    setCategory(link.category ?? "");
    setEditing(true);
  }

  function save() {
    if (!link) return;
    onUpdate(link, { note, category });
    setEditing(false);
  }

  return (
    <Modal
      open={link != null}
      onClose={() => {
        setEditing(false);
        onClose();
      }}
      title={link?.title ?? link?.domain}
      description={link?.siteName ?? undefined}
      size="md"
      footer={
        link && (
          <>
            <Button
              variant="danger"
              onClick={() => onDelete(link)}
              loading={deleting}
              leftIcon={<TrashIcon className="h-4 w-4" />}
            >
              Eliminar
            </Button>
            <Button
              onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              leftIcon={<ExternalLinkIcon className="h-4 w-4" />}
            >
              Abrir enlace
            </Button>
          </>
        )
      }
    >
      {link && (
        <div className="space-y-4">
          {link.image ? (
            <img
              src={link.image}
              alt={link.title ?? link.domain}
              className="w-full aspect-video rounded-xl object-cover bg-surface-alt"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-surface-alt text-sm text-muted">
              Sin imagen de preview
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <Input
                label="Descripción"
                placeholder="Para qué lo guardaste…"
                value={note}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
              />
              <Input
                label="Categoría"
                placeholder="Ej. Trabajo, Recetas…"
                value={category}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={save}>
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Field label="Descripción" value={link.note} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={startEditing}
                  leftIcon={<PencilIcon className="h-4 w-4" />}
                >
                  {link.note || link.category ? "Editar" : "Agregar"}
                </Button>
              </div>
              <Field label="Categoría" value={link.category} />
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <Field
              label="URL"
              value={
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline break-all"
                >
                  {link.url}
                </a>
              }
            />
            <Field label="Dominio" value={link.domain} />
            <Field label="Sitio (og:site_name)" value={link.siteName} />
            <Field label="Título (og:title)" value={link.title} />
            <Field label="Descripción (og:description)" value={link.description} />
            <Field label="Guardado" value={formatSavedAt(link.createdAt)} />
          </div>
        </div>
      )}
    </Modal>
  );
}
