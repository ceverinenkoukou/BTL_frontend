"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, CampagneRapportSites, Degustation, Vente, VenteStats, SiteList, Entreprise } from "@/lib/types/backend";
import { getMyEntreprise } from "@/lib/services/entrepriseService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, Trophy, ShoppingCart, TrendingUp, Users,
  CalendarDays, MapPin, ArrowUp, Beer, Gift,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const RED        = "#DC2626";
const AMBER      = "#F59E0B";
const PIE_COLORS = [RED, AMBER, "#3B82F6", "#8B5CF6", "#06B6D4"];
const AGE_COLORS = ["#f97316", "#a855f7", "#06b6d4", "#10b981", "#f43f5e"];

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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, tastRes, ventesRes, statsRes, siteRes, ent] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/").catch(() => ({ data: null })),
        api.get<SiteList[]>("/sites/"),
        getMyEntreprise(),
      ]);
      const campList = Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []);
      setCampaigns(campList);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : ((tastRes.data as { results?: Degustation[] }).results ?? []));
      setVentes(Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: Vente[] }).results ?? []));
      setVenteStats(statsRes.data as VenteStats | null);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : ((siteRes.data as { results?: SiteList[] }).results ?? []));
      setEntreprise(ent);

      // Fetch goodies stats for campaigns with goodies
      const goodiesCamps = campList.filter(c => c.type_recompense === "GOODIES");
      if (goodiesCamps.length > 0) {
        const rapports = await Promise.all(
          goodiesCamps.map(c =>
            api.get<CampagneRapportSites>(`/campagnes/${c.id}/rapport-sites/`).catch(() => null)
          )
        );
        let totalAlloue = 0;
        let totalDistribue = 0;
        rapports.forEach(r => {
          if (!r?.data) return;
          totalDistribue += r.data.totaux?.goodies_distribues ?? 0;
          r.data.sites?.forEach(site => {
            (site.goodies ?? []).forEach(g => { totalAlloue += g.quantite_initiale; });
          });
        });
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
      label: "Dégustations totales",
      value: fmt(totalTastings),
      icon: <Beer className="w-6 h-6" />,
      trend: `${totalTastings} enreg.`,
      gradient: "from-red-600 via-red-500 to-orange-400",
      shadow: "shadow-red-300/50",
    },
    {
      label: "Ventes réalisées",
      value: fmt(totalSales),
      icon: <ShoppingCart className="w-6 h-6" />,
      trend: `${conversionRate}% conv.`,
      gradient: "from-amber-500 via-orange-500 to-yellow-400",
      shadow: "shadow-amber-300/50",
    },
    {
      label: "Chiffre d'affaires",
      value: fmtXOF(totalRevenue),
      icon: <TrendingUp className="w-6 h-6" />,
      trend: `${ventes.length} trans.`,
      gradient: "from-emerald-600 via-green-500 to-teal-400",
      shadow: "shadow-emerald-300/50",
    },
    {
      label: "Sites actifs",
      value: fmt(sites.length),
      icon: <MapPin className="w-6 h-6" />,
      trend: `${campaigns.length} camp.`,
      gradient: "from-violet-600 via-purple-500 to-fuchsia-400",
      shadow: "shadow-violet-300/50",
    },
    ...(goodiesTotal > 0 ? [{
      label: "Goodies distribués",
      value: `${fmt(goodiesDistribues)} / ${fmt(goodiesTotal)}`,
      icon: <Gift className="w-6 h-6" />,
      trend: `${goodiesTotal > 0 ? Math.round((goodiesDistribues / goodiesTotal) * 100) : 0}% écoulés`,
      gradient: "from-teal-600 via-emerald-500 to-green-400",
      shadow: "shadow-teal-300/50",
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
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-2xl"
        style={{ background: brandGrad, boxShadow: `0 25px 50px -12px ${hex(p1, 0.35)}` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
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

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-3 text-center">
              <Target className="w-4 h-4 text-white/70 mx-auto mb-1" />
              <p className="font-bold text-lg">{campaigns.length}</p>
              <p className="text-white/70 text-xs">Campagnes</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-3 text-center">
              <MapPin className="w-4 h-4 text-white/70 mx-auto mb-1" />
              <p className="font-bold text-lg">{sites.length}</p>
              <p className="text-white/70 text-xs">Sites</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-3 text-center">
              <TrendingUp className="w-4 h-4 text-white/70 mx-auto mb-1" />
              <p className="font-bold text-lg">{conversionRate}%</p>
              <p className="text-white/70 text-xs">Conversion</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${kpi.gradient} p-5 text-white shadow-xl ${kpi.shadow} hover:-translate-y-1.5 hover:shadow-2xl transition-all duration-300 cursor-default`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.08),transparent)]" />
            <div className="absolute -right-3 -bottom-3 w-20 h-20 rounded-full bg-white/10 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  {kpi.icon}
                </div>
                <span className="flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full bg-white/25">
                  <ArrowUp className="w-3 h-3" />{kpi.trend}
                </span>
              </div>
              <div className="text-2xl font-bold tracking-tight leading-tight">{kpi.value}</div>
              <p className="text-white/80 text-xs mt-1 font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Daily chart ── */}
      {totalTastings > 0 && (
        <Card className="border-0 shadow-lg shadow-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-500" />
              Progression des 14 derniers jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
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
                  <Area type="monotone" dataKey="tastings" stroke={RED} strokeWidth={3}
                    fill="url(#gTastingsCo)" name="Dégustations" dot={false}
                    activeDot={{ r: 6, fill: RED, stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="sales" stroke={AMBER} strokeWidth={3}
                    fill="url(#gSalesCo)" name="Ventes" dot={false}
                    activeDot={{ r: 6, fill: AMBER, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-2 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RED }} />
                <span className="text-xs text-muted-foreground font-medium">Dégustations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: AMBER }} />
                <span className="text-xs text-muted-foreground font-medium">Ventes</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Site breakdown + Age pie ── */}
      {(bySite.length > 0 || byAge.length > 0) && (
        <div className="grid lg:grid-cols-3 gap-6">
          {bySite.length > 0 && (
            <Card className="lg:col-span-2 border-0 shadow-lg shadow-slate-100 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  Performance par site
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySite} margin={{ top: 5, right: 10, bottom: 30, left: -20 }} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                      <XAxis dataKey="zone" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false}
                        angle={-20} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                      <Bar dataKey="tastings" name="Dégustations" fill={RED}  radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sales"    name="Ventes"       fill={AMBER} radius={[4, 4, 0, 0]} />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {byAge.length > 0 && (
            <Card className="border-0 shadow-lg shadow-slate-100 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-500" />
                  Tranches d&apos;âge
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Product performance + Conversion KPI ── */}
      <div className="grid md:grid-cols-2 gap-6">
        {byProduct.length > 0 && (
          <Card className="border-0 shadow-lg shadow-slate-100 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Beer className="w-4 h-4 text-red-500" />
                Performance produits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {byProduct.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground truncate max-w-[55%]">{p.name}</span>
                    <span className="text-sm font-bold text-red-600">{fmt(p.sales)} vente{p.sales > 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round((p.sales / (byProduct[0].sales || 1)) * 100)}%`,
                        background: i === 0 ? RED : AMBER,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtXOF(p.revenue)}</p>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Total CA</span>
                <span className="text-base font-bold text-foreground">{fmtXOF(totalRevenue)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-lg shadow-slate-100 rounded-2xl overflow-hidden bg-gradient-to-br from-red-50 via-rose-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Taux de conversion</p>
                <div className="text-5xl font-bold mt-1 text-red-600">{conversionRate}%</div>
                <p className="text-sm text-muted-foreground mt-1">dégustations → achats</p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-red-300">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Objectif 50%</span>
                <span className="font-semibold text-red-600 flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />{conversionRate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-red-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-orange-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(conversionRate * 2, 100)}%` }}
                />
              </div>
            </div>

            {totalTastings === 0 && (
              <div className="mt-6 text-center py-6">
                <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune donnée pour le moment.</p>
                <p className="text-xs text-muted-foreground mt-1">Les statistiques apparaîtront dès les premières dégustations.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Sites list ── */}
      {sites.length > 0 && (
        <Card className="border-0 shadow-lg shadow-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" />
              Sites de vos campagnes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sites.map(site => {
                const siteTastings = tastings.filter(t => t.site_nom === site.nom).length;
                const siteSales = ventes.filter(v => v.site_nom === site.nom).length;
                return (
                  <div key={site.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-foreground leading-tight">{site.nom}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{site.campagne_nom}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs shrink-0">Actif</Badge>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 bg-white rounded-lg p-2 text-center border border-slate-100">
                        <p className="text-xs text-muted-foreground">Dégust.</p>
                        <p className="font-bold text-red-600 text-sm">{fmt(siteTastings)}</p>
                      </div>
                      <div className="flex-1 bg-white rounded-lg p-2 text-center border border-slate-100">
                        <p className="text-xs text-muted-foreground">Ventes</p>
                        <p className="font-bold text-amber-600 text-sm">{fmt(siteSales)}</p>
                      </div>
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
