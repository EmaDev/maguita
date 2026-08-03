"use client";

import { useState, useTransition, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Button, Card, Input, MediaCard, PageStatusScreen, useSnackbar } from "lib-kit-components";
import { LinkIcon, TrashIcon } from "@/components/atoms/icons";
import { addLinkAction, deleteLinkAction } from "@/lib/data/links-actions";
import type { SavedLink } from "@/lib/data/links";

/**
 * Mini-app privada: guarda un link por URL, trae su preview (título,
 * descripción, imagen) por Open Graph del lado del server al momento del
 * alta, y lo muestra en una grilla de `MediaCard`. Tocar una card la abre en
 * una pestaña nueva; el botón de borrar corta la propagación para no abrirla
 * de paso.
 */
export function SavedLinks({ links }: { links: SavedLink[] }) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");

  function add() {
    const value = url.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        await addLinkAction(value);
        setUrl("");
        snack({ message: "Link guardado.", variant: "success" });
      } catch (error) {
        snack({
          message: error instanceof Error ? error.message : "No se pudo guardar el link.",
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
        <Input
          label="Nuevo link"
          placeholder="https://…"
          value={url}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") add();
          }}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((link) => (
            <MediaCard
              key={link.id}
              src={link.image ?? undefined}
              alt={link.title ?? link.domain}
              label={link.domain}
              title={link.title ?? link.domain}
              description={link.description ?? link.url}
              onClick={() => open(link)}
              meta={
                <span className="flex items-center gap-1 truncate">
                  <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                  {link.siteName ?? link.domain}
                </span>
              }
              actions={
                <div className="flex w-full justify-end">
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
    </div>
  );
}
