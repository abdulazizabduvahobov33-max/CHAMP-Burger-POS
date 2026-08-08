import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

type HeaderOverflowMenuProps = {
  children: ReactNode;
};

/**
 * Every page header in the app ends with the same trio (theme, language, sometimes change-
 * password) before Logout — self-contained buttons meant to sit inline in a row. On a narrow
 * phone that row doesn't fit next to the page title and Logout, so the whole header wrapped onto
 * a second line on every single page (confirmed visually — not a one-off). These three are all
 * low-frequency preference actions, not part of a cashier's actual workflow, so collapsing them
 * behind one icon on mobile removes the wrap without touching the buttons themselves or hiding
 * anything a user reaches for often. Logout stays outside this component, always visible — it's
 * the one action people specifically look for at the end of a shift.
 */
export function HeaderOverflowMenu({ children }: HeaderOverflowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      {/* sm and up: plenty of room, render exactly as before */}
      <div className="hidden items-center gap-2 sm:flex">{children}</div>

      {/* below sm: collapse into one toggle */}
      <div className="relative sm:hidden" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("common.moreActions")}
          aria-expanded={open}
          className="rounded-xl border border-ink-line p-2 text-white/50 transition hover:border-champ/50 hover:text-white"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full z-30 mt-2 flex animate-scale-in flex-col items-stretch gap-1 rounded-xl border border-ink-line bg-ink-card p-1.5 shadow-card">
            {children}
          </div>
        )}
      </div>
    </>
  );
}
