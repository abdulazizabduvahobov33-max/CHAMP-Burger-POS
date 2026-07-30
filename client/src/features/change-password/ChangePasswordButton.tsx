import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { changePasswordRequest } from "@/features/auth/authApi";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

/** Self-service password change, available to any authenticated role — drop next to
 * `LogoutButton` anywhere in the app (admin pages, the seller POS header, ...). */
export function ChangePasswordButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("user.password.changeTitle")}
        title={t("user.password.changeTitle")}
        className="rounded-xl border border-ink-line p-2 text-white/50 transition hover:border-champ/50 hover:text-white"
      >
        <KeyRound className="h-4 w-4" />
      </button>
      <ChangePasswordDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changePasswordRequest(currentPassword, newPassword),
    onSuccess: () => {
      setDone(true);
      toast.success(t("user.password.changeSuccess"));
    },
  });

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setDone(false);
    mutation.reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={handleClose} title={t("user.password.changeTitle")}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-success">{t("user.password.changeSuccess")}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
            >
              {t("user.password.done")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("user.password.current")}
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
              required
              className="input"
              autoComplete="current-password"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("user.password.new")}
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="input"
              autoComplete="new-password"
              placeholder={t("user.password.minLength")}
            />
          </label>

          {mutation.isError && (
            <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
              {getErrorMessage(mutation.error, t("user.password.changeFailed"))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !currentPassword || newPassword.length < 6}
              className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
