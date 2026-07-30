import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Compact variant for small dialog lists (categories, suppliers) — smaller icon/padding. */
  compact?: boolean;
};

/** Shared "nothing here yet" state — replaces plain "Ничего не найдено" text everywhere a
 * list/table can be empty, so a brand-new install (or any filtered-to-zero view) reads as
 * intentional and inviting rather than broken. */
export function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={`flex animate-fade-in flex-col items-center justify-center text-center ${
        compact ? "px-6 py-10" : "px-6 py-16"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-champ/15 to-champ/5 ${
          compact ? "h-12 w-12" : "h-16 w-16"
        }`}
      >
        <Icon className={`text-champ ${compact ? "h-6 w-6" : "h-7 w-7"}`} strokeWidth={1.75} />
      </span>
      <p className={`font-semibold text-white ${compact ? "mt-3 text-sm" : "mt-4 text-base"}`}>{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-sm text-white/40">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 flex items-center gap-2 rounded-xl bg-champ px-4 py-2.5 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}
