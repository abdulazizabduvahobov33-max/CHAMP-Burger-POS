import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ImagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClearData, useSettings, useSystemInfo, useUpdateSettings } from "@/entities/setting/api";
import type { ClearDataSummary, CompanySettings } from "@/entities/setting/model";
import { ChangePasswordButton } from "@/features/change-password/ChangePasswordButton";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { getErrorMessage } from "@/shared/lib/errors";
import { deleteImage, uploadImage } from "@/shared/lib/uploads";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { useAuthStore } from "@/shared/stores/authStore";
import { toast } from "@/shared/stores/toastStore";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ChampMark } from "@/shared/ui/ChampMark";

type FormState = CompanySettings;

const EMPTY_FORM: FormState = {
  cafe_name: "",
  logo_url: "",
  contact_phone: "",
  address: "",
  currency: "",
  timezone: "",
  tax_percent: "0",
  receipt_header: "",
  receipt_footer: "",
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSettings();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLogoRef = useRef<string>("");

  const updateMutation = useUpdateSettings();

  useEffect(() => {
    if (!data) return;
    setForm(data.settings);
    initialLogoRef.current = data.settings.logo_url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function isUnsavedUpload(url: string): boolean {
    return url !== "" && url !== initialLogoRef.current;
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageUploading(true);
    setImageError(null);
    try {
      const url = await uploadImage(file);
      if (isUnsavedUpload(form.logo_url)) {
        void deleteImage(form.logo_url);
      }
      setForm((f) => ({ ...f, logo_url: url }));
    } catch (err) {
      setImageError(getErrorMessage(err, t("product.form.imageUploadFailed")));
    } finally {
      setImageUploading(false);
    }
  }

  function handleRemoveLogo() {
    if (isUnsavedUpload(form.logo_url)) {
      void deleteImage(form.logo_url);
    }
    setForm((f) => ({ ...f, logo_url: "" }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    updateMutation.mutate(
      { ...form, tax_percent: Number(form.tax_percent) },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success(t("settings.saved"));
        },
      },
    );
  }

  return (
    <div className="min-h-full p-6 [padding-top:max(1.5rem,env(safe-area-inset-top))] [padding-left:max(1.5rem,env(safe-area-inset-left))] [padding-right:max(1.5rem,env(safe-area-inset-right))] [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ChampMark size={28} />
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="rounded-lg p-2 text-white/40 transition hover:bg-ink-soft hover:text-white"
              aria-label={t("common.backToAdminAria")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight">{t("dashboard.sections.settings.title")}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChangePasswordButton />
          <ThemeToggleButton />
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </header>

      <div className="space-y-6">
        <section className="rounded-card bg-ink-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white/50">{t("settings.company")}</h2>

          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-40" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {isError && <p className="py-6 text-center text-sm text-danger-soft">{t("settings.loadError")}</p>}

          {!isLoading && !isError && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-ink-line bg-ink-soft">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-white/20" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("settings.logo")}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="rounded-xl border border-ink-line px-3 py-1.5 text-xs font-medium text-white/70 transition hover:text-white disabled:opacity-50"
                    >
                      {imageUploading ? t("product.form.uploading") : form.logo_url ? t("product.form.replace") : t("product.form.upload")}
                    </button>
                    {form.logo_url && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="rounded-xl border border-ink-line px-3 py-1.5 text-xs font-medium text-white/50 transition hover:text-danger-soft"
                      >
                        {t("product.form.remove")}
                      </button>
                    )}
                  </div>
                  {imageError && <p className="mt-1.5 text-xs text-danger-soft">{imageError}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("settings.companyName")}>
                  <input
                    value={form.cafe_name}
                    onChange={(e) => setForm((f) => ({ ...f, cafe_name: e.target.value }))}
                    required
                    maxLength={120}
                    className="input"
                  />
                </Field>
                <Field label={t("settings.phone")}>
                  <input
                    value={form.contact_phone}
                    onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    maxLength={40}
                    className="input"
                  />
                </Field>
                <Field label={t("settings.address")}>
                  <input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    maxLength={300}
                    className="input"
                  />
                </Field>
                <Field label={t("settings.currency")}>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    required
                    maxLength={10}
                    className="input"
                  />
                </Field>
                <Field label={t("settings.timezone")}>
                  <input
                    value={form.timezone}
                    onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                    placeholder={t("settings.timezonePlaceholder")}
                    maxLength={60}
                    className="input"
                  />
                </Field>
                <Field label={t("settings.taxPercent")}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={form.tax_percent}
                    onChange={(e) => setForm((f) => ({ ...f, tax_percent: e.target.value }))}
                    className="input"
                  />
                </Field>
              </div>

              <Field label={t("settings.receiptHeader")}>
                <input
                  value={form.receipt_header}
                  onChange={(e) => setForm((f) => ({ ...f, receipt_header: e.target.value }))}
                  maxLength={300}
                  className="input"
                />
              </Field>

              <Field label={t("settings.receiptFooter")}>
                <input
                  value={form.receipt_footer}
                  onChange={(e) => setForm((f) => ({ ...f, receipt_footer: e.target.value }))}
                  maxLength={300}
                  className="input"
                />
              </Field>

              {updateMutation.isError && (
                <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
                  {getErrorMessage(updateMutation.error, t("settings.saveFailed"))}
                </div>
              )}

              {saved && !updateMutation.isError && <p className="text-sm text-success">{t("settings.saved")}</p>}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !form.cafe_name.trim() || !form.currency.trim()}
                  className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateMutation.isPending ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          )}
        </section>

        <SecuritySection expiry={data?.security} />
        <SystemInfoSection />
        <DangerZoneSection />
      </div>
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

function SecuritySection({ expiry }: { expiry?: { accessTokenExpiry: string; refreshTokenExpiry: string } }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-card bg-ink-card p-6 shadow-card">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-white/50">{t("settings.security")}</h2>
      <p className="mb-4 text-xs text-white/30">{t("settings.securityDescription")}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">{t("settings.accessToken")}</p>
          <p className="mt-1 text-lg font-bold text-white">{expiry?.accessTokenExpiry ?? "…"}</p>
        </div>
        <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">{t("settings.refreshToken")}</p>
          <p className="mt-1 text-lg font-bold text-white">{expiry?.refreshTokenExpiry ?? "…"}</p>
        </div>
      </div>
    </section>
  );
}

function SystemInfoSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSystemInfo();

  return (
    <section className="rounded-card bg-ink-card p-6 shadow-card">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white/50">{t("settings.system")}</h2>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-ink-line bg-ink-soft p-4">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}
      {isError && <p className="py-4 text-center text-sm text-danger-soft">{t("settings.systemLoadError")}</p>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard label={t("settings.appVersion")} value={data.appVersion} />
            <InfoCard label="Node.js" value={data.nodeVersion} />
            <InfoCard label="Prisma" value={data.prismaVersion} />
            <InfoCard label="PostgreSQL" value={data.postgresVersion.split(",")[0]} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <InfoCard label={t("settings.usersCount")} value={String(data.counts.users)} />
            <InfoCard label={t("settings.productsCount")} value={String(data.counts.products)} />
            <InfoCard label={t("settings.salesCount")} value={String(data.counts.sales)} />
            <InfoCard label={t("settings.purchasesCount")} value={String(data.counts.purchases)} />
            <InfoCard label={t("settings.ingredientsCount")} value={String(data.counts.ingredients)} />
          </div>
        </div>
      )}
    </section>
  );
}

/** SUPER_ADMIN-only — the whole /admin/settings route is already role-gated (see
 * app/routes.tsx), but this section is destructive enough to double-check locally too, in
 * case this component is ever reused somewhere less strictly guarded. */
function DangerZoneSection() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<ClearDataSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearDataMutation = useClearData();

  if (role !== "SUPER_ADMIN") return null;

  return (
    <section className="rounded-card border border-danger/30 bg-ink-card p-6 shadow-card">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-danger-soft">
        <AlertTriangle className="h-4 w-4" />
        {t("settings.dangerZone")}
      </h2>
      <p className="mb-4 text-xs text-white/40">{t("settings.clearDataDescription")}</p>

      {result && (
        <p className="mb-4 text-sm text-success">
          {t("settings.clearDataSuccess", {
            sales: result.sales,
            purchases: result.purchases,
            movements: result.stockMovements,
          })}
        </p>
      )}
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setResult(null);
          setError(null);
          setConfirmOpen(true);
        }}
        className="rounded-xl border border-danger/50 px-4 py-2 text-sm font-bold text-danger-soft transition hover:bg-danger/10"
      >
        {t("settings.clearDataButton")}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={t("settings.clearDataConfirmTitle")}
        description={t("settings.clearDataConfirmDescription")}
        confirmLabel={t("settings.clearDataButton")}
        danger
        pending={clearDataMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          clearDataMutation.mutate(undefined, {
            onSuccess: (summary) => {
              setResult(summary);
              setConfirmOpen(false);
              toast.success(
                t("settings.clearDataSuccess", {
                  sales: summary.sales,
                  purchases: summary.purchases,
                  movements: summary.stockMovements,
                }),
              );
            },
            onError: (err) => {
              const message = getErrorMessage(err, t("settings.clearDataFailed"));
              setError(message);
              setConfirmOpen(false);
              toast.error(message);
            },
          });
        }}
      />
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
      <p className="truncate text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white" title={value}>
        {value}
      </p>
    </div>
  );
}
