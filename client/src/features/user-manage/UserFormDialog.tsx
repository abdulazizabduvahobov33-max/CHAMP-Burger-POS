import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useCreateUser, useUpdateUser } from "@/entities/user/api";
import { ROLE_LABELS, ROLE_OPTIONS, type AppUser } from "@/entities/user/model";
import type { Role } from "@/shared/stores/authStore";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type UserFormDialogProps = {
  open: boolean;
  onClose: () => void;
  user?: AppUser | null;
};

export function UserFormDialog({ open, onClose, user }: UserFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(user);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("SELLER");

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(user?.id ?? "");
  const mutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setLogin(user?.login ?? "");
    setPassword("");
    setRole(user?.role ?? "SELLER");
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isEdit) {
      updateMutation.mutate(
        { name: name.trim(), login: login.trim(), role },
        {
          onSuccess: () => {
            toast.success(t("user.form.updateSuccess"));
            onClose();
          },
        },
      );
    } else {
      createMutation.mutate(
        { name: name.trim(), login: login.trim(), password, role },
        {
          onSuccess: () => {
            toast.success(t("user.form.createSuccess"));
            onClose();
          },
        },
      );
    }
  }

  const canSubmit = name.trim() && login.trim() && (isEdit || password.length >= 6);

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? t("user.form.editTitle") : t("user.form.createTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("user.form.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} className="input" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("user.form.login")}</span>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            minLength={3}
            maxLength={60}
            className="input"
            autoComplete="off"
          />
        </label>

        {!isEdit && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("user.form.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input"
              autoComplete="new-password"
              placeholder={t("user.form.passwordPlaceholder")}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("user.form.role")}</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABELS[r])}
              </option>
            ))}
          </select>
        </label>

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(mutation.error, t("common.saveFailed"))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !canSubmit}
            className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : isEdit ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
