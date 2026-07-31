import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getErrorMessage } from "@/shared/lib/errors";
import { useAuthStore } from "@/shared/stores/authStore";
import { ChampLogo } from "@/shared/ui/ChampLogo";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { loginRequest } from "./authApi";
import { roleHome } from "./ProtectedRoute";

const ERROR_AUTO_DISMISS_MS = 5000;

export function LoginPage() {
  const { t } = useTranslation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
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
    onError: () => setErrorVisible(true),
  });

  // Auto-dismiss — a login error is a transient validation message, not something that needs
  // to stay on screen until acknowledged. Re-triggers correctly on a second failed attempt
  // because handleSubmit flips this to `false` first, guaranteeing a real false→true edge for
  // the effect to react to (setting the same `true` value twice would otherwise be a no-op).
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
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden p-6"
      style={{
        backgroundImage:
          "radial-gradient(680px circle at 10% 8%, rgb(var(--color-champ) / 0.18), transparent 55%), " +
          "radial-gradient(620px circle at 92% 88%, rgb(220 38 38 / 0.16), transparent 55%), " +
          "radial-gradient(1000px circle at 50% 110%, rgb(var(--color-champ) / 0.08), transparent 60%)",
      }}
    >
      <div className="absolute flex items-center gap-2 [top:max(1rem,env(safe-area-inset-top))] [right:max(1rem,env(safe-area-inset-right))]">
        <ThemeToggleButton />
        <LanguageSwitcher />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm animate-fade-in overflow-hidden rounded-card border border-white/10 bg-ink-card/70 p-8 shadow-glow backdrop-blur-xl"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-champ via-red-500 to-champ" />

        <div className="mb-8 flex justify-center">
          <ChampLogo size="lg" subtitle="Burger POS" />
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
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-champ py-3 text-sm font-bold text-onaccent shadow-card transition hover:bg-champ-hover hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <p className="mt-6 text-center text-xs text-white/30">CHAMP Burger — POS + Inventory</p>
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
