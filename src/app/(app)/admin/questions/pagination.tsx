"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
}

export function Pagination({ page, totalPages }: PaginationProps) {
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    return `/admin/questions?${next.toString()}`;
  };

  return (
    <nav
      className="flex items-center justify-center gap-2"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-navy/80 transition-colors hover:border-gold hover:text-gold"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Précédente
        </Link>
      ) : (
        <span className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-navy/30">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Précédente
        </span>
      )}

      <span
        className={cn(
          "rounded-md bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold",
        )}
      >
        {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-navy/80 transition-colors hover:border-gold hover:text-gold"
        >
          Suivante
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-navy/30">
          Suivante
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
