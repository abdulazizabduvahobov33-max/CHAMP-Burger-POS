import { useState } from "react";
import { Bluetooth, Check, ChevronLeft, Loader2, Printer, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PairResult, PrinterProfile, PrinterRole, PrinterTransport, ReceiptDocument } from "@/shared/printing/model";
import { DEFAULT_PRINTER_MODEL_ID, PRINTER_MODEL_PRESETS } from "@/shared/printing/printerModels";
import { getDriver, getPairableDrivers } from "@/shared/printing/printerRegistry";
import { usePrinterProfilesStore } from "@/shared/printing/printerProfilesStore";
import { Dialog } from "@/shared/ui/Dialog";

type Step = "transport" | "pairing" | "configure" | "test";

function buildTestDocument(paperWidthMm: 58 | 80): ReceiptDocument {
  return {
    paperWidthMm,
    lines: [
      { type: "text", value: "ТЕСТОВАЯ ПЕЧАТЬ", align: "center", bold: true, size: "large" },
      { type: "spacer" },
      { type: "text", value: "Если вы видите этот чек —", align: "center" },
      { type: "text", value: "принтер подключён правильно.", align: "center" },
      { type: "rule" },
      { type: "row", left: "Дата", right: new Date().toLocaleString("ru-RU") },
      { type: "spacer" },
      { type: "cut" },
    ],
  };
}

/**
 * Settings → Чековый принтер → «Подключить принтер». Five short steps instead of one bare
 * "pair" button: choose how it's connected, pair it, name it, test it, done — aimed squarely at
 * "a non-technical person can do this without reading a manual" (see the request this shipped
 * for). Every step only ever talks to a driver through the three ReceiptPrinterDriver methods
 * (isSupported/pair/print) — adding a transport tomorrow doesn't change this file's structure,
 * only which driver a step 1 button represents.
 */
export function PrinterSetupWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("transport");
  const [transport, setTransport] = useState<PrinterTransport | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [paired, setPaired] = useState<PairResult & { ok: true }>();

  const [name, setName] = useState("");
  const [modelId, setModelId] = useState(DEFAULT_PRINTER_MODEL_ID);
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(58);
  const [role, setRole] = useState<PrinterRole>("register");
  const [savedProfile, setSavedProfile] = useState<PrinterProfile | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const addProfile = usePrinterProfilesStore((s) => s.addProfile);

  function reset() {
    setStep("transport");
    setTransport(null);
    setPairing(false);
    setPairError(null);
    setPaired(undefined);
    setName("");
    setModelId(DEFAULT_PRINTER_MODEL_ID);
    setPaperWidthMm(58);
    setRole("register");
    setSavedProfile(null);
    setTesting(false);
    setTestResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function chooseTransport(t: PrinterTransport) {
    setTransport(t);
    setPairError(null);
    setStep("pairing");
  }

  async function handlePair() {
    if (!transport) return;
    setPairing(true);
    setPairError(null);
    const result = await getDriver(transport).pair();
    setPairing(false);
    if (result.ok) {
      setPaired(result);
      setName(result.name);
      setStep("configure");
    } else if (result.error !== "cancelled") {
      setPairError(t("settings.printer.wizard.pairFailed"));
    }
  }

  function handleSaveProfile() {
    if (!transport || !paired) return;
    const profile: PrinterProfile = {
      id: crypto.randomUUID(),
      name: name.trim() || t("settings.printer.wizard.defaultName"),
      role,
      transport,
      paperWidthMm,
      ...paired.identity,
    };
    addProfile(profile);
    setSavedProfile(profile);
    setStep("test");
  }

  async function handleTestPrint() {
    if (!savedProfile) return;
    setTesting(true);
    setTestResult(null);
    const result = await getDriver(savedProfile.transport).print(buildTestDocument(savedProfile.paperWidthMm), savedProfile);
    setTesting(false);
    setTestResult(result.ok ? "ok" : "fail");
  }

  const pairableDrivers = getPairableDrivers();

  return (
    <Dialog open={open} onClose={handleClose} title={t("settings.printer.wizard.title")} widthClassName="max-w-md">
      {/* Step indicator — purely orientation ("you are here"), not clickable navigation; the
          wizard is intentionally linear so a first-time user can't get lost in it. */}
      <div className="mb-5 flex items-center gap-1.5">
        {(["transport", "pairing", "configure", "test"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              (["transport", "pairing", "configure", "test"] as Step[]).indexOf(step) >= i ? "bg-champ" : "bg-ink-line"
            }`}
          />
        ))}
      </div>

      {step === "transport" && (
        <div className="space-y-3">
          <p className="text-sm text-white/60">{t("settings.printer.wizard.transportPrompt")}</p>
          {pairableDrivers.filter((d) => d.isSupported()).length === 0 && (
            <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              {t("settings.printer.wizard.noTransportSupported")}
            </p>
          )}
          {pairableDrivers
            .filter((d) => d.isSupported())
            .map((driver) => (
              <button
                key={driver.transport}
                type="button"
                onClick={() => chooseTransport(driver.transport)}
                className="flex w-full items-center gap-3 rounded-xl border border-ink-line bg-ink-soft p-4 text-left transition hover:border-champ/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-champ/15 text-champ">
                  {driver.transport === "webusb" ? <Usb className="h-5 w-5" /> : <Bluetooth className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{driver.label}</p>
                  <p className="text-xs text-white/40">
                    {driver.transport === "webusb"
                      ? t("settings.printer.wizard.usbHint")
                      : t("settings.printer.wizard.bluetoothHint")}
                  </p>
                </div>
              </button>
            ))}
        </div>
      )}

      {step === "pairing" && transport && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            {transport === "webusb" ? t("settings.printer.wizard.usbInstructions") : t("settings.printer.wizard.bluetoothInstructions")}
          </p>
          {pairError && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
              {pairError}
            </p>
          )}
          <button
            type="button"
            onClick={handlePair}
            disabled={pairing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-champ py-3 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {pairing ? t("settings.printer.wizard.searching") : t("settings.printer.wizard.findPrinter")}
          </button>
          <button
            type="button"
            onClick={() => setStep("transport")}
            className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-white/40 transition hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t("common.back")}
          </button>
        </div>
      )}

      {step === "configure" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            <Check className="h-4 w-4 shrink-0" />
            {t("settings.printer.wizard.foundDevice", { name: paired?.name })}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("settings.printer.wizard.nameLabel")}
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("settings.printer.wizard.modelLabel")}
            </span>
            <select
              value={modelId}
              onChange={(e) => {
                const id = e.target.value;
                setModelId(id);
                const preset = PRINTER_MODEL_PRESETS.find((p) => p.id === id);
                if (preset) setPaperWidthMm(preset.paperWidthMm);
              }}
              className="input"
            >
              {PRINTER_MODEL_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {t(preset.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("settings.printer.wizard.paperWidthLabel")}
            </span>
            <div className="flex gap-2">
              {([58, 80] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPaperWidthMm(w)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${
                    paperWidthMm === w ? "border-champ bg-champ/15 text-champ" : "border-ink-line text-white/50 hover:text-white"
                  }`}
                >
                  {w} мм
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("settings.printer.wizard.roleLabel")}
            </span>
            <select value={role} onChange={(e) => setRole(e.target.value as PrinterRole)} className="input">
              <option value="register">{t("settings.printer.wizard.roleRegister")}</option>
              <option value="kitchen">{t("settings.printer.wizard.roleKitchen")}</option>
              <option value="bar">{t("settings.printer.wizard.roleBar")}</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleSaveProfile}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-champ py-3 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
          >
            {t("settings.printer.wizard.saveAndContinue")}
          </button>
        </div>
      )}

      {step === "test" && savedProfile && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            <Check className="h-4 w-4 shrink-0" />
            {t("settings.printer.wizard.profileSaved", { name: savedProfile.name })}
          </div>

          {testResult === "ok" && (
            <p className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
              {t("settings.printer.wizard.testOk")}
            </p>
          )}
          {testResult === "fail" && (
            <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
              {t("settings.printer.wizard.testFailed")}
            </p>
          )}

          <button
            type="button"
            onClick={handleTestPrint}
            disabled={testing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-line py-3 text-sm font-bold text-white/70 transition hover:border-champ/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {testing ? t("settings.printer.wizard.testing") : t("settings.printer.wizard.testPrint")}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-champ py-3 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
          >
            {t("settings.printer.wizard.done")}
          </button>
        </div>
      )}
    </Dialog>
  );
}
