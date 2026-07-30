import { useTranslation } from "react-i18next";

import { DATE_PRESET_LABELS, DATE_PRESET_OPTIONS, type DateFilter } from "@/entities/report/model";

type DateRangeFilterProps = {
  value: DateFilter;
  onChange: (value: DateFilter) => void;
};

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_PRESET_OPTIONS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange({ ...value, preset })}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value.preset === preset ? "bg-champ text-onaccent" : "bg-ink-soft text-white/60 hover:text-white"
          }`}
        >
          {t(DATE_PRESET_LABELS[preset])}
        </button>
      ))}

      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="input w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-white/30">—</span>
          <input
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="input w-auto py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}
