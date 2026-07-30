import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "@/shared/stores/authStore";
import { logoutRequest } from "./authApi";

export function LogoutButton() {
  const { t } = useTranslation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clearSession();
      navigate("/login", { replace: true });
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:border-danger/50 hover:text-danger-soft disabled:opacity-50"
    >
      {t("common.logout")}
    </button>
  );
}
