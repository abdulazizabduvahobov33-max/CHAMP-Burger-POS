import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCreateSupplier, useDeleteSupplier, useSuppliers, useUpdateSupplier } from "@/entities/supplier/api";
import type { Supplier } from "@/entities/supplier/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog } from "@/shared/ui/Dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

type SupplierManageDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SupplierManageDialog({ open, onClose }: SupplierManageDialogProps) {
  const { t } = useTranslation();
  const { data: suppliers, isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const deleteMutation = useDeleteSupplier();
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    createMutation.mutate(
      { name: newName.trim(), phone: newPhone.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t("supplier.createSuccess"));
          setNewName("");
          setNewPhone("");
        },
        onError: (err) => setError(getErrorMessage(err, t("supplier.createFailed"))),
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("supplier.title")}>
      <form onSubmit={handleCreate} className="mb-4 flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("supplier.namePlaceholder")}
          maxLength={120}
          className="input flex-1"
        />
        <input
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          placeholder={t("supplier.phonePlaceholder")}
          maxLength={40}
          className="input w-40"
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
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {suppliers && suppliers.length === 0 && (
        <EmptyState compact icon={Truck} title={t("supplier.emptyTitle")} description={t("supplier.emptyDescription")} />
      )}

      {suppliers && suppliers.length > 0 && (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {suppliers.map((s) => (
            <SupplierRow
              key={s.id}
              supplier={s}
              editing={editingId === s.id}
              onStartEdit={() => setEditingId(s.id)}
              onStopEdit={() => setEditingId(null)}
              onDeleteRequest={() => setDeleteTarget(s)}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("supplier.deleteTitle")}
        description={t("supplier.deleteDescription", { name: deleteTarget?.name })}
        confirmLabel={t("common.delete")}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setError(null);
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(t("supplier.deleteSuccess"));
              setDeleteTarget(null);
            },
            onError: (err) => {
              setError(getErrorMessage(err, t("supplier.deleteFailed")));
              setDeleteTarget(null);
            },
          });
        }}
      />
    </Dialog>
  );
}

function SupplierRow({
  supplier,
  editing,
  onStartEdit,
  onStopEdit,
  onDeleteRequest,
  onError,
}: {
  supplier: Supplier;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onDeleteRequest: () => void;
  onError: (msg: string | null) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(supplier.name);
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const updateMutation = useUpdateSupplier(supplier.id);

  function handleSave() {
    if (!name.trim()) {
      onStopEdit();
      return;
    }
    onError(null);
    updateMutation.mutate(
      { name: name.trim(), phone: phone.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t("supplier.saveSuccess"));
          onStopEdit();
        },
        onError: (err) => onError(getErrorMessage(err, t("supplier.saveFailed"))),
      },
    );
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={120}
          className="input flex-1 py-1.5"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("supplier.phone")}
          maxLength={40}
          className="input w-32 py-1.5"
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
        {supplier.name} {supplier.phone && <span className="text-white/30">· {supplier.phone}</span>}
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
          className="rounded-lg p-2 text-white/40 transition hover:bg-ink-line hover:text-danger-soft"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
