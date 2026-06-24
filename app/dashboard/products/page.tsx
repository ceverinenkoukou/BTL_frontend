"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { Entreprise } from "@/lib/types/backend";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Building2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { useUrlState } from "@/lib/hooks/useUrlState";

const COMPANY_GRADIENTS = [
  { from: "from-sky-500",    to: "to-blue-600",   light: "bg-sky-50",    border: "border-sky-100",    text: "text-sky-700",    dot: "bg-sky-400"    },
  { from: "from-violet-500", to: "to-purple-600",  light: "bg-violet-50", border: "border-violet-100", text: "text-violet-700", dot: "bg-violet-400" },
  { from: "from-emerald-500",to: "to-teal-600",    light: "bg-emerald-50",border: "border-emerald-100",text: "text-emerald-700",dot: "bg-emerald-400"},
  { from: "from-orange-500", to: "to-amber-600",   light: "bg-orange-50", border: "border-orange-100", text: "text-orange-700", dot: "bg-orange-400" },
  { from: "from-pink-500",   to: "to-rose-600",    light: "bg-pink-50",   border: "border-pink-100",   text: "text-pink-700",   dot: "bg-pink-400"   },
];

export default function ProductsPage() {
  const { user } = useAuth();
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCo, setFilterCo] = useUrlState("entreprise", "all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Entreprise[]>("/entreprises/");
      setEntreprises(Array.isArray(res.data) ? res.data : ((res.data as { results?: Entreprise[] }).results ?? []));
    } catch {
      toast.error("Erreur lors du chargement des produits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allProducts = useMemo(() =>
    entreprises.flatMap(e => e.produits.map(p => ({ ...p, entreprise_nom: e.nom_commercial, entreprise_id: e.id }))),
  [entreprises]);

  const grouped = useMemo(() => {
    return entreprises
      .map((ent, idx) => ({
        ent,
        style: COMPANY_GRADIENTS[idx % COMPANY_GRADIENTS.length],
        items: filterCo === "all" || filterCo === ent.id ? ent.produits : [],
      }))
      .filter(g => g.items.length > 0);
  }, [entreprises, filterCo]);

  const kpis = useMemo(() => ({
    total: allProducts.length,
    companies: entreprises.length,
  }), [allProducts, entreprises]);

  return (
    <div className="space-y-6">

      <PageHeader
        title="Produits"
        description="Gérez les produits par entreprise cliente"
        icon={<Package className="w-5 h-5" />}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md">
        {[
          { icon: "📦", label: "Total produits", value: kpis.total    },
          { icon: "🏢", label: "Entreprises",    value: kpis.companies},
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3.5 py-3">
            <div className="text-base mb-1">{s.icon}</div>
            <div className="text-2xl font-bold leading-none text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={filterCo} onValueChange={setFilterCo}>
          <SelectTrigger className="w-52 rounded-xl">
            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Toutes les entreprises" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entreprises</SelectItem>
            {entreprises.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nom_commercial}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Grouped by company ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-slate-50 rounded-2xl animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Package className="w-8 h-8 text-green-200" />
          </div>
          <p className="font-semibold text-foreground mb-1">Aucun produit</p>
          <p className="text-xs text-muted-foreground">Les produits sont gérés via la page Entreprises.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ ent, style, items }) => (
            <div key={ent.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Company header */}
              <div className={cn(
                "flex items-center justify-between gap-3 px-5 py-4 border-b",
                style.light, style.border
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shrink-0", style.from, style.to)}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">{ent.nom_commercial}</h2>
                    <p className={cn("text-xs font-medium", style.text)}>
                      {items.length} produit{items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className={cn("w-2.5 h-2.5 rounded-full", style.dot)} />
              </div>

              {/* Product cards grid */}
              <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(product => (
                  <div key={product.id} className="rounded-xl border border-slate-100 bg-white hover:border-green-200 hover:shadow-sm p-4 transition-all">
                    <div className="flex items-center gap-2.5 min-w-0 mb-3">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br text-white",
                        style.from, style.to
                      )}>
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{product.nom}</p>
                        <p className="text-xs text-muted-foreground">{product.type_conditionnement_display}</p>
                      </div>
                    </div>
                    {product.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                    )}
                    <div className="pt-2 border-t border-slate-50">
                      <span className={cn("text-base font-black", style.text)}>
                        {product.prix_indicatif
                          ? `${Number(product.prix_indicatif).toLocaleString("fr-FR")} F`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
