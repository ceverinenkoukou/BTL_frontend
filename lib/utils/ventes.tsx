import type { Vente } from "@/lib/types/backend";
import { cn } from "@/lib/utils";

export type VenteEnrichie = Vente;

export const venteTypeMeta: Record<Vente["type_vente"], { label: string; className: string }> = {
  NORMAL: {
    label: "Vente normale",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  PROMOTION: {
    label: "Offert promo",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  GRATUIT: {
    label: "Offert goodie",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

export function VenteTypeBadge({ type }: { type: Vente["type_vente"] }) {
  const meta = venteTypeMeta[type] ?? venteTypeMeta.NORMAL;
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap", meta.className)}>
      {meta.label}
    </span>
  );
}

export const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

export const getSaleRevenueAmount = (sale: VenteEnrichie): number | null => {
  if (sale.type_vente !== "NORMAL") return 0;
  if (sale.prix_total === null || sale.prix_total === undefined) return null;
  const amount = Number(sale.prix_total);
  return Number.isFinite(amount) ? amount : null;
};

export const sumSaleRevenue = (items: VenteEnrichie[]) =>
  items.reduce((sum, sale) => sum + (getSaleRevenueAmount(sale) ?? 0), 0);

export const formatSaleTotal = (sale: VenteEnrichie) => {
  const amount = getSaleRevenueAmount(sale);
  return amount === null ? "Prix manquant" : fmt(amount);
};
