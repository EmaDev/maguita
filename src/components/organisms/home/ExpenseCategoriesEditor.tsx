"use client";

import { useState, useTransition } from "react";
import { Button, Input, useSnackbar } from "lib-kit-components";
import { TrashIcon } from "@/components/atoms/icons";
import { EmojiPicker } from "@/components/molecules/EmojiPicker";
import {
  deleteExpenseCategoryAction,
  upsertExpenseCategoryAction,
} from "@/lib/data/expense-categories-actions";
import type { ExpenseCategoryItem } from "@/lib/data/expense-categories";

/**
 * Sección "Categorías" del panel de ajustes del gestor de gastos: ABM con
 * nombre y emoji. `initialCategories` es la foto que tenía `MovementsPanel`
 * al abrir el sheet; de ahí en más esta lista vive en estado local y se
 * actualiza con lo que devuelve cada Server Action (que ya trae el array
 * entero recalculado) — evita depender de que el sheet, cuyo contenido no se
 * vuelve a montar solo, reciba props frescas mientras está abierto.
 */
interface ExpenseCategoriesEditorProps {
  initialCategories: ExpenseCategoryItem[];
}

export function ExpenseCategoriesEditor({ initialCategories }: ExpenseCategoriesEditorProps) {
  const { snack } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  function create() {
    const name = newName.trim();
    const emoji = newEmoji.trim();
    if (!name || !emoji) return;
    startTransition(async () => {
      setCategories(await upsertExpenseCategoryAction({ name, emoji }));
      setNewName("");
      setNewEmoji("");
      snack({ message: "Categoría creada.", variant: "success" });
    });
  }

  function save(id: string, name: string, emoji: string) {
    const trimmedName = name.trim();
    const trimmedEmoji = emoji.trim();
    if (!trimmedName || !trimmedEmoji) return;
    startTransition(async () => {
      setCategories(await upsertExpenseCategoryAction({ id, name: trimmedName, emoji: trimmedEmoji }));
      setEditingId(null);
      snack({ message: "Categoría actualizada.", variant: "success" });
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      setCategories(await deleteExpenseCategoryAction(id));
      snack({ message: "Categoría eliminada.", variant: "neutral" });
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {categories.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">
            Todavía no armaste ninguna categoría.
          </p>
        )}
        {categories.map((category) =>
          editingId === category.id ? (
            <CategoryEditRow
              key={category.id}
              category={category}
              pending={pending}
              onSave={(name, emoji) => save(category.id, name, emoji)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={category.id}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
            >
              <span className="text-xl">{category.emoji}</span>
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {category.name}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditingId(category.id)}
              >
                Editar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Eliminar ${category.name}`}
                disabled={pending}
                onClick={() => remove(category.id)}
              >
                <TrashIcon />
              </Button>
            </div>
          )
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold text-foreground">Nueva categoría</p>
        <div className="flex gap-2">
          <EmojiPicker value={newEmoji} onChange={setNewEmoji} disabled={pending} />
          <Input
            value={newName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
            placeholder="Nombre"
            disabled={pending}
            className="flex-1"
          />
        </div>
        <Button
          fullWidth
          className="mt-2"
          onClick={create}
          disabled={!newName.trim() || !newEmoji.trim()}
          loading={pending}
        >
          Agregar categoría
        </Button>
      </div>
    </div>
  );
}

function CategoryEditRow({
  category,
  pending,
  onSave,
  onCancel,
}: {
  category: ExpenseCategoryItem;
  pending: boolean;
  onSave: (name: string, emoji: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);

  return (
    <div className="space-y-2 rounded-xl border border-primary/40 px-3 py-2.5">
      <div className="flex gap-2">
        <EmojiPicker value={emoji} onChange={setEmoji} disabled={pending} />
        <Input
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          disabled={pending}
          className="flex-1"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          disabled={!name.trim() || !emoji.trim()}
          loading={pending}
          onClick={() => onSave(name, emoji)}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
