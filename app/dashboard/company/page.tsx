"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, CampagneRapportSites, CampagneSiteRapport, Degustation, Vente, VenteStats, SiteList, Entreprise, ObjectifSite, GainPromotion } from "@/lib/types/backend";
import { getObjectifs } from "@/lib/services/objectifService";
import { getMyEntreprise } from "@/lib/services/entrepriseService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Target, Trophy, ShoppingCart, TrendingUp, Users,
  CalendarDays, MapPin, ArrowUp, Beer, Gift, Box, Clock, CheckCircle2, AlertCircle,
  Download, FileText, RefreshCw, Tag, Gauge, Building2, Calendar, LayoutDashboard
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { buildChartPalette } from "@/lib/utils/branding";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}
function fmtXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}

function hex(color: string, alpha: number) {
  const c = (color || "#006776").replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-100 p-3 text-xs min-w-[140px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CompanyDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [tastings, setTastings] = useState<Degustation[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [venteStats, setVenteStats] = useState<VenteStats | null>(null);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [goodiesTotal, setGoodiesTotal] = useState(0);
  const [goodiesDistribues, setGoodiesDistribues] = useState(0);
  const [goodiesCampsCount, setGoodiesCampsCount] = useState(0);
  const [objectifs, setObjectifs] = useState<ObjectifSite[]>([]);
  const [rapports, setRapports] = useState<CampagneRapportSites[]>([]);
  const [gainsPromotions, setGainsPromotions] = useState<GainPromotion[]>([]);
  const [selectedMecaniqueSite, setSelectedMecaniqueSite] = useState<string>("");
  const [selectedProduitSite, setSelectedProduitSite] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [period, setPeriod] = useState<"today" | "7" | "30" | "custom">("7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, tastRes, ventesRes, statsRes, siteRes, ent, objData, gainsRes] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/").catch(() => ({ data: null })),
        api.get<SiteList[]>("/sites/"),
        getMyEntreprise(),
        getObjectifs().catch(() => [] as ObjectifSite[]),
        api.get<GainPromotion[]>("/gains-promotions/").catch(() => ({ data: [] })),
      ]);
      const campList = Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []);
      setCampaigns(campList);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : ((tastRes.data as { results?: Degustation[] }).results ?? []));
      setVentes(Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: Vente[] }).results ?? []));
      setVenteStats(statsRes.data as VenteStats | null);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : ((siteRes.data as { results?: SiteList[] }).results ?? []));
      setEntreprise(ent);
      setObjectifs(objData);
      setGainsPromotions(Array.isArray(gainsRes.data) ? gainsRes.data : ((gainsRes.data as { results?: GainPromotion[] }).results ?? []));

      // Fetch all campaign rapports
      const rapportResults = await Promise.all(
        campList.map(c =>
          api.get<CampagneRapportSites>(`/campagnes/${c.id}/rapport-sites/`).catch(() => null)
        )
      );
      const validRapports = rapportResults.filter(Boolean).map(r => r!.data);
      setRapports(validRapports);
      setLastRefresh(new Date());

      // Fetch goodies stats for campaigns with goodies
      const goodiesCamps = campList.filter(c => c.type_recompense === "GOODIES");
      setGoodiesCampsCount(goodiesCamps.length);
      let totalAlloue = 0;
      let totalDistribue = 0;
      validRapports.forEach(r => {
        totalDistribue += r.totaux?.goodies_distribues ?? 0;
        r.sites?.forEach(site => {
          (site.goodies ?? []).forEach(g => { totalAlloue += g.quantite_initiale ?? 0; });
        });
      });
      if (totalAlloue > 0 || totalDistribue > 0) {
        setGoodiesTotal(totalAlloue);
        setGoodiesDistribues(totalDistribue);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/auth/login"); return; }
      if (user.role !== "Entreprise") { router.push("/dashboard"); return; }
      fetchAll();
      refreshTimer.current = setInterval(fetchAll, 30000);
      return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
    }
  }, [user, authLoading, router, fetchAll]);

  useEffect(() => {
    if (selectedMecaniqueSite) return;
    const firstSite = rapports.flatMap(r => r.sites?.map(s => s.nom) ?? [])
      .find(nom =>
        ventes.some(v => v.site_nom === nom && v.type_vente === "NORMAL") ||
        gainsPromotions.some(g => g.site_nom === nom)
      );
    if (firstSite) setSelectedMecaniqueSite(firstSite);
  }, [rapports, ventes, gainsPromotions, selectedMecaniqueSite]);

  useEffect(() => {
    if (selectedProduitSite) return;
    const firstSite = sites.find(s => ventes.some(v => v.site_nom === s.nom))?.nom;
    if (firstSite) setSelectedProduitSite(firstSite);
  }, [sites, ventes, selectedProduitSite]);

  // Find current selected campaign metadata
  const selectedCampaign = campaigns.find(c => c.id.toString() === selectedCampaignId);

  // Filtered data based on selected campaign
  const filteredTastings = selectedCampaignId === "all" 
    ? tastings 
    : tastings.filter(t => t.campagne_nom === selectedCampaign?.nom);

  const filteredVentes = selectedCampaignId === "all" 
    ? ventes 
    : ventes.filter(v => v.campagne_nom === selectedCampaign?.nom);

  const filteredGainsPromotions = selectedCampaignId === "all"
    ? gainsPromotions
    : gainsPromotions.filter(g => g.campagne === selectedCampaignId);

  // Computed stats from filtered scope
  const totalTastings = filteredTastings.length;
  const totalSales    = filteredVentes.length;
  const totalRevenue  = filteredVentes.reduce((s, v) => s + Number(v.prix_total ?? 0), 0);
  const conversionRate = totalTastings > 0 ? Math.round((totalSales / totalTastings) * 100) : 0;

  // Count active sites for the selection context
  const activeSitesCount = selectedCampaignId === "all"
    ? sites.length
    : selectedCampaign?.nb_sites ?? 0;

  // Per-site breakdown
  const bySite = sites.map(site => ({
    zone: site.nom,
    tastings: filteredTastings.filter(t => t.site_nom === site.nom).length,
    sales: filteredVentes.filter(v => v.site_nom === site.nom).length,
  })).filter(s => s.tastings > 0 || s.sales > 0);

  // Per-product breakdown
  const prodMap = new Map<string, { sales: number; revenue: number }>();
  filteredVentes.forEach(v => {
    const cur = prodMap.get(v.produit_nom) ?? { sales: 0, revenue: 0 };
    prodMap.set(v.produit_nom, { sales: cur.sales + 1, revenue: cur.revenue + Number(v.prix_total ?? 0) });
  });
  const byProduct = [...prodMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // Per-product breakdown — sites disposant de ventes
  const produitSiteOptions = sites
    .filter(s => filteredVentes.some(v => v.site_nom === s.nom))
    .map(s => s.nom);

  const produitSiteStats = selectedProduitSite
    ? (() => {
        const siteVentes = filteredVentes.filter(v => v.site_nom === selectedProduitSite);
        const counts = new Map<string, number>();
        siteVentes.forEach(v => counts.set(v.produit_nom, (counts.get(v.produit_nom) ?? 0) + 1));
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return {
          totalVentes: siteVentes.length,
          totalCA: siteVentes.reduce((s, v) => s + Number(v.prix_total ?? 0), 0),
          topProduit: top[0]?.[0] ?? "—",
          topNames: top.slice(0, 5).map(([name]) => name),
        };
      })()
    : { totalVentes: 0, totalCA: 0, topProduit: "—", topNames: [] as string[] };

  const produitSiteDaily = selectedProduitSite
    ? (() => {
        const siteVentes = filteredVentes.filter(v => v.site_nom === selectedProduitSite);
        const dates = Array.from(new Set(siteVentes.map(v => v.created_at.slice(0, 10)))).sort();
        return dates.map(d => {
          const row: Record<string, string | number> = {
            date: new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          };
          produitSiteStats.topNames.forEach(name => {
            row[name] = siteVentes.filter(v => v.produit_nom === name && v.created_at.slice(0, 10) === d).length;
          });
          return row;
        });
      })()
    : [];

  // Per age breakdown
  const ageMap = new Map<string, number>();
  filteredTastings.forEach(t => ageMap.set(t.tranche_age_display, (ageMap.get(t.tranche_age_display) ?? 0) + 1));
  const byAge = totalTastings > 0
    ? [...ageMap.entries()].map(([name, count]) => ({ name, value: Math.round((count / totalTastings) * 100) }))
    : [];

  // Campaign context specifics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const campJoursEcoules = selectedCampaign
    ? Math.max(0, Math.floor((today.getTime() - new Date(selectedCampaign.date_debut).getTime()) / 86400000))
    : 0;

  const campJoursRestants = selectedCampaign
    ? Math.max(0, Math.floor((new Date(selectedCampaign.date_fin).getTime() - today.getTime()) / 86400000))
    : 0;

  // Goodies logic scoped to dynamic context
  const filteredGoodiesDistribues = selectedCampaignId === "all"
    ? goodiesDistribues
    : rapports.find(r => r.campagne_id === selectedCampaignId)?.totaux?.goodies_distribues ?? 0;

  const filteredGoodiesTotal = selectedCampaignId === "all"
    ? goodiesTotal
    : (rapports.find(r => r.campagne_id === selectedCampaignId)?.sites ?? []).reduce((sum, site) => {
        return sum + (site.goodies ?? []).reduce((s, g) => s + (g.quantite_initiale ?? 0), 0);
      }, 0);

  // Mécaniques promotionnelles — adaptées au filtre contextuel
  const mecaniquePromoSites = Array.from(new Set(rapports.flatMap(r => r.sites?.map(s => s.nom) ?? [])))
    .map(nom => ({
      nom,
      vendus: filteredVentes.filter(v => v.site_nom === nom && v.type_vente === "NORMAL").length,
      offerts: filteredGainsPromotions.filter(g => g.site_nom === nom && g.type_promotion === "OFFERT").length,
      goodies: filteredGainsPromotions.filter(g => g.site_nom === nom && g.type_promotion === "GAGNE").length,
      tirages: filteredGainsPromotions.filter(g => g.site_nom === nom && g.type_promotion === "TIRAGE").length,
    }))
    .filter(s => s.vendus + s.offerts + s.goodies + s.tirages > 0);

  const mecaniquePromoTotaux = {
    vendus: filteredVentes.filter(v => v.type_vente === "NORMAL").length,
    offerts: filteredGainsPromotions.filter(g => g.type_promotion === "OFFERT").length,
    goodies: filteredGainsPromotions.filter(g => g.type_promotion === "GAGNE").length,
    tirages: filteredGainsPromotions.filter(g => g.type_promotion === "TIRAGE").length,
  };

  const mecaniqueSiteDaily = selectedMecaniqueSite
    ? (() => {
        const dates = new Set<string>();
        filteredVentes.forEach(v => { if (v.site_nom === selectedMecaniqueSite) dates.add(v.created_at.slice(0, 10)); });
        filteredGainsPromotions.forEach(g => { if (g.site_nom === selectedMecaniqueSite) dates.add(g.created_at.slice(0, 10)); });
        return Array.from(dates).sort().map(d => ({
          date: new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          vendus: filteredVentes.filter(v => v.site_nom === selectedMecaniqueSite && v.type_vente === "NORMAL" && v.created_at.slice(0, 10) === d).length,
          offerts: filteredGainsPromotions.filter(g => g.site_nom === selectedMecaniqueSite && g.type_promotion === "OFFERT" && g.created_at.slice(0, 10) === d).length,
          goodies: filteredGainsPromotions.filter(g => g.site_nom === selectedMecaniqueSite && g.type_promotion === "GAGNE" && g.created_at.slice(0, 10) === d).length,
          tirages: filteredGainsPromotions.filter(g => g.site_nom === selectedMecaniqueSite && g.type_promotion === "TIRAGE" && g.created_at.slice(0, 10) === d).length,
        }));
      })()
    : [];

  // Per-day chart matrix
  const periodDays = (() => {
    if (period === "today") return 1;
    if (period === "30") return 30;
    if (period === "custom") return null;
    return 7;
  })();

  const dailyData = periodDays
    ? Array.from({ length: periodDays }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (periodDays - 1 - i));
        const dayStr = d.toISOString().slice(0, 10);
        return {
          date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          tastings: filteredTastings.filter(t => t.created_at.slice(0, 10) === dayStr).length,
          sales: filteredVentes.filter(v => v.created_at.slice(0, 10) === dayStr).length,
        };
      })
    : (() => {
        if (!customFrom || !customTo) return [];
        const days: { date: string; tastings: number; sales: number }[] = [];
        const start = new Date(customFrom);
        const end = new Date(customTo);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toISOString().slice(0, 10);
          days.push({
            date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
            tastings: filteredTastings.filter(t => t.created_at.slice(0, 10) === dayStr).length,
            sales: filteredVentes.filter(v => v.created_at.slice(0, 10) === dayStr).length,
          });
        }
        return days;
      })();

  const kpis = [
    {
      label: "Distributions totales",
      value: fmt(totalTastings),
      icon: <Beer className="w-6 h-6" />,
      sub: selectedCampaignId === "all" ? `${totalTastings} enregistrements` : "Sur cette campagne",
      iconBg: "bg-primary/8", iconColor: "text-primary",
    },
    {
      label: "Produits vendus",
      value: fmt(totalSales),
      icon: <Box className="w-6 h-6" />,
      sub: selectedCampaignId === "all" ? `${byProduct.length} produits enregistrés` : "Sur cette campagne",
      iconBg: "bg-cyan-50", iconColor: "text-cyan-700",
    },
    {
      label: "Goodies offerts aux clients",
      value: selectedCampaignId === "all" ? fmt(goodiesCampsCount) : fmt(mecaniquePromoTotaux.goodies),
      icon: <Gift className="w-6 h-6" />,
      sub: selectedCampaignId === "all" ? `${goodiesCampsCount} campagne(s)` : "Distribués sur cette campagne",
      iconBg: "bg-violet-50", iconColor: "text-violet-700",
    },
    {
      label: "Sites actifs",
      value: fmt(activeSitesCount),
      icon: <MapPin className="w-6 h-6" />,
      sub: selectedCampaignId === "all" ? `${campaigns.length} campagnes globales` : "PDV sur cette campagne",
      iconBg: "bg-emerald-50", iconColor: "text-emerald-700",
    },
  ];

  if (authLoading || loading) return <CompanySkeleton />;

  const p1 = entreprise?.couleur_primaire ?? "#006776";
  const p2 = entreprise?.couleur_secondaire ?? "#00899b";
  const companyName = entreprise?.nom_commercial ?? user?.name ?? "Mon Entreprise";
  const RED = p1;
  const AMBER = p2;
  const CHART_PALETTE = buildChartPalette(p1, p2, 5);
  const AGE_COLORS = CHART_PALETTE;
  const MECANIQUE_COLORS = { vendus: "#F59E0B", offerts: "#3B82F6", goodies: "#10B981", tirages: "#8B5CF6" };

  return (
    <div className="space-y-6">

      {/* ── Header avec Filtre de Campagne ── */}
      <PageHeader
        title={companyName}
        description="Tableau de bord entreprise"
        brandColor={p1}
        brandSecondary={p2}
        logoUrl={entreprise?.logo_url}
        icon={!entreprise?.logo_url ? <Building2 className="w-5 h-5" /> : undefined}
        ctaSlot={
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/10 p-2 rounded-xl border border-white/20 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-white/70" />
              <span className="text-xs font-semibold text-white/90 whitespace-nowrap">Campagne :</span>
            </div>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="h-9 w-56 text-xs bg-white text-slate-900 border-0 rounded-lg shadow-inner font-medium focus:ring-2 focus:ring-white/20">
                <SelectValue placeholder="Choisir une campagne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-end border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0 pl-0 sm:pl-2">
              {selectedCampaignId === "all" ? (
                campaigns.length > 0 && (
                  <Badge className="bg-white/20 text-white border-0 text-xs py-1 px-2.5">
                    {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
                  </Badge>
                )
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  <Badge className="bg-blue-500/40 text-white border-0 text-xs py-1 px-2">
                    <Clock className="w-3 h-3 mr-1" /> {campJoursEcoules}j écoulés
                  </Badge>
                  <Badge className="bg-emerald-500/40 text-white border-0 text-xs py-1 px-2">
                    <Calendar className="w-3 h-3 mr-1" /> {campJoursRestants}j restants
                  </Badge>
                  <Badge className="bg-amber-500/40 text-white border-0 text-xs py-1 px-2">
                    <MapPin className="w-3 h-3 mr-1" /> {selectedCampaign?.nb_sites ?? 0} PDV
                  </Badge>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* ── KPI cards (Placées juste en dessous de la barre de recherche / Header) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i}
            className="animate-fade-up bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`w-10 h-10 ${kpi.iconBg} rounded-xl flex items-center justify-center ${kpi.iconColor}`}>
                {kpi.icon}
              </div>
            </div>
            <div className="text-2xl font-black text-foreground tabular-nums tracking-tight">{kpi.value}</div>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">{kpi.label}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Mes campagnes (Toujours visible et non altéré par le filtre contextuel) ── */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">
            Mes campagnes
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map(camp => {
              const debut = new Date(camp.date_debut);
              const fin   = new Date(camp.date_fin);
              const isActive = fin >= today;
              const duree = Math.max(1, Math.floor((fin.getTime() - debut.getTime()) / 86400000));
              const ecoules = Math.max(0, Math.min(duree, Math.floor((today.getTime() - debut.getTime()) / 86400000)));
              const pct = Math.round((ecoules / duree) * 100);
              const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
              const objDeg = camp.objectif_degustations;
              const objVen = camp.objectif_ventes;
              const realDeg = tastings.filter(t => t.campagne_nom === camp.nom).length;
              const realVen = ventes.filter(v => v.campagne_nom === camp.nom).length;
              return (
                <div key={camp.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-base text-foreground leading-tight">{camp.nom}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtDate(debut)} → {fmtDate(fin)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive
                        ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs font-semibold text-emerald-600">Active</span></>
                        : <><AlertCircle className="w-4 h-4 text-slate-400" /><span className="text-xs font-semibold text-slate-400">Terminée</span></>}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{camp.type_campagne_display}</Badge>
                    <Badge variant="outline" className="text-xs">{camp.type_recompense_display}</Badge>
                    <Badge variant="outline" className="text-xs"><MapPin className="w-3 h-3 mr-1" />{camp.nb_sites} site{camp.nb_sites > 1 ? "s" : ""}</Badge>
                    <Badge variant="outline" className="text-xs"><Users className="w-3 h-3 mr-1" />{camp.nb_hotesses} hôtesse{camp.nb_hotesses > 1 ? "s" : ""}</Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Progression</span>
                      <span className="font-semibold text-foreground">{ecoules}j / {duree}j ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {(objDeg || objVen) && (
                    <div className="grid grid-cols-2 gap-3">
                      {objDeg != null && objDeg > 0 && (() => {
                        const stalled = isActive && ecoules >= 2 && realDeg === 0;
                        return (
                          <div className={cn("rounded-xl p-3 space-y-1", stalled ? "bg-rose-50 ring-1 ring-rose-300" : "bg-red-50")}>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Beer className="w-3 h-3" />Dégustations
                              {stalled && <AlertCircle className="w-3 h-3 text-rose-600 ml-auto" />}
                            </p>
                            <p className="font-bold text-sm text-red-700">{fmt(realDeg)} <span className="font-normal text-muted-foreground text-xs">/ {fmt(objDeg)}</span></p>
                            <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-400" style={{ width: `${Math.min(100, Math.round((realDeg / objDeg) * 100))}%` }} />
                            </div>
                            {stalled && <p className="text-[10px] text-rose-600 font-semibold">Aucune activité depuis {ecoules} jours</p>}
                          </div>
                        );
                      })()}
                      {objVen != null && objVen > 0 && (() => {
                        const stalled = isActive && ecoules >= 2 && realVen === 0;
                        return (
                          <div className={cn("rounded-xl p-3 space-y-1", stalled ? "bg-rose-50 ring-1 ring-rose-300" : "bg-amber-50")}>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <ShoppingCart className="w-3 h-3" />Ventes
                              {stalled && <AlertCircle className="w-3 h-3 text-rose-600 ml-auto" />}
                            </p>
                            <p className="font-bold text-sm text-amber-700">{fmt(realVen)} <span className="font-normal text-muted-foreground text-xs">/ {fmt(objVen)}</span></p>
                            <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: `${Math.min(100, Math.round((realVen / objVen) * 100))}%` }} />
                            </div>
                            {stalled && <p className="text-[10px] text-rose-600 font-semibold">Aucune activité depuis {ecoules} jours</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Progression journalière des distributions ── */}
      <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-50">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: hex(RED, 0.12) }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: RED }} />
              </div>
              Progression journalière des distributions
            </span>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="h-7 w-32 text-xs rounded-lg border-slate-200 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1">
                <RefreshCw className="w-3 h-3" />
                {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </CardTitle>
          {period === "custom" && (
            <div className="flex items-center gap-1.5 pt-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-muted-foreground" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-muted-foreground" />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {totalTastings === 0 && (
            <div className="flex flex-col items-center justify-center h-60 gap-3">
              <TrendingUp className="w-10 h-10 text-slate-200" />
              <p className="text-muted-foreground text-sm">Aucune distribution enregistrée pour le moment</p>
              <p className="text-muted-foreground text-xs">Les données apparaîtront dès la première activité</p>
            </div>
          )}
          {totalTastings > 0 && (
            <>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gTastingsCo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={RED} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={RED} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSalesCo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={AMBER} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="tastings" stroke={RED} strokeWidth={2.5}
                      fill="url(#gTastingsCo)" name="Distributions" dot={false}
                      activeDot={{ r: 5, fill: RED, stroke: "#fff", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="sales" stroke={AMBER} strokeWidth={2.5}
                      fill="url(#gSalesCo)" name="Ventes" dot={false}
                      activeDot={{ r: 5, fill: AMBER, stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-6 mt-2 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RED }} />
                  <span className="text-xs text-muted-foreground font-medium">Distributions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AMBER }} />
                  <span className="text-xs text-muted-foreground font-medium">Ventes</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Performance par site + Profil consommateurs ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
              </div>
              Performance par site
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bySite.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 gap-3">
                <MapPin className="w-10 h-10 text-slate-200" />
                <p className="text-muted-foreground text-sm">Aucune activité par site pour le moment</p>
                <p className="text-muted-foreground text-xs">Les données apparaîtront dès la première activité</p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySite} margin={{ top: 5, right: 10, bottom: 30, left: -20 }} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="zone" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="tastings" name="Distributions" fill={RED}  radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sales"    name="Ventes"       fill={AMBER} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-red-500" />
              </div>
              Profil consommateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byAge.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <Users className="w-10 h-10 text-slate-200" />
                <p className="text-muted-foreground text-sm text-center">Aucun profil consommateur</p>
                <p className="text-muted-foreground text-xs text-center">Les tranches d&apos;âge apparaîtront après les premières dégustations</p>
              </div>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byAge} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                        paddingAngle={4} dataKey="value" strokeWidth={0}>
                        {byAge.map((_, idx) => (
                          <Cell key={idx} fill={AGE_COLORS[idx % AGE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-1">
                  {byAge.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AGE_COLORS[i % AGE_COLORS.length] }} />
                      <span className="text-muted-foreground flex-1">{item.name}</span>
                      <span className="font-semibold">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Performance produits ── */}
      <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-50">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
              <Beer className="w-3.5 h-3.5 text-red-500" />
            </div>
            Performance produits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {byProduct.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <Beer className="w-8 h-8 text-slate-200" />
              <p className="text-muted-foreground text-sm">Aucune vente enregistrée pour le moment</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ventes par produit</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byProduct} margin={{ top: 5, right: 10, bottom: 30, left: -10 }} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                      <Bar dataKey="sales" name="Ventes" radius={[4, 4, 0, 0]}>
                        {byProduct.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? RED : AMBER} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Total CA contextuel</span>
                  <span className="text-base font-bold text-foreground">{fmtXOF(totalRevenue)}</span>
                </div>
              </div>

              {produitSiteOptions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Détail par site et par jour</p>
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {produitSiteOptions.map(nom => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setSelectedProduitSite(nom)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                          selectedProduitSite === nom
                            ? "text-white border-transparent"
                            : "bg-white text-muted-foreground border-slate-200 hover:bg-slate-50"
                        }`}
                        style={selectedProduitSite === nom ? { background: `linear-gradient(135deg, ${p1}, ${p2})` } : undefined}
                      >
                        {nom}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                      <p className="text-sm font-bold text-red-600">{fmt(produitSiteStats.totalVentes)}</p>
                      <p className="text-[10px] text-muted-foreground">ventes</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                      <p className="text-sm font-bold text-foreground">{fmtXOF(produitSiteStats.totalCA)}</p>
                      <p className="text-[10px] text-muted-foreground">CA</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                      <p className="text-sm font-bold text-foreground truncate">{produitSiteStats.topProduit}</p>
                      <p className="text-[10px] text-muted-foreground">produit phare</p>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={produitSiteDaily} margin={{ top: 5, right: 10, bottom: 0, left: -20 }} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                        {produitSiteStats.topNames.map((name, idx) => (
                          <Bar key={name} dataKey={name} name={name} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} radius={[3, 3, 0, 0]} />
                        ))}
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Objectifs par site/hôtesse ── */}
      {objectifs.length > 0 && (() => {
        const siteIds = [...new Set(objectifs.map(o => o.site))];
        return (
          <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-red-500" />
                </div>
                Objectifs par site / hôtesse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {siteIds.map(siteId => {
                const siteObj = objectifs.find(o => o.site === siteId);
                if (!siteObj) return null;
                const siteObjList = objectifs.filter(o => o.site === siteId);
                const siteTastings = filteredTastings.filter(t => t.site_nom === siteObj.site_nom).length;
                const siteSales    = filteredVentes.filter(v => v.site_nom === siteObj.site_nom).length;
                const totalObjDeg  = siteObjList.reduce((s, o) => s + o.objectif_degustations, 0);
                const totalObjVen  = siteObjList.reduce((s, o) => s + o.objectif_ventes, 0);
                const pctDeg = totalObjDeg > 0 ? Math.min(100, Math.round((siteTastings / totalObjDeg) * 100)) : 0;
                const pctVen = totalObjVen > 0 ? Math.min(100, Math.round((siteSales / totalObjVen) * 100)) : 0;
                return (
                  <div key={siteId} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{siteObj.site_nom}</p>
                        <p className="text-xs text-muted-foreground">{siteObjList.length} hôtesse{siteObjList.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    {totalObjDeg > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Dégustations</span>
                          <span className="font-semibold">{fmt(siteTastings)} <span className="text-muted-foreground font-normal">/ {fmt(totalObjDeg)}</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-red-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-400 transition-all duration-700" style={{ width: `${pctDeg}%` }} />
                        </div>
                        <p className="text-xs text-right text-red-600 font-medium">{pctDeg}%</p>
                      </div>
                    )}
                    {totalObjVen > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Ventes</span>
                          <span className="font-semibold">{fmt(siteSales)} <span className="text-muted-foreground font-normal">/ {fmt(totalObjVen)}</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700" style={{ width: `${pctVen}%` }} />
                        </div>
                        <p className="text-xs text-right text-amber-600 font-medium">{pctVen}%</p>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Détail par hôtesse</p>
                      <div className="space-y-1">
                        {siteObjList.map(o => (
                          <div key={o.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
                            <span className="font-medium truncate max-w-[45%]">{o.hotesse_nom}</span>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              {o.objectif_degustations > 0 && (
                                <span>🍷 obj. <strong className="text-foreground">{fmt(o.objectif_degustations)}</strong></span>
                              )}
                              {o.objectif_ventes > 0 && (
                                <span>🛒 obj. <strong className="text-foreground">{fmt(o.objectif_ventes)}</strong></span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Mécaniques Promotionnelles par site ── */}
      {mecaniquePromoSites.length > 0 && (
        <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                <Tag className="w-3.5 h-3.5 text-violet-500" />
              </div>
              Mécaniques Promotionnelles par site
              <span className="text-[11px] font-medium text-muted-foreground ml-auto">Filtre actif appliqué</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                <p className="text-xl font-bold" style={{ color: MECANIQUE_COLORS.vendus }}>{fmt(mecaniquePromoTotaux.vendus)}</p>
                <p className="text-[11px] text-muted-foreground">produits vendus</p>
              </div>
              {mecaniquePromoTotaux.offerts > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  <p className="text-xl font-bold" style={{ color: MECANIQUE_COLORS.offerts }}>{fmt(mecaniquePromoTotaux.offerts)}</p>
                  <p className="text-[11px] text-muted-foreground">produits offerts</p>
                </div>
              )}
              {mecaniquePromoTotaux.goodies > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  <p className="text-xl font-bold" style={{ color: MECANIQUE_COLORS.goodies }}>{fmt(mecaniquePromoTotaux.goodies)}</p>
                  <p className="text-[11px] text-muted-foreground">goodies distribués</p>
                </div>
              )}
              {mecaniquePromoTotaux.tirages > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  <p className="text-xl font-bold" style={{ color: MECANIQUE_COLORS.tirages }}>{fmt(mecaniquePromoTotaux.tirages)}</p>
                  <p className="text-[11px] text-muted-foreground">tirages effectués</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Écoulement par site</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mecaniquePromoSites} margin={{ top: 5, right: 10, bottom: 30, left: -10 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar key="vendus" dataKey="vendus" name="Produits vendus" fill={MECANIQUE_COLORS.vendus} radius={[4, 4, 0, 0]} />
                    {mecaniquePromoTotaux.offerts > 0 && <Bar key="offerts" dataKey="offerts" name="Produits offerts" fill={MECANIQUE_COLORS.offerts} radius={[4, 4, 0, 0]} />}
                    {mecaniquePromoTotaux.goodies > 0 && <Bar key="goodies" dataKey="goodies" name="Goodies distribués" fill={MECANIQUE_COLORS.goodies} radius={[4, 4, 0, 0]} />}
                    {mecaniquePromoTotaux.tirages > 0 && <Bar key="tirages" dataKey="tirages" name="Tirages" fill={MECANIQUE_COLORS.tirages} radius={[4, 4, 0, 0]} />}
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Détail par site et par jour</p>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {mecaniquePromoSites.map(s => (
                  <button
                    key={s.nom}
                    type="button"
                    onClick={() => setSelectedMecaniqueSite(s.nom)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      selectedMecaniqueSite === s.nom
                        ? "text-white border-transparent"
                        : "bg-white text-muted-foreground border-slate-200 hover:bg-slate-50"
                    }`}
                    style={selectedMecaniqueSite === s.nom ? { background: `linear-gradient(135deg, ${p1}, ${p2})` } : undefined}
                  >
                    {s.nom}
                  </button>
                ))}
              </div>
              {selectedMecaniqueSite && (() => {
                const s = mecaniquePromoSites.find(x => x.nom === selectedMecaniqueSite);
                if (!s) return null;
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                        <p className="text-sm font-bold" style={{ color: MECANIQUE_COLORS.vendus }}>{fmt(s.vendus)}</p>
                        <p className="text-[10px] text-muted-foreground">vendus</p>
                      </div>
                      {mecaniquePromoTotaux.offerts > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                          <p className="text-sm font-bold" style={{ color: MECANIQUE_COLORS.offerts }}>{fmt(s.offerts)}</p>
                          <p className="text-[10px] text-muted-foreground">offerts</p>
                        </div>
                      )}
                      {mecaniquePromoTotaux.goodies > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                          <p className="text-sm font-bold" style={{ color: MECANIQUE_COLORS.goodies }}>{fmt(s.goodies)}</p>
                          <p className="text-[10px] text-muted-foreground">goodies</p>
                        </div>
                      )}
                      {mecaniquePromoTotaux.tirages > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                          <p className="text-sm font-bold" style={{ color: MECANIQUE_COLORS.tirages }}>{fmt(s.tirages)}</p>
                          <p className="text-[10px] text-muted-foreground">tirages</p>
                        </div>
                      )}
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={mecaniqueSiteDaily} margin={{ top: 5, right: 10, bottom: 0, left: -20 }} barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                          <Bar key="vendus" dataKey="vendus" name="Vendus" fill={MECANIQUE_COLORS.vendus} radius={[3, 3, 0, 0]} />
                          {mecaniquePromoTotaux.offerts > 0 && <Bar key="offerts" dataKey="offerts" name="Offerts" fill={MECANIQUE_COLORS.offerts} radius={[3, 3, 0, 0]} />}
                          {mecaniquePromoTotaux.goodies > 0 && <Bar key="goodies" dataKey="goodies" name="Goodies" fill={MECANIQUE_COLORS.goodies} radius={[3, 3, 0, 0]} />}
                          {mecaniquePromoTotaux.tirages > 0 && <Bar key="tirages" dataKey="tirages" name="Tirages" fill={MECANIQUE_COLORS.tirages} radius={[3, 3, 0, 0]} />}
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dernières actions sur les sites ── */}
      {(filteredTastings.length > 0 || filteredVentes.length > 0 || filteredGainsPromotions.length > 0) && (() => {
        const campaignByName = new Map(campaigns.map(c => [c.nom, c]));
        const campaignById = new Map(campaigns.map(c => [c.id, c]));
        const defaultColor = p1;

        const actions = [
          ...filteredTastings.slice(-30).map(t => ({
            id: `deg-${t.id}`, emoji: "🍺", label: "Dégustation", date: t.created_at,
            site: t.site_nom, color: campaignByName.get(t.campagne_nom)?.couleur_primaire ?? defaultColor,
            campagne: t.campagne_nom,
          })),
          ...filteredVentes.slice(-30).map(v => ({
            id: `vente-${v.id}`, emoji: "🛒", label: "Vente", date: v.created_at,
            site: v.site_nom, color: campaignByName.get(v.campagne_nom)?.couleur_primaire ?? defaultColor,
            campagne: v.campagne_nom,
          })),
          ...filteredGainsPromotions.slice(-30).map(g => {
            const camp = campaignById.get(g.campagne);
            const emoji = g.type_promotion === "TIRAGE" ? "🎡" : g.type_promotion === "GAGNE" ? "🎁" : g.conditionnement === "PACK" ? "📦" : "🍾";
            const label = g.type_promotion === "TIRAGE" ? "Ticket tombola" : g.type_promotion === "GAGNE" ? "Goodie distribué" : g.conditionnement === "PACK" ? "Pack offert" : "Produit offert";
            return {
              id: `promo-${g.id}`, emoji, label, date: g.created_at,
              site: g.site_nom, color: camp?.couleur_primaire ?? defaultColor,
              campagne: camp?.nom ?? "",
            };
          }),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);

        const newestId = actions[0]?.id;
        const distinctCampaigns = [...new Set(actions.map(a => a.campagne).filter(Boolean))];
        const subtitle = distinctCampaigns.length === 0
          ? "Actions enregistrées en temps réel"
          : distinctCampaigns.length <= 2
            ? `Actions ${distinctCampaigns.join(" + ")} enregistrées en temps réel`
            : `Actions enregistrées en temps réel · ${distinctCampaigns.length} campagnes`;

        return (
          <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-50">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  Dernières actions
                </span>
                <Badge className="bg-slate-100 text-slate-600 border-0 text-xs font-normal">{actions.length} événements</Badge>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
                {actions.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                    <span className="text-base shrink-0">{a.emoji}</span>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="text-xs font-semibold truncate" style={{ color: a.color }}>{a.label}</p>
                      {a.id === newestId && (
                        <Badge className="text-[9px] border-0 shrink-0 bg-emerald-100 text-emerald-700">Nouveau</Badge>
                      )}
                    </div>
                    {a.campagne && (
                      <Badge className="text-[10px] border-0 shrink-0" style={{ background: hex(a.color, 0.12), color: a.color }}>
                        {a.campagne}
                      </Badge>
                    )}
                    <span className="text-[11px] font-medium whitespace-nowrap shrink-0" style={{ color: a.color }}>{a.site}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      {new Date(a.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Jauge Goodies distribués ── */}
      {filteredGoodiesTotal > 0 && (
        <Card className="relative border-0 shadow-lg shadow-slate-100 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-emerald-50 to-green-50 pointer-events-none" />
          <CardHeader className="pb-2 relative">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-teal-600" />
              Goodies distribués
            </CardTitle>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-4xl font-black text-teal-700">{fmt(filteredGoodiesDistribues)}</span>
                <span className="text-lg text-muted-foreground font-medium ml-2">/ {fmt(filteredGoodiesTotal)}</span>
              </div>
              <span className="text-2xl font-bold text-teal-600">
                {Math.round((filteredGoodiesDistribues / filteredGoodiesTotal) * 100)}%
              </span>
            </div>
            <div className="relative h-5 rounded-full bg-teal-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-green-400 transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.round((filteredGoodiesDistribues / filteredGoodiesTotal) * 100))}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-luminosity">
                {fmt(filteredGoodiesDistribues)} distribués sur {fmt(filteredGoodiesTotal)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/70 p-3 text-center border border-teal-100">
                <p className="text-xs text-muted-foreground">Total alloués</p>
                <p className="font-bold text-teal-700">{fmt(filteredGoodiesTotal)}</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center border border-teal-100">
                <p className="text-xs text-muted-foreground">Distribués</p>
                <p className="font-bold text-emerald-700">{fmt(filteredGoodiesDistribues)}</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center border border-teal-100">
                <p className="text-xs text-muted-foreground">Restants</p>
                <p className="font-bold text-slate-600">{fmt(filteredGoodiesTotal - filteredGoodiesDistribues)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompanySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}