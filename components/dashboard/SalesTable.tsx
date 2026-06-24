"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type VenteEnrichie, VenteTypeBadge, fmt, getSaleRevenueAmount, sumSaleRevenue, formatSaleTotal,
} from "@/lib/utils/ventes";

type SortColumn = "date" | "produit" | "site" | "hotesse" | "quantite" | "total";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

const COLUMNS: { key: SortColumn; label: string; align?: "right" }[] = [
  { key: "date", label: "Date" },
  { key: "produit", label: "Produit" },
  { key: "site", label: "Site" },
  { key: "hotesse", label: "Hôtesse" },
  { key: "quantite", label: "Qté", align: "right" },
  { key: "total", label: "Total", align: "right" },
];

function sortValue(sale: VenteEnrichie, col: SortColumn): string | number {
  switch (col) {
    case "date": return new Date(sale.created_at).getTime();
    case "produit": return sale.produit_nom.toLowerCase();
    case "site": return sale.site_nom.toLowerCase();
    case "hotesse": return sale.hotesse_nom.toLowerCase();
    case "quantite": return sale.quantite;
    case "total": return getSaleRevenueAmount(sale) ?? -1;
  }
}

function dateGroupLabel(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function SalesTable({ sales }: { sales: VenteEnrichie[] }) {
  const [sortCol, setSortCol] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const copy = [...sales];
    copy.sort((a, b) => {
      const va = sortValue(a, sortCol);
      const vb = sortValue(b, sortCol);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [sales, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (col: SortColumn) => {
    setPage(1);
    if (col === sortCol) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "date" ? "desc" : "asc"); }
  };

  const totalRevenue = sumSaleRevenue(sales);
  const totalQuantite = sales.reduce((sum, s) => sum + s.quantite, 0);

  // Le groupement visuel par date n'a de sens que si le tri courant est sur la date.
  let lastDateLabel = "";

  return (
    <div className="space-y-2">
      {/* ── Desktop : tableau ── */}
      <div className="hidden sm:block rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {COLUMNS.map(col => (
                <th key={col.key}
                  className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors",
                    col.align === "right" ? "text-right" : "text-left")}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className={cn("inline-flex items-center gap-1", col.align === "right" && "justify-end")}>
                    {col.label}
                    {sortCol === col.key && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pageItems.map(sale => {
              const dateLabel = dateGroupLabel(sale.created_at);
              const showGroupHeader = sortCol === "date" && dateLabel !== lastDateLabel;
              lastDateLabel = dateLabel;
              return (
                <FragmentRow key={sale.id} sale={sale} showGroupHeader={showGroupHeader} dateLabel={dateLabel} />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
              <td className="px-3 py-2.5 text-xs text-foreground" colSpan={4}>TOTAL ({sales.length} vente{sales.length > 1 ? "s" : ""})</td>
              <td className="px-3 py-2.5 text-right text-xs text-foreground">{totalQuantite}</td>
              <td className="px-3 py-2.5 text-right text-xs text-emerald-700">{fmt(totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Mobile : liste condensée ── */}
      <div className="sm:hidden space-y-1.5">
        {pageItems.map(sale => (
          <div key={sale.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-white text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{sale.hotesse_nom}</p>
              <p className="text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold">{sale.quantite} u.</p>
              <p className={getSaleRevenueAmount(sale) === null ? "text-amber-700" : "text-emerald-700"}>{formatSaleTotal(sale)}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 text-xs font-bold">
          <span>TOTAL</span>
          <span className="text-emerald-700">{fmt(totalRevenue)}</span>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-xs text-muted-foreground">Page {safePage} / {totalPages}</p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ sale, showGroupHeader, dateLabel }: { sale: VenteEnrichie; showGroupHeader: boolean; dateLabel: string }) {
  return (
    <>
      {showGroupHeader && (
        <tr>
          <td colSpan={6} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-slate-50/60">
            {dateLabel}
          </td>
        </tr>
      )}
      <tr className="bg-white hover:bg-slate-50/50 transition-colors">
        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(sale.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
          {" "}{new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <span className="font-medium text-foreground text-xs">{sale.produit_nom}</span>
              <p className="text-xs text-muted-foreground">{sale.conditionnement_display}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />{sale.site_nom}
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">{sale.hotesse_nom}</td>
        <td className="px-3 py-2.5 text-right font-medium">{sale.quantite}</td>
        <td className={cn(
          "px-3 py-2.5 text-right font-bold text-xs",
          getSaleRevenueAmount(sale) === null ? "text-amber-700" : "text-emerald-700"
        )}>
          {formatSaleTotal(sale)}
        </td>
      </tr>
    </>
  );
}
