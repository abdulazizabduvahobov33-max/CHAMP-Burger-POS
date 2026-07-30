import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getErrorMessage } from "@/shared/lib/errors";
import { useAuthStore } from "@/shared/stores/authStore";
import { ChampLogo } from "@/shared/ui/ChampLogo";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { loginRequest } from "./authApi";
import { roleHome } from "./ProtectedRoute";

export function LoginPage() {
  const { t } = useTranslation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname;

  const mutation = useMutation({
    mutationFn: () => loginRequest(login, password),
    onSuccess: ({ accessToken, user }) => {
      setSession(user, accessToken);
      navigate(from ?? roleHome(user.role), { replace: true });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!login || !password || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <div
      className="relative flex min-h-full items-center justify-center overflow-hidden p-6"
      style={{
        backgroundImage:
          "radial-gradient(640px circle at 12% 15%, rgb(var(--color-champ) / 0.14), transparent 60%), radial-gradient(560px circle at 88% 88%, rgb(var(--color-champ) / 0.10), transparent 60%)",
      }}
    >
      <div className="absolute flex items-center gap-2 [top:max(1rem,env(safe-area-inset-top))] [right:max(1rem,env(safe-area-inset-right))]">
        <ThemeToggleButton />
        <LanguageSwitcher />
      </div>
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm animate-fade-in overflow-hidden rounded-card bg-ink-card p-8 shadow-glow">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-champ via-champ-hover to-champ" />

        <div className="mb-8 flex justify-center">
          <ChampLogo size="lg" subtitle="Burger POS" />
        </div>

        <div className="space-y-4">
          <Field label={t("auth.login")}>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="admin"
              className="input"
            />
          </Field>
          <Field label={t("auth.password")}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="input"
            />
          </Field>
        </div>

        {mutation.isError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
          >
            {getErrorMessage(mutation.error, t("auth.loginFailed"))}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !login || !password}
          className="mt-6 w-full rounded-xl bg-champ py-3 text-sm font-bold text-onaccent shadow-card transition hover:bg-champ-hover hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {mutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <p className="mt-6 text-center text-xs text-white/30">CHAMP Burger — POS + Inventory</p>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{label}</span>
      {children}
    </label>
  );
}
