import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useSetUserPassword } from "@/entities/user/api";
import type { AppUser } from "@/entities/user/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type UserPasswordDialogProps = {
  user: AppUser | null;
  onClose: () => void;
};

export function UserPasswordDialog({ user, onClose }: UserPasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const mutation = useSetUserPassword(user?.id ?? "");

  useEffect(() => {
    setPassword("");
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate(password, {
      onSuccess: () => {
        toast.success(t("user.password.changeSuccess"));
        onClose();
      },
    });
  }

  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? t("user.password.title", { name: user.name }) : t("user.password.titleDefault")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
            {t("user.password.newPassword")}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            minLength={6}
            className="input"
            autoComplete="new-password"
            placeholder={t("user.form.passwordPlaceholder")}
          />
        </label>

        <p className="text-xs text-white/40">{t("user.password.sessionsWarning")}</p>

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(mutation.error, t("user.password.changeFailed"))}
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
            disabled={mutation.isPending || password.length < 6}
            className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
