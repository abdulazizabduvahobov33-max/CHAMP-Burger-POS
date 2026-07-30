import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/entities/category/api";
import type { Category } from "@/entities/category/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog } from "@/shared/ui/Dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

type CategoryManageDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function CategoryManageDialog({ open, onClose }: CategoryManageDialogProps) {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const deleteMutation = useDeleteCategory();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    createMutation.mutate(newName.trim(), {
      onSuccess: () => {
        toast.success(t("category.createSuccess"));
        setNewName("");
      },
      onError: (err) => setError(getErrorMessage(err, t("category.createFailed"))),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("category.title")}>
      <form onSubmit={handleCreate} className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("category.newPlaceholder")}
          maxLength={80}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-champ px-3 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t("common.add")}
        </button>
      </form>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-2 py-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      )}

      {categories && categories.length === 0 && (
        <EmptyState compact icon={Tags} title={t("category.emptyTitle")} description={t("category.emptyDescription")} />
      )}

      {categories && categories.length > 0 && (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              editing={editingId === c.id}
              onStartEdit={() => setEditingId(c.id)}
              onStopEdit={() => setEditingId(null)}
              onDeleteRequest={() => setDeleteTarget(c)}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("category.deleteTitle")}
        description={t("category.deleteDescription", { name: deleteTarget?.name })}
        confirmLabel={t("common.delete")}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setError(null);
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(t("category.deleteSuccess"));
              setDeleteTarget(null);
            },
            onError: (err) => {
              setError(getErrorMessage(err, t("category.deleteFailed")));
              setDeleteTarget(null);
            },
          });
        }}
      />
    </Dialog>
  );
}

function CategoryRow({
  category,
  editing,
  onStartEdit,
  onStopEdit,
  onDeleteRequest,
  onError,
}: {
  category: Category;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onDeleteRequest: () => void;
  onError: (msg: string | null) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(category.name);
  const updateMutation = useUpdateCategory(category.id);

  function handleSave() {
    if (!name.trim() || name.trim() === category.name) {
      onStopEdit();
      return;
    }
    onError(null);
    updateMutation.mutate(name.trim(), {
      onSuccess: () => {
        toast.success(t("category.renameSuccess"));
        onStopEdit();
      },
      onError: (err) => onError(getErrorMessage(err, t("category.renameFailed"))),
    });
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={80}
          className="input flex-1 py-1.5"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <button
          type="button"
          onClick={handleSave}
          aria-label={t("common.save")}
          className="rounded-lg p-2 text-success transition hover:bg-ink-line"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onStopEdit}
          aria-label={t("common.cancel")}
          className="rounded-lg p-2 text-white/40 transition hover:bg-ink-line"
        >
          <X className="h-4 w-4" />
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-ink-soft">
      <span className="text-sm text-white">
        {category.name} <span className="text-white/30">· {category.productCount}</span>
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onStartEdit}
          aria-label={t("common.edit")}
          className="rounded-lg p-2 text-white/40 transition hover:bg-ink-line hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDeleteRequest}
          aria-label={t("common.delete")}
          disabled={category.productCount > 0}
          title={category.productCount > 0 ? t("category.hasProducts") : t("common.delete")}
          className="rounded-lg p-2 text-white/40 transition hover:bg-ink-line hover:text-danger-soft disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
