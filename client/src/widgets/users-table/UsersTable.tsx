import { useState } from "react";
import { KeyRound, Pencil, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDeleteUser, useUpdateUser, useUsers } from "@/entities/user/api";
import { ROLE_LABELS, type AppUser } from "@/entities/user/model";
import { UserFormDialog } from "@/features/user-manage/UserFormDialog";
import { UserPasswordDialog } from "@/features/user-manage/UserPasswordDialog";
import { getErrorMessage } from "@/shared/lib/errors";
import { useAuthStore } from "@/shared/stores/authStore";
import { toast } from "@/shared/stores/toastStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { SkeletonTableRows } from "@/shared/ui/Skeleton";

export function UsersTable() {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: users, isLoading, isError } = useUsers();

  const [formTarget, setFormTarget] = useState<AppUser | null | undefined>(undefined);
  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const deleteMutation = useDeleteUser();

  return (
    <div className="rounded-card bg-ink-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-ink-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/50">{t("user.title")}</h2>
        <button
          type="button"
          onClick={() => setFormTarget(null)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-champ px-4 py-2.5 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
        >
          <Plus className="h-4 w-4" />
          {t("user.addUser")}
        </button>
      </div>

      {rowError && (
        <div role="alert" className="mx-4 mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft sm:mx-6">
          {rowError}
        </div>
      )}

      {isLoading && <SkeletonTableRows rows={6} columns={4} />}
      {isError && <p className="px-6 py-10 text-center text-sm text-danger-soft">{t("user.loadError")}</p>}

      {users && users.length === 0 && (
        <EmptyState
          icon={UsersIcon}
          title={t("user.emptyTitle")}
          description={t("user.emptyDescription")}
          action={{ label: t("user.addUser"), icon: Plus, onClick: () => setFormTarget(null) }}
        />
      )}

      {users && users.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-6 py-3 font-medium">{t("user.columns.name")}</th>
                  <th className="px-6 py-3 font-medium">{t("user.columns.login")}</th>
                  <th className="px-6 py-3 font-medium">{t("user.columns.role")}</th>
                  <th className="px-6 py-3 font-medium">{t("user.columns.status")}</th>
                  <th className="px-6 py-3 font-medium">{t("user.columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-line">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isSelf={user.id === currentUserId}
                    onEdit={() => setFormTarget(user)}
                    onPassword={() => setPasswordTarget(user)}
                    onDelete={() => setDeleteTarget(user)}
                    onError={setRowError}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 md:hidden">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                onEdit={() => setFormTarget(user)}
                onPassword={() => setPasswordTarget(user)}
                onDelete={() => setDeleteTarget(user)}
                onError={setRowError}
              />
            ))}
          </div>
        </>
      )}

      <UserFormDialog open={formTarget !== undefined} onClose={() => setFormTarget(undefined)} user={formTarget} />
      <UserPasswordDialog user={passwordTarget} onClose={() => setPasswordTarget(null)} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("user.deleteTitle")}
        description={deleteTarget ? t("user.deleteDescription", { name: deleteTarget.name }) : ""}
        confirmLabel={t("common.delete")}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          setRowError(null);
          deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(t("user.deleteSuccess"));
              setDeleteTarget(null);
            },
            onError: (err) => setRowError(getErrorMessage(err, t("user.deleteFailed"))),
          });
        }}
      />
    </div>
  );
}

type RowProps = {
  user: AppUser;
  isSelf: boolean;
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
  onError: (msg: string | null) => void;
};

function useToggleActive(user: AppUser, onError: (msg: string | null) => void) {
  const { t } = useTranslation();
  const updateMutation = useUpdateUser(user.id);

  function toggleActive() {
    onError(null);
    updateMutation.mutate(
      { isActive: !user.isActive },
      {
        onSuccess: () => toast.success(user.isActive ? t("user.deactivateSuccess") : t("user.activateSuccess")),
        onError: (err) => onError(getErrorMessage(err, t("user.statusChangeFailed"))),
      },
    );
  }

  return { toggleActive, isPending: updateMutation.isPending };
}

function UserRow({ user, isSelf, onEdit, onPassword, onDelete, onError }: RowProps) {
  const { t } = useTranslation();
  const { toggleActive, isPending } = useToggleActive(user, onError);

  return (
    <tr className="transition hover:bg-ink-soft/60">
      <td className="px-6 py-3 text-white">
        {user.name}
        {isSelf && <span className="ml-2 text-xs text-white/30">{t("user.youSuffix")}</span>}
      </td>
      <td className="px-6 py-3 text-white/70">{user.login}</td>
      <td className="px-6 py-3 text-white/70">{t(ROLE_LABELS[user.role])}</td>
      <td className="px-6 py-3">
        <button
          type="button"
          onClick={toggleActive}
          disabled={isSelf || isPending}
          title={isSelf ? t("user.deactivateSelfTooltip") : user.isActive ? t("user.deactivate") : t("user.activate")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            user.isActive ? "bg-success/15 text-success hover:bg-success/25" : "bg-white/10 text-white/40 hover:bg-white/15"
          }`}
        >
          {user.isActive ? t("common.active") : t("common.inactive")}
        </button>
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-1">
          <IconButton label={t("user.changePassword")} onClick={onPassword}>
            <KeyRound className="h-4 w-4" />
          </IconButton>
          <IconButton label={t("common.edit")} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={t("common.delete")}
            onClick={onDelete}
            tone="danger"
            disabled={isSelf}
            disabledTitle={t("user.deleteSelfTooltip")}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function UserCard({ user, isSelf, onEdit, onPassword, onDelete, onError }: RowProps) {
  const { t } = useTranslation();
  const { toggleActive, isPending } = useToggleActive(user, onError);

  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">
            {user.name}
            {isSelf && <span className="ml-2 text-xs text-white/30">{t("user.youSuffix")}</span>}
          </p>
          <p className="truncate text-xs text-white/40">{user.login}</p>
        </div>
        <button
          type="button"
          onClick={toggleActive}
          disabled={isSelf || isPending}
          title={isSelf ? t("user.deactivateSelfTooltip") : user.isActive ? t("user.deactivate") : t("user.activate")}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            user.isActive ? "bg-success/15 text-success hover:bg-success/25" : "bg-white/10 text-white/40 hover:bg-white/15"
          }`}
        >
          {user.isActive ? t("common.active") : t("common.inactive")}
        </button>
      </div>
      <p className="mb-3 text-xs text-white/40">{t(ROLE_LABELS[user.role])}</p>
      <div className="flex items-center gap-1">
        <IconButton label={t("user.changePassword")} onClick={onPassword}>
          <KeyRound className="h-4 w-4" />
        </IconButton>
        <IconButton label={t("common.edit")} onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={t("common.delete")}
          onClick={onDelete}
          tone="danger"
          disabled={isSelf}
          disabledTitle={t("user.deleteSelfTooltip")}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  tone = "default",
  disabled = false,
  disabledTitle,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledTitle : label}
      aria-label={label}
      className={`rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${
        tone === "danger" ? "hover:!text-danger-soft" : ""
      }`}
    >
      {children}
    </button>
  );
}
