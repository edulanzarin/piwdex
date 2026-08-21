"use client";

import { cn } from "@/lib/cn";
import { Button, IconButton } from "./button";
import { IconChevronLeft, IconChevronRight } from "./icons";

/**
 * Paginacao. Mostra sempre primeira, ultima, a atual e as vizinhas, com
 * reticencia no meio — a lista de botoes nao pode crescer com o total, senao
 * 44 paginas viram 44 botoes.
 */
function pageList(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: (number | "gap")[] = [0];
  const from = Math.max(1, page - 1);
  const to = Math.min(total - 2, page + 1);
  if (from > 1) out.push("gap");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 2) out.push("gap");
  out.push(total - 1);
  return out;
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Paginacao" className={cn("flex items-center justify-center gap-1", className)}>
      <IconButton
        label="Pagina anterior"
        size="sm"
        variant="outline"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <IconChevronLeft size={10} />
      </IconButton>

      {pageList(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`gap${i}`} className="px-1 text-[12px] text-text-mute">
            ...
          </span>
        ) : (
          <Button
            key={p}
            size="sm"
            variant={p === page ? "primary" : "ghost"}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
            className="min-w-7 px-1.5 tabular"
          >
            {p + 1}
          </Button>
        ),
      )}

      <IconButton
        label="Proxima pagina"
        size="sm"
        variant="outline"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
      >
        <IconChevronRight size={10} />
      </IconButton>
    </nav>
  );
}
