import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, ShieldAlert, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getErrorMessage } from "@/shared/lib/errors";
import { useAuthStore } from "@/shared/stores/authStore";

import { loginRequest } from "./authApi";
import { roleHome } from "./ProtectedRoute";

const ERROR_AUTO_DISMISS_MS = 5000;

/**
 * A deliberately separate entry point from the normal cashier/waiter LoginPage — same
 * `/auth/login` endpoint underneath (there's only one accounts table; role comes from whichever
 * credentials were entered, see ensureOwnerExists.ts), but its own URL ("/owner/login"), its own
 * plain/locked visual language, and it's never linked from anywhere else in the app. A
 * SUPER_ADMIN or SELLER session landing here on "/owner" gets bounced straight back to their own
 * home by ProtectedRoute — only a login that actually resolves to role OWNER ever gets past this
 * screen, see routes.tsx.
 */
export function OwnerLoginPage() {
  const { t } = useTranslation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => loginRequest(login, password),
    onSuccess: ({ accessToken, user }) => {
      setSession(user, accessToken);
      navigate(roleHome(user.role), { replace: true });
    },
    onError: () => setErrorVisible(true),
  });

  useEffect(() => {
    if (!errorVisible) return;
    const timer = window.setTimeout(() => setErrorVisible(false), ERROR_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [errorVisible]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!login || !password || mutation.isPending) return;
    setErrorVisible(false);
    mutation.mutate();
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-fade-in rounded-card border border-white/10 bg-ink-card p-8 shadow-glow"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/60">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-bold text-white">{t("owner.loginTitle")}</p>
            <p className="mt-1 text-xs text-white/40">{t("owner.loginSubtitle")}</p>
          </div>
        </div>

        <div className="space-y-4">
          <Field label={t("auth.login")} icon={User}>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder={t("auth.loginPlaceholder")}
              className="input pl-10"
            />
          </Field>

          <Field label={t("auth.password")} icon={Lock}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
              className="input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/30 transition hover:bg-ink-line hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </Field>
        </div>

        <div
          className={`grid transition-all duration-300 ease-out ${
            mutation.isError && errorVisible ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div
              role="alert"
              className="flex animate-scale-in items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-center text-sm text-danger-soft"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{getErrorMessage(mutation.error, t("auth.loginFailed"))}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || !login || !password}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-bold text-white shadow-card transition hover:bg-white/15 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        {children}
      </div>
    </label>
  );
}
