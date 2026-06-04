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
  const [filterCo, setFilterCo] = useState<string>("all");

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

      {/* ── Hero banner — Lime/Green ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lime-600 via-green-600 to-emerald-600 text-white shadow-2xl shadow-green-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_65%)]" />
        <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-32 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Produits</h1>
          </div>
          <p className="text-white/65 text-sm ml-12 mb-6">Gérez les produits par entreprise cliente</p>

          {/* KPI chips */}
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            {[
              { icon: "📦", label: "Total produits", value: kpis.total    },
              { icon: "🏢", label: "Entreprises",    value: kpis.companies},
            ].map((s, i) => (
              <div key={i} className="bg-white/18 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                <div className="text-base mb-1">{s.icon}</div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-white/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
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
