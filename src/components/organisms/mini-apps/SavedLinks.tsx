"use client";

import { useMemo, useState, useTransition, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import {
  Button,
  Card,
  CardHeader,
  Input,
  MediaCard,
  PageStatusScreen,
  ProductFilterBar,
  useSnackbar,
  type ProductFilterValue,
  type SortField,
} from "lib-kit-components";
import { LinkIcon, SettingsIcon, TrashIcon } from "@/components/atoms/icons";
import { PinLockSwitch } from "@/components/molecules/PinLockSwitch";
import { useAppSheet } from "@/components/shell/app-sheet";
import { useShellSearch } from "@/components/shell/shell-search";
import { addLinkAction, deleteLinkAction, updateLinkAction } from "@/lib/data/links-actions";
import type { SavedLink } from "@/lib/data/links";
import { LinkDetailModal } from "./LinkDetailModal";

const SORT_FIELDS: SortField[] = [{ id: "fecha", label: "Fecha guardado" }];

/** Más reciente primero por default, mismo orden que ya trae `getLinks`. */
const DEFAULT_FILTERS: ProductFilterValue = { sortField: "fecha", sortDirection: "desc" };

function formatSavedAt(millis: number): string {
  if (!millis) return "";
  return new Date(millis).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

interface SavedLinksProps {
  links: SavedLink[];
  pinSet: boolean;
  locked: boolean;
}

/**
 * Mini-app privada: guarda un link por URL, trae su preview (título,
 * descripción, imagen) por Open Graph del lado del server al momento del
 * alta, y lo muestra en una grilla de `MediaCard` con la imagen de portada.
 * Tocar una card la abre en una pestaña nueva; "Ver detalle" abre el modal
 * con todos los metatags resueltos, y el buscador del header + el orden por
 * fecha filtran la grilla sin volver a pedirle nada al server.
 */
export function SavedLinks({ links, pinSet, locked }: SavedLinksProps) {
  const { snack } = useSnackbar();
  const { openSheet } = useAppSheet();
  const { query, setQuery } = useShellSearch();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [filters, setFilters] = useState<ProductFilterValue>(DEFAULT_FILTERS);
  const [detailLink, setDetailLink] = useState<SavedLink | null>(null);

  const openSettingsSheet = () =>
    openSheet(
      <PinLockSwitch moduleId="links-guardados" locked={locked} pinConfigured={pinSet} />,
      { title: "Ajustes", description: "Privacidad de Links guardados." }
    );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? links.filter((link) =>
          [link.url, link.note, link.category, link.description, link.title]
            .some((field) => field?.toLowerCase().includes(term))
        )
      : links;

    const direction = filters.sortDirection ?? "desc";
    return [...filtered].sort((a, b) =>
      direction === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
    );
  }, [links, query, filters.sortDirection]);

  function add() {
    const value = url.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        await addLinkAction(value, { note, category });
        setUrl("");
        setNote("");
        setCategory("");
        snack({ message: "Link guardado.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el link.",
          variant: "error",
        });
      }
    });
  }

  function update(link: SavedLink, updates: { note: string; category: string }) {
    startTransition(async () => {
      try {
        await updateLinkAction(link.id, updates);
        snack({ message: "Link actualizado.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo actualizar el link.",
          variant: "error",
        });
      }
    });
  }

  function remove(link: SavedLink) {
    startTransition(async () => {
      try {
        await deleteLinkAction(link.id);
        snack({ message: "Link eliminado.", variant: "success" });
        setDetailLink((current) => (current?.id === link.id ? null : current));
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo eliminar el link.",
          variant: "error",
        });
      }
    });
  }

  function open(link: SavedLink) {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <Card variant="outline" padding="md" className="space-y-3">
        <CardHeader
          title="Nuevo link"
          aside={
            <Button size="icon" variant="ghost" aria-label="Ajustes" onClick={openSettingsSheet}>
              <SettingsIcon />
            </Button>
          }
        />
        <Input
          label="URL"
          placeholder="https://…"
          value={url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") add();
          }}
          disabled={pending}
        />
        <Input
          label="Descripción (opcional)"
          placeholder="Para qué lo guardaste…"
          value={note}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
          disabled={pending}
        />
        <Input
          label="Categoría (opcional)"
          placeholder="Ej. Trabajo, Recetas…"
          value={category}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
          disabled={pending}
        />
        <Button fullWidth onClick={add} disabled={!url.trim() || pending} loading={pending}>
          Guardar link
        </Button>
      </Card>

      {links.length === 0 ? (
        <PageStatusScreen
          status="empty"
          title="Todavía no guardaste ningún link"
          description="Pegá una URL arriba para guardarla con su preview."
        />
      ) : (
        <>
          <ProductFilterBar
            value={filters}
            onChange={setFilters}
            sortFields={SORT_FIELDS}
            resultCount={visible.length}
            resultLabel={(n: number) => `${n} ${n === 1 ? "link" : "links"}`}
          />

          {visible.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted">Ningún link coincide con “{query}”.</p>
              <Button variant="ghost" className="mt-2" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visible.map((link) => (
                <MediaCard
                  key={link.id}
                  src={link.image ?? undefined}
                  alt={link.title ?? link.domain}
                  label={link.domain}
                  badge={link.category ?? link.siteName ?? link.domain}
                  title={link.title ?? link.domain}
                  description={link.note ?? link.description ?? link.url}
                  onClick={() => open(link)}
                  meta={
                    <span className="flex items-center gap-1 truncate">
                      <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                      {link.domain}
                      {link.createdAt > 0 && <span aria-hidden="true"> · {formatSavedAt(link.createdAt)}</span>}
                    </span>
                  }
                  actions={
                    <div className="flex w-full items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          setDetailLink(link);
                        }}
                      >
                        Ver detalle
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${link.title ?? link.url}`}
                        disabled={pending}
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          remove(link);
                        }}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <LinkDetailModal
        link={detailLink}
        onClose={() => setDetailLink(null)}
        onDelete={remove}
        onUpdate={update}
        deleting={pending}
      />
    </div>
  );
}
