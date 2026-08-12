import { useState, type FormEvent } from "react";
import { Check, LayoutGrid, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCreateTable, useDeleteTable, useTables, useUpdateTable } from "@/entities/table/api";
import type { Table } from "@/entities/table/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Skeleton } from "@/shared/ui/Skeleton";

export function TablesGrid() {
  const { t } = useTranslation();
  const { data: tables, isLoading } = useTables();
  const createMutation = useCreateTable();
  const [deleteTarget, setDeleteTarget] = useState<Table | null>(null);
  const deleteMutation = useDeleteTable();

  function handleAdd() {
    createMutation.mutate(undefined, {
      onSuccess: (table) => toast.success(t("table.createSuccess", { number: table.number })),
      onError: (err) => toast.error(getErrorMessage(err, t("table.createFailed"))),
    });
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
    );
  }

  if (tables && tables.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title={t("table.emptyTitle")}
        description={t("table.emptyDescription")}
        action={{ label: t("table.add"), onClick: handleAdd, icon: Plus }}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {tables?.map((table) => (
          <TableCard key={table.id} table={table} onDeleteRequest={() => setDeleteTarget(table)} />
        ))}
        <button
          type="button"
          onClick={handleAdd}
          disabled={createMutation.isPending}
          className="flex h-32 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-line text-white/40 transition hover:border-champ/50 hover:text-champ disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-6 w-6" />
          <span className="text-sm font-semibold">{t("table.add")}</span>
        </button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("table.deleteTitle")}
        description={t("table.deleteDescription", { number: deleteTarget?.number })}
        confirmLabel={t("common.delete")}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(t("table.deleteSuccess"));
              setDeleteTarget(null);
            },
            onError: (err) => {
              toast.error(getErrorMessage(err, t("table.deleteFailed")));
              setDeleteTarget(null);
            },
          });
        }}
      />
    </div>
  );
}

function TableCard({ table, onDeleteRequest }: { table: Table; onDeleteRequest: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState(String(table.number));
  const updateMutation = useUpdateTable(table.id);

  function handleSaveNumber(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(number);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed === table.number) {
      setEditing(false);
      setNumber(String(table.number));
      return;
    }
    updateMutation.mutate(
      { number: parsed },
      {
        onSuccess: () => {
          toast.success(t("table.renameSuccess"));
          setEditing(false);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, t("table.renameFailed")));
          setNumber(String(table.number));
        },
      },
    );
  }

  function toggleActive() {
    updateMutation.mutate(
      { isActive: !table.isActive },
      { onError: (err) => toast.error(getErrorMessage(err, t("table.statusChangeFailed"))) },
    );
  }

  return (
    <div
      className={`group relative flex h-32 flex-col items-center justify-center gap-1.5 rounded-card bg-ink-card p-4 shadow-card transition ${
        table.isActive ? "" : "opacity-50"
      }`}
    >
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("common.edit")}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-ink-line hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onDeleteRequest}
          aria-label={t("common.delete")}
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-ink-line hover:text-danger-soft"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {editing ? (
        <form onSubmit={handleSaveNumber} className="flex items-center gap-1">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            autoFocus
            inputMode="numeric"
            className="input w-16 py-1 text-center text-lg font-extrabold"
            onKeyDown={(e) => e.key === "Escape" && (setEditing(false), setNumber(String(table.number)))}
          />
          <button type="submit" aria-label={t("common.save")} className="rounded-lg p-1.5 text-success hover:bg-ink-line">
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNumber(String(table.number));
            }}
            aria-label={t("common.cancel")}
            className="rounded-lg p-1.5 text-white/40 hover:bg-ink-line"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="text-2xl font-extrabold text-white">{t("table.numberShort", { number: table.number })}</p>
      )}

      <button
        type="button"
        onClick={toggleActive}
        disabled={updateMutation.isPending}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          table.isActive ? "bg-success/15 text-success hover:bg-success/25" : "bg-white/10 text-white/40 hover:bg-white/15"
        }`}
      >
        {table.isActive ? t("common.active") : t("common.inactive")}
      </button>
    </div>
  );
}
