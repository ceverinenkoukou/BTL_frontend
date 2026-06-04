"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { Vente, VenteStats, CampagneList } from "@/lib/types/backend";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ShoppingCart, Download, Package, FileText, Building2, MapPin,
} from "lucide-react";
import * as XLSX from "xlsx";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

export default function SalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Vente[]>([]);
  const [apiStats, setApiStats] = useState<VenteStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  const isHostess = user?.role === "Hotesse";
  const isAdmin = user?.role === "Administrateur";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ventesRes, statsRes, campRes] = await Promise.all([
        api.get<Vente[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/"),
        api.get<CampagneList[]>("/campagnes/"),
      ]);
      setSales(Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: Vente[] }).results ?? []));
      setApiStats(statsRes.data);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []));
    } catch {
      toast.error("Erreur lors du chargement des ventes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = sales.filter(s =>
    selectedCampaign === "all" || s.campagne_nom === campaigns.find(c => c.id === selectedCampaign)?.nom
  );

  const stats = {
    total: filtered.length,
    revenue: filtered.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0),
    unites: filtered.reduce((sum, s) => sum + s.quantite, 0),
  };

  const handleExport = () => {
    const data = filtered.map(s => ({
      Date: new Date(s.created_at).toLocaleDateString("fr-FR"),
      Heure: new Date(s.created_at).toLocaleTimeString("fr-FR"),
      Entreprise: s.entreprise_nom,
      Campagne: s.campagne_nom,
      Site: s.site_nom,
      Produit: s.produit_nom,
      Hôtesse: s.hotesse_nom,
      Conditionnement: s.conditionnement_display,
      Quantité: s.quantite,
      Total: s.prix_total ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventes");
    XLSX.writeFile(wb, `ventes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export téléchargé");
  };

  // Group by entreprise → campagne for admin
  const companyGroups = useMemo(() => {
    const map = new Map<string, { name: string; campMap: Map<string, { name: string; sales: Vente[] }> }>();
    filtered.forEach(s => {
      if (!map.has(s.entreprise_nom)) map.set(s.entreprise_nom, { name: s.entreprise_nom, campMap: new Map() });
      const cg = map.get(s.entreprise_nom)!;
      if (!cg.campMap.has(s.campagne_nom)) cg.campMap.set(s.campagne_nom, { name: s.campagne_nom, sales: [] });
      cg.campMap.get(s.campagne_nom)!.sales.push(s);
    });
    return [...map.values()].map(cg => ({
      name: cg.name,
      campaigns: [...cg.campMap.values()],
      totalRevenue: [...cg.campMap.values()].flatMap(c => c.sales).reduce((s, v) => s + Number(v.prix_total ?? 0), 0),
      totalSales: [...cg.campMap.values()].flatMap(c => c.sales).length,
    }));
  }, [filtered]);

  const exportCompanyPDF = (entrepriseNom: string) => {
    const companySales = sales.filter(s => s.entreprise_nom === entrepriseNom);
    const campMap = new Map<string, { name: string; sales: Vente[] }>();
    companySales.forEach(s => {
      if (!campMap.has(s.campagne_nom)) campMap.set(s.campagne_nom, { name: s.campagne_nom, sales: [] });
      campMap.get(s.campagne_nom)!.sales.push(s);
    });
    const totalRevenue = companySales.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0);
    const campaignRows = [...campMap.values()].map(camp => {
      const campRev = camp.sales.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0);
      return `
        <tr class="camp-row"><td colspan="5" class="camp-name">📍 ${camp.name}</td></tr>
        ${camp.sales.map(s => `<tr>
          <td>${new Date(s.created_at).toLocaleDateString("fr-FR")}</td>
          <td>${s.produit_nom}</td>
          <td class="r">${s.quantite} × ${s.conditionnement_display}</td>
          <td class="r">${s.site_nom}</td>
          <td class="r b">${Number(s.prix_total ?? 0).toLocaleString("fr-FR")} F</td>
        </tr>`).join("")}
        <tr class="sub"><td colspan="4" class="r">Sous-total ${camp.name}</td><td class="r b">${campRev.toLocaleString("fr-FR")} F</td></tr>
      `;
    }).join("");
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport Ventes – ${entrepriseNom}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:28px}
      .hdr{background:linear-gradient(135deg,#065f46,#0d9488);color:#fff;padding:20px 24px;border-radius:10px;margin-bottom:20px}
      .hdr h1{font-size:20px;font-weight:800}.hdr p{opacity:.7;margin-top:3px;font-size:11px}
      .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
      .kpi{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;text-align:center}
      .kpi .v{font-size:17px;font-weight:800;color:#065f46}.kpi .l{font-size:10px;color:#6b7280;margin-top:2px}
      table{width:100%;border-collapse:collapse}
      th{background:#065f46;color:#fff;padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
      .camp-row td{background:#f0fdf4;font-weight:700;color:#065f46;padding:8px 10px}
      .sub td{background:#dcfce7;font-size:11px}
      .r{text-align:right}.b{font-weight:700}
      .tot td{background:#065f46;color:#fff;font-weight:800;padding:9px 10px}
      .foot{margin-top:20px;text-align:center;color:#94a3b8;font-size:10px}
      @media print{body{padding:12px}}
    </style></head><body>
      <div class="hdr"><h1>${entrepriseNom}</h1><p>Rapport de ventes · Exporté le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${companySales.length}</div><div class="l">Total ventes</div></div>
        <div class="kpi"><div class="v">${companySales.reduce((s, v) => s + v.quantite, 0)}</div><div class="l">Unités vendues</div></div>
        <div class="kpi"><div class="v">${totalRevenue.toLocaleString("fr-FR")} F</div><div class="l">Chiffre d'affaires</div></div>
      </div>
      <table><thead><tr><th>Date</th><th>Produit</th><th class="r">Qté / Cond.</th><th>Site</th><th class="r">Total</th></tr></thead>
      <tbody>${campaignRows}<tr class="tot"><td colspan="4" class="r">TOTAL GÉNÉRAL</td><td class="r">${totalRevenue.toLocaleString("fr-FR")} F</td></tr></tbody></table>
      <div class="foot">Document généré automatiquement · ${entrepriseNom}</div>
    </body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.onload = () => setTimeout(() => win.print(), 300);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success(`Rapport PDF de ${entrepriseNom} prêt à imprimer`);
  };

  return (
    <div className="space-y-6">

      {isAdmin ? (
        <>
          {/* ── Admin hero banner ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 text-white shadow-2xl shadow-emerald-200">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-28 -bottom-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ventes</h1>
                  </div>
                  <p className="text-white/65 text-sm ml-12">Organisées par entreprise et campagne</p>
                </div>
                <button onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-white/90 text-sm font-bold transition-colors shadow-sm shrink-0">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exporter XLSX</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { icon: "🛒", label: "Total ventes",    value: apiStats?.total_ventes ?? stats.total,         sub: "enregistrées" },
                  { icon: "📦", label: "Unités vendues",  value: apiStats?.total_unites_vendues ?? stats.unites, sub: "produits"     },
                  { icon: "💰", label: "Chiffre d'aff.",  value: fmt(stats.revenue),                             sub: ""             },
                ].map((s, i) => (
                  <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                    <div className="text-base mb-1">{s.icon}</div>
                    <div className="text-xl font-bold leading-none">
                      {s.value}{s.sub && <span className="text-xs font-normal text-white/55 ml-1">{s.sub}</span>}
                    </div>
                    <div className="text-xs text-white/60 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter + export */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-56 rounded-xl border-slate-200">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold transition-colors">
              <Download className="w-4 h-4" />Exporter tout (XLSX)
            </button>
          </div>

          {/* Company sections */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : companyGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Aucune vente</p>
              <p className="text-xs text-muted-foreground">Aucune vente ne correspond aux filtres sélectionnés</p>
            </div>
          ) : (
            <div className="space-y-5">
              {companyGroups.map(({ name: compName, campaigns: compCamps, totalRevenue, totalSales }) => (
                <div key={compName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-emerald-100 px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-foreground truncate">{compName}</h2>
                        <p className="text-xs text-muted-foreground">
                          {compCamps.length} campagne{compCamps.length > 1 ? "s" : ""} · {totalSales} vente{totalSales > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-700">{fmt(totalRevenue)}</p>
                      </div>
                      <button onClick={() => exportCompanyPDF(compName)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-xs font-semibold transition-colors shadow-sm">
                        <FileText className="w-3.5 h-3.5" />PDF
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {compCamps.map(({ name: campName, sales: campSales }) => {
                      const campRevenue = campSales.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0);
                      return (
                        <div key={campName} className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                              <span className="font-semibold text-sm text-foreground">{campName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-emerald-700">{fmt(campRevenue)}</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                                {campSales.length} vente{campSales.length > 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  {["Produit", "Site", "Hôtesse", "Qté", "Total"].map((h, i) => (
                                    <th key={h} className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground",
                                      i < 3 ? "text-left" : "text-right")}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {campSales.map(sale => (
                                  <tr key={sale.id} className="bg-white hover:bg-slate-50/50 transition-colors">
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
                                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700 text-xs">
                                      {fmt(Number(sale.prix_total ?? 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ── Non-admin (Hôtesse / Superviseur / Entreprise) ── */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Ventes</h1>
              <p className="text-muted-foreground mt-1">
                {isHostess ? "Mes ventes enregistrées" : "Ventes de vos campagnes"}
              </p>
            </div>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />Exporter
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: stats.total,    label: "Ventes",          color: "text-emerald-600" },
              { value: stats.unites,   label: "Unités vendues",  color: "text-blue-600"    },
              { value: fmt(stats.revenue), label: "Chiffre d'aff.", color: "text-violet-600" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                {isHostess ? "Mes ventes" : "Toutes les ventes"}
              </h3>
              <span className="text-xs text-muted-foreground bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune vente enregistrée</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(sale => (
                  <div key={sale.id}
                    className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{sale.produit_nom}</p>
                          <p className="text-xs text-muted-foreground truncate">{sale.campagne_nom}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        {sale.conditionnement_display}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold text-foreground">{fmt(Number(sale.prix_total ?? 0))}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{sale.site_nom}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!isHostess && (
                      <p className="text-xs text-muted-foreground border-t pt-2">💃 {sale.hotesse_nom}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
