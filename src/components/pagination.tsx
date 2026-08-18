"use client";

import { useT } from "./locale-provider";
import { ChevronLeft, ChevronRight } from "./icons";

export function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  const t = useT();
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        className="btn btn-ghost disabled:opacity-40"
        disabled={page <= 0}
        onClick={() => onPage(Math.max(0, page - 1))}
        aria-label={t("hunt.pagePrev")}
      >
        <ChevronLeft size={11} />
      </button>
      <span className="text-[0.9rem] uppercase tracking-wide text-text-dim">{t("hunt.page", { a: page + 1, b: pageCount })}</span>
      <button
        type="button"
        className="btn btn-ghost disabled:opacity-40"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
        aria-label={t("hunt.pageNext")}
      >
        <ChevronRight size={11} />
      </button>
    </div>
  );
}
