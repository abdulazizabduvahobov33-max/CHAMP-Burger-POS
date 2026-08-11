import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ImagePlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useClearData, useSettings, useSystemInfo, useUpdateSettings } from "@/entities/setting/api";
import type { ClearDataSummary, CompanySettings } from "@/entities/setting/model";
import { ChangePasswordButton } from "@/features/change-password/ChangePasswordButton";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { HeaderOverflowMenu } from "@/shared/ui/HeaderOverflowMenu";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggleButton";
import { getErrorMessage } from "@/shared/lib/errors";
import { deleteImage, resolveUploadUrl, uploadImage } from "@/shared/lib/uploads";
import type { PrinterProfile, PrinterRole, PrinterTransport } from "@/shared/printing/model";
import { getPairableDrivers } from "@/shared/printing/printerRegistry";
import { usePrinterProfilesStore } from "@/shared/printing/printerProfilesStore";
import { PrinterSetupWizard } from "@/widgets/printer-wizard/PrinterSetupWizard";
import { useNotificationSoundSettingsStore } from "@/shared/notifications/notificationSoundSettingsStore";
import { playOrderChime } from "@/shared/notifications/sound";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { useAuthStore } from "@/shared/stores/authStore";
import { toast } from "@/shared/stores/toastStore";
import { Skeleton } from "@/shared/ui/Skeleton";
import { BrandMark } from "@/shared/ui/BrandMark";

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
          <BrandMark size={28} />
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
        <div className="ml-auto flex items-center gap-2">
          <HeaderOverflowMenu>
            <ChangePasswordButton />
            <ThemeToggleButton />
            <LanguageSwitcher />
          </HeaderOverflowMenu>
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
                      <img src={resolveUploadUrl(form.logo_url) as string} alt="" className="h-full w-full object-cover" />
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

        <PrinterSection />
        <NotificationSoundSection />
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

const ROLE_LABEL_KEY: Record<PrinterRole, string> = {
  register: "settings.printer.wizard.roleRegister",
  kitchen: "settings.printer.wizard.roleKitchen",
  bar: "settings.printer.wizard.roleBar",
};

const TRANSPORT_LABEL_KEY: Record<PrinterTransport, string> = {
  webusb: "settings.printer.transportUsb",
  webbluetooth: "settings.printer.transportBluetooth",
  preview: "settings.printer.transportUsb",
};

/** Lists every printer this device has been paired with (see printerProfilesStore.ts) — a
 * cashier's register printer, and optionally a kitchen/bar one, though nothing routes tickets to
 * those yet (see PrinterRole's comment in model.ts). "Подключить принтер" opens the step-by-step
 * PrinterSetupWizard instead of pairing inline here. */
function PrinterSection() {
  const { t } = useTranslation();
  const profiles = usePrinterProfilesStore((s) => s.profiles);
  const removeProfile = usePrinterProfilesStore((s) => s.removeProfile);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [removing, setRemoving] = useState<PrinterProfile | null>(null);
  const anySupported = getPairableDrivers().some((d) => d.isSupported());

  return (
    <section className="rounded-card bg-ink-card p-6 shadow-card">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-white/50">{t("settings.printer.title")}</h2>
      <p className="mb-4 text-xs text-white/30">{t("settings.printer.description")}</p>

      {!anySupported && (
        <p className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          {t("settings.printer.unsupported")}
        </p>
      )}

      <div className="space-y-2">
        {profiles.length === 0 && (
          <p className="rounded-xl border border-ink-line bg-ink-soft p-4 text-sm text-white/40">{t("settings.printer.notPaired")}</p>
        )}
        {profiles.map((profile) => (
          <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-soft p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                <span className="shrink-0 rounded-full bg-champ/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-champ">
                  {t(ROLE_LABEL_KEY[profile.role])}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-white/40">
                {t(TRANSPORT_LABEL_KEY[profile.transport])} · {profile.paperWidthMm} мм
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRemoving(profile)}
              className="shrink-0 rounded-xl border border-ink-line px-3 py-2 text-xs font-medium text-white/60 transition hover:border-danger/50 hover:text-danger-soft"
            >
              {t("settings.printer.forget")}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        disabled={!anySupported}
        className="mt-4 flex items-center gap-2 rounded-xl bg-champ px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("settings.printer.connect")}
      </button>

      <PrinterSetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      <ConfirmDialog
        open={removing !== null}
        title={t("settings.printer.forgetTitle")}
        description={t("settings.printer.forgetDescription", { name: removing?.name ?? "" })}
        confirmLabel={t("settings.printer.forget")}
        danger
        onConfirm={() => {
          if (removing) removeProfile(removing.id);
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}

/** Mute + volume for the "new order" chime (shared/notifications/sound.ts) — deliberately per-
 * device (plain localStorage, see notificationSoundSettingsStore.ts), same reasoning as the
 * printer section below: a speaker is a property of this till, not the business. */
function NotificationSoundSection() {
  const { t } = useTranslation();
  const muted = useNotificationSoundSettingsStore((s) => s.muted);
  const volume = useNotificationSoundSettingsStore((s) => s.volume);
  const setMuted = useNotificationSoundSettingsStore((s) => s.setMuted);
  const setVolume = useNotificationSoundSettingsStore((s) => s.setVolume);
  const volumePercent = Math.round(volume * 100);

  return (
    <section className="rounded-card bg-ink-card p-6 shadow-card">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-white/50">{t("settings.notifications.title")}</h2>
      <p className="mb-4 text-xs text-white/30">{t("settings.notifications.description")}</p>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-soft p-4">
        <div>
          <p className="text-sm font-semibold text-white">{t("settings.notifications.soundLabel")}</p>
          <p className="mt-0.5 text-xs text-white/40">{t("settings.notifications.soundHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!muted}
          aria-label={t("settings.notifications.soundLabel")}
          onClick={() => setMuted(!muted)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${muted ? "bg-ink-line" : "bg-champ"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${muted ? "translate-x-1" : "translate-x-6"}`}
          />
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-ink-line bg-ink-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="notif-volume" className="text-sm font-semibold text-white">
            {t("settings.notifications.volumeLabel")}
          </label>
          <span className="shrink-0 text-xs font-medium text-white/40">{volumePercent}%</span>
        </div>
        <input
          id="notif-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volumePercent}
          disabled={muted}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="mt-3 w-full accent-champ disabled:opacity-40"
        />
        <button
          type="button"
          onClick={() => playOrderChime()}
          disabled={muted}
          className="mt-4 rounded-xl border border-ink-line px-4 py-2 text-xs font-medium text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("settings.notifications.test")}
        </button>
      </div>
    </section>
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
          <p className="mt-1 text-lg font-bold text-white">{expiry?.accessTokenExpiry ?? "вЂ¦"}</p>
        </div>
        <div className="rounded-xl border border-ink-line bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">{t("settings.refreshToken")}</p>
          <p className="mt-1 text-lg font-bold text-white">{expiry?.refreshTokenExpiry ?? "вЂ¦"}</p>
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

/** SUPER_ADMIN-only вЂ” the whole /admin/settings route is already role-gated (see
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
