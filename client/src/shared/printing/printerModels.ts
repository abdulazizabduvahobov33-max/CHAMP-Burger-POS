/**
 * Purely a convenience layer for the setup wizard's "which printer do you have" step — picking a
 * preset just pre-fills a paper width and a friendly default name; there is no per-model code
 * path anywhere in the printing stack (see escpos.ts/model.ts). A brand or model missing from
 * this list still works via the generic presets — printing itself never depended on this list,
 * only how the wizard labels the step. `labelKey` (not a raw string) so the "generic 58/80mm"
 * wording is translated like everything else in the wizard; brand names translate to themselves.
 */
export type PrinterModelPreset = {
  id: string;
  labelKey: string;
  paperWidthMm: 58 | 80;
};

export const PRINTER_MODEL_PRESETS: PrinterModelPreset[] = [
  { id: "xprinter-58", labelKey: "settings.printer.wizard.models.xprinter58", paperWidthMm: 58 },
  { id: "xprinter-80", labelKey: "settings.printer.wizard.models.xprinter80", paperWidthMm: 80 },
  { id: "generic-58", labelKey: "settings.printer.wizard.models.generic58", paperWidthMm: 58 },
  { id: "generic-80", labelKey: "settings.printer.wizard.models.generic80", paperWidthMm: 80 },
];

export const DEFAULT_PRINTER_MODEL_ID = "generic-58";
