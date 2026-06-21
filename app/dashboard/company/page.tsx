"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, CampagneRapportSites, CampagneSiteRapport, Degustation, Vente, VenteStats, SiteList, Entreprise, ObjectifSite } from "@/lib/types/backend";
import { getObjectifs } from "@/lib/services/objectifService";
import { getMyEntreprise } from "@/lib/services/entrepriseService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, Trophy, ShoppingCart, TrendingUp, Users,
  CalendarDays, MapPin, ArrowUp, Beer, Gift, Box, Clock, CheckCircle2, AlertCircle,
  Download, FileText, RefreshCw, Tag, Activity, Gauge,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const RED        = "#006776";
const AMBER      = "#00899b";
const PIE_COLORS = ["#006776", "#00899b", "#4db8c8", "#0d2d33", "#193f47"];
const AGE_COLORS = ["#006776", "#00899b", "#4db8c8", "#0d9488", "#0369a1"];

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}
function fmtXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, tastRes, ventesRes, statsRes, siteRes, ent, objData] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/").catch(() => ({ data: null })),
        api.get<SiteList[]>("/sites/"),
        getMyEntreprise(),
        getObjectifs().catch(() => [] as ObjectifSite[]),
      ]);
      const campList = Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []);
      setCampaigns(campList);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : ((tastRes.data as { results?: Degustation[] }).results ?? []));
      setVentes(Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: Vente[] }).results ?? []));
      setVenteStats(statsRes.data as VenteStats | null);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : ((siteRes.data as { results?: SiteList[] }).results ?? []));
      setEntreprise(ent);
      setObjectifs(objData);

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

  // Computed stats
  const totalTastings = tastings.length;
  const totalSales    = venteStats?.total_ventes ?? ventes.length;
  const totalRevenue  = ventes.reduce((s, v) => s + Number(v.prix_total ?? 0), 0);
  const conversionRate = totalTastings > 0 ? Math.round((totalSales / totalTastings) * 100) : 0;

  // Per-site breakdown
  const bySite = sites.map(site => ({
    zone: site.nom,
    tastings: tastings.filter(t => t.site_nom === site.nom).length,
    sales: ventes.filter(v => v.site_nom === site.nom).length,
  })).filter(s => s.tastings > 0 || s.sales > 0);

  // Per-product breakdown
  const prodMap = new Map<string, { sales: number; revenue: number }>();
  ventes.forEach(v => {
    const cur = prodMap.get(v.produit_nom) ?? { sales: 0, revenue: 0 };
    prodMap.set(v.produit_nom, { sales: cur.sales + 1, revenue: cur.revenue + Number(v.prix_total ?? 0) });
  });
  const byProduct = [...prodMap.entries()]
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // Per age breakdown
  const ageMap = new Map<string, number>();
  tastings.forEach(t => ageMap.set(t.tranche_age_display, (ageMap.get(t.tranche_age_display) ?? 0) + 1));
  const byAge = totalTastings > 0
    ? [...ageMap.entries()].map(([name, count]) => ({ name, value: Math.round((count / totalTastings) * 100) }))
    : [];

  // Campaign timing helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeCamps = campaigns.filter(c => new Date(c.date_fin) >= today);
  const campJoursEcoules = campaigns.length > 0
    ? Math.max(0, Math.floor((today.getTime() - new Date(campaigns[0].date_debut).getTime()) / 86400000))
    : 0;
  const campJoursRestants = activeCamps.length > 0
    ? Math.max(0, Math.floor((new Date(activeCamps[0].date_fin).getTime() - today.getTime()) / 86400000))
    : 0;

  // Per-day chart (last 14 days)
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const dayStr = d.toISOString().slice(0, 10);
    return {
      date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      tastings: tastings.filter(t => t.created_at.slice(0, 10) === dayStr).length,
      sales: ventes.filter(v => v.created_at.slice(0, 10) === dayStr).length,
    };
  });

  const kpis = [
    {
      label: "Distributions totales",
      value: fmt(totalTastings),
      icon: <Beer className="w-6 h-6" />,
      sub: `${totalTastings} enregistrements`,
      iconBg: "bg-primary/8", iconColor: "text-primary",
    },
    {
      label: "Produits vendus",
      value: fmt(byProduct.reduce((s, p) => s + p.sales, 0)),
      icon: <Box className="w-6 h-6" />,
      sub: `${byProduct.length} produits`,
      iconBg: "bg-cyan-50", iconColor: "text-cyan-700",
    },
    {
      label: "Campagnes goodies",
      value: fmt(goodiesCampsCount),
      icon: <Gift className="w-6 h-6" />,
      sub: `${goodiesCampsCount} campagne${goodiesCampsCount > 1 ? "s" : ""}`,
      iconBg: "bg-violet-50", iconColor: "text-violet-700",
    },
    {
      label: "Sites actifs",
      value: fmt(sites.length),
      icon: <MapPin className="w-6 h-6" />,
      sub: `${campaigns.length} campagne${campaigns.length > 1 ? "s" : ""}`,
      iconBg: "bg-emerald-50", iconColor: "text-emerald-700",
    },
    ...(goodiesTotal > 0 ? [{
      label: "Goodies distribués",
      value: `${fmt(goodiesDistribues)}/${fmt(goodiesTotal)}`,
      icon: <Gift className="w-6 h-6" />,
      sub: `${goodiesTotal > 0 ? Math.round((goodiesDistribues / goodiesTotal) * 100) : 0}% écoulés`,
      iconBg: "bg-teal-50", iconColor: "text-teal-700",
    }] : []),
  ];

  if (authLoading || loading) return <CompanySkeleton />;

  const p1 = entreprise?.couleur_primaire ?? "#006776";
  const p2 = entreprise?.couleur_secondaire ?? "#00899b";
  const brandGrad = `linear-gradient(135deg, ${p1} 0%, ${p2} 100%)`;
  const companyName = entreprise?.nom_commercial ?? user?.name ?? "Mon Entreprise";

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-2xl animate-fade-up"
        style={{ background: brandGrad, boxShadow: `0 25px 50px -12px ${hex(p1, 0.35)}` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('/mediapuzzle.jpg')] bg-cover opacity-5" />
        <div className="absolute -right-8 -top-8 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-20 -bottom-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            {entreprise?.logo_url ? (
              <img
                src={entreprise.logo_url}
                alt={companyName}
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-contain bg-white p-2 border border-white/30 shadow-xl shrink-0"
              />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl shrink-0">
                <span className="font-black text-xl leading-none text-center px-1" style={{ color: p1 }}>
                  {initials(companyName)}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/25 text-white border-white/40 text-xs backdrop-blur-sm">
                  Entreprise
                </Badge>
                {campaigns.length > 0 && (
                  <Badge className="bg-green-400/30 text-white border-green-300/40 text-xs backdrop-blur-sm">
                    {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight">{companyName}</h1>
              <p className="text-white/80 text-sm mt-0.5">Tableau de bord entreprise</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: <Clock className="w-4 h-4 text-white/60" />, value: campJoursEcoules, label: "Jours écoulés" },
              { icon: <CalendarDays className="w-4 h-4 text-white/60" />, value: campJoursRestants, label: "Jours restants" },
              { icon: <MapPin className="w-4 h-4 text-white/60" />, value: sites.length, label: "Sites actifs" },
              { icon: <Target className="w-4 h-4 text-white/60" />, value: campaigns.length, label: "Campagnes" },
            ].map((s, i) => (
              <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-3 text-center border border-white/10">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="font-black text-xl tabular-nums">{s.value}</p>
                <p className="text-white/65 text-[11px] font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mes campagnes ── */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Mes campagnes</h2>
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
                      {objDeg != null && objDeg > 0 && (
                        <div className="rounded-xl bg-red-50 p-3 space-y-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Beer className="w-3 h-3" />Dégustations</p>
                          <p className="font-bold text-sm text-red-700">{fmt(realDeg)} <span className="font-normal text-muted-foreground text-xs">/ {fmt(objDeg)}</span></p>
                          <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-400" style={{ width: `${Math.min(100, Math.round((realDeg / objDeg) * 100))}%` }} />
                          </div>
                        </div>
                      )}
                      {objVen != null && objVen > 0 && (
                        <div className="rounded-xl bg-amber-50 p-3 space-y-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingCart className="w-3 h-3" />Ventes</p>
                          <p className="font-bold text-sm text-amber-700">{fmt(realVen)} <span className="font-normal text-muted-foreground text-xs">/ {fmt(objVen)}</span></p>
                          <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: `${Math.min(100, Math.round((realVen / objVen) * 100))}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KPI cards ── */}
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

      {/* ── Progression journalière des distributions ── */}
      <Card className="border-0 shadow-md rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        <CardHeader className="pb-2 border-b border-white/5">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              Progression journalière des distributions
            </span>
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1">
              <RefreshCw className="w-3 h-3" />
              {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalTastings === 0 && (
            <div className="flex flex-col items-center justify-center h-60 gap-3">
              <TrendingUp className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm">Aucune distribution enregistrée pour le moment</p>
              <p className="text-slate-500 text-xs">Les données apparaîtront dès la première activité</p>
            </div>
          )}
          {totalTastings > 0 && (
            <>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="gTastingsCo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSalesCo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={AMBER} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="tastings" stroke="#06b6d4" strokeWidth={2.5}
                      fill="url(#gTastingsCo)" name="Distributions" dot={false}
                      activeDot={{ r: 5, fill: "#06b6d4", stroke: "#fff", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="sales" stroke={AMBER} strokeWidth={2.5}
                      fill="url(#gSalesCo)" name="Ventes" dot={false}
                      activeDot={{ r: 5, fill: AMBER, stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-6 mt-2 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-xs text-slate-400 font-medium">Distributions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AMBER }} />
                  <span className="text-xs text-slate-400 font-medium">Ventes</span>
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
        <CardContent>
          {byProduct.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <Beer className="w-8 h-8 text-slate-200" />
              <p className="text-muted-foreground text-sm">Aucune vente enregistrée pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {byProduct.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground truncate max-w-[55%]">{p.name}</span>
                    <span className="text-sm font-bold text-red-600">{fmt(p.sales)} vente{p.sales > 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.round((p.sales / (byProduct[0].sales || 1)) * 100)}%`, background: i === 0 ? RED : AMBER }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtXOF(p.revenue)}</p>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Total CA</span>
                <span className="text-base font-bold text-foreground">{fmtXOF(totalRevenue)}</span>
              </div>
            </div>
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
                const siteTastings = tastings.filter(t => t.site_nom === siteObj.site_nom).length;
                const siteSales    = ventes.filter(v => v.site_nom === siteObj.site_nom).length;
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
      {rapports.some(r => r.sites?.some(s => (s.promotions_stats?.length ?? 0) > 0)) && (
        <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                <Tag className="w-3.5 h-3.5 text-violet-500" />
              </div>
              Mécaniques Promotionnelles par site
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rapports.map(rapport =>
              rapport.sites
                ?.filter(s => (s.promotions_stats?.length ?? 0) > 0)
                .map(site => (
                  <div key={site.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-violet-500" />
                      <p className="font-semibold text-sm">{site.nom}</p>
                      <Badge className="bg-violet-100 text-violet-700 border-0 text-xs ml-auto">{rapport.campagne_nom}</Badge>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {site.promotions_stats!.map((ps, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 border border-violet-100 space-y-1">
                          <p className="text-xs font-semibold text-violet-700 truncate">{ps.recompense_description}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Seuil : <strong className="text-foreground">{ps.quantite_requise}</strong></span>
                            <span>Gains : <strong className="text-violet-600">{ps.gains_count}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dernières actions sur les sites ── */}
      {(tastings.length > 0 || ventes.length > 0) && (() => {
        const actions = [
          ...tastings.slice(-20).map(t => ({
            id: t.id, type: "dist" as const,
            label: `Distribution — ${t.produit_nom}`,
            sub: `${t.site_nom} · ${t.hotesse_nom}`,
            date: t.created_at,
          })),
          ...ventes.slice(-20).map(v => ({
            id: v.id, type: "vente" as const,
            label: `Vente — ${v.produit_nom}`,
            sub: `${v.site_nom} · ${v.hotesse_nom}`,
            date: v.created_at,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);
        return (
          <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                Dernières actions sur les sites
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      a.type === "dist" ? "bg-cyan-50 border border-cyan-100" : "bg-amber-50 border border-amber-100"
                    }`}>
                      {a.type === "dist"
                        ? <Beer className="w-3.5 h-3.5 text-cyan-600" />
                        : <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.sub}</p>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap shrink-0 bg-slate-100 rounded-md px-2 py-0.5">
                      {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Jauge Goodies distribués ── */}
      {goodiesTotal > 0 && (
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
                <span className="text-4xl font-black text-teal-700">{fmt(goodiesDistribues)}</span>
                <span className="text-lg text-muted-foreground font-medium ml-2">/ {fmt(goodiesTotal)}</span>
              </div>
              <span className="text-2xl font-bold text-teal-600">
                {Math.round((goodiesDistribues / goodiesTotal) * 100)}%
              </span>
            </div>
            <div className="relative h-5 rounded-full bg-teal-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-green-400 transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.round((goodiesDistribues / goodiesTotal) * 100))}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-luminosity">
                {fmt(goodiesDistribues)} distribués sur {fmt(goodiesTotal)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/70 p-3 text-center border border-teal-100">
                <p className="text-xs text-muted-foreground">Total alloués</p>
                <p className="font-bold text-teal-700">{fmt(goodiesTotal)}</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center border border-teal-100">
                <p className="text-xs text-muted-foreground">Distribués</p>
                <p className="font-bold text-emerald-700">{fmt(goodiesDistribues)}</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3 text-center border border-teal-100">
                <p className="text-xs text-muted-foreground">Restants</p>
                <p className="font-bold text-slate-600">{fmt(goodiesTotal - goodiesDistribues)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Télécharger les rapports ── */}
      {campaigns.length > 0 && (
        <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                </div>
                Télécharger les rapports
              </span>
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1">
                <RefreshCw className="w-3 h-3" />
                Mis à jour {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {campaigns.map(camp => {
                const fin = new Date(camp.date_fin);
                const isFinished = fin < today;
                return (
                  <div key={camp.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    <div>
                      <p className="font-semibold text-sm truncate">{camp.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(camp.date_debut).toLocaleDateString("fr-FR")} → {fin.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/campagnes/${camp.id}/rapport-sites/`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Rapport intermédiaire
                      </a>
                      {isFinished && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/campagnes/${camp.id}/rapport-sites/?format=pdf`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Rapport final PDF
                        </a>
                      )}
                      {!isFinished && (
                        <span className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-medium py-2 px-3 cursor-not-allowed">
                          <FileText className="w-3.5 h-3.5" />
                          PDF fin de camp.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
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
