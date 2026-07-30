import { useTranslation } from "react-i18next";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-ink-line px-4 py-3 text-sm text-white/60 sm:px-6">
      <span>{t("common.pageInfo", { page, pageCount, total })}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-ink-line px-3 py-1.5 font-medium transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("common.back")}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="rounded-lg border border-ink-line px-3 py-1.5 font-medium transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  );
}
