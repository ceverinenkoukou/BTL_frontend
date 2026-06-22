"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { CampagneList, Degustation, Vente, VenteStats, RemoteUser, GainGoodie, TypeCampagne, TypeRecompense } from "@/lib/types/backend";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, UtensilsCrossed, ShoppingCart, TrendingUp,
  Users, ArrowUp, Sparkles, Star, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ─── Simplified role hero config (hero only — cards use brand palette) ────────
const ROLE_HERO: Record<string, { bg: string; shadow: string }> = {
  Administrateur: { bg: "from-slate-800 via-slate-700 to-slate-600",   shadow: "shadow-slate-400/30" },
  Superviseur:    { bg: "from-[#004d5c] via-[#006776] to-[#00899b]",   shadow: "shadow-teal-400/30" },
  Hotesse:        { bg: "from-[#3b1f6e] via-[#5b3a8c] to-[#7c5cbf]",  shadow: "shadow-violet-400/30" },
  default:        { bg: "from-[#004d5c] via-[#006776] to-[#00899b]",   shadow: "shadow-teal-400/30" },
};

// Brand chart colors — consistent across all roles
const CHART_COLORS = { c1: "#006776", c2: "#00899b", pie: ["#006776", "#00899b", "#4db8c8", "#0d2d33"] };

// Stat card accent per position (calm, consistent)
const STAT_ACCENTS = [
  { iconBg: "bg-primary/8",   iconColor: "text-primary",     dot: "bg-primary" },
  { iconBg: "bg-cyan-50",     iconColor: "text-cyan-700",     dot: "bg-cyan-500" },
  { iconBg: "bg-emerald-50",  iconColor: "text-emerald-700",  dot: "bg-emerald-500" },
  { iconBg: "bg-slate-100",   iconColor: "text-slate-600",    dot: "bg-slate-400" },
];


interface DashboardStats {
  activeCampaigns: number;
  totalTastings: number;
  totalSales: number;
  conversionRate: number;
  totalRevenue: number;
  teamMembers: number;
}

interface UnderperformingCampaign {
  id: string;
  name: string;
  company: string;
  status: string;
  type_campagne: TypeCampagne;
  type_recompense: TypeRecompense;
  tastings: number;
  tastingObjective: number;
  tastingPct: number;
  sales: number;
  salesObjective: number;
  salesPct: number;
  goodies: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; tastings: number; sales: number }[]>([]);
  const [underperformers, setUnderperformers] = useState<UnderperformingCampaign[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [teamBreakdown, setTeamBreakdown] = useState({ hotesses: 0, superviseurs: 0, activityRate: 0 });
  const [showTastingsLine, setShowTastingsLine] = useState(true);
  const [loading, setLoading] = useState(true);

  const role = user?.role ?? "default";
  const hero = ROLE_HERO[role] ?? ROLE_HERO.default;

  useEffect(() => { fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [campRes, tastRes, ventesRes, statsRes, usersRes, gainsRes] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/").catch(() => ({ data: null })),
        api.get<RemoteUser[]>("/users/terrain-staff/").catch(() => ({ data: [] })),
        api.get<GainGoodie[]>("/gains-goodies/").catch(() => ({ data: [] })),
      ]);

      const campaigns: CampagneList[] = Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []);
      const tastingsArray = Array.isArray(tastRes.data) ? tastRes.data : [];
      const ventesArray = Array.isArray(ventesRes.data) ? ventesRes.data : [];
      const venteStats = statsRes.data as VenteStats | null;
      const teamMembers = Array.isArray(usersRes.data) ? (usersRes.data as RemoteUser[]) : [];
      const gainsArray = Array.isArray(gainsRes.data) ? (gainsRes.data as GainGoodie[]) : [];

      const totalRev = ventesArray.reduce((s, x) => s + Number(x.prix_total ?? 0), 0);
      const totalSales = venteStats?.total_ventes ?? ventesArray.length;
      const tastingsCount = tastingsArray.length;

      setStats({
        activeCampaigns: campaigns.length,
        totalTastings: tastingsCount,
        totalSales,
        conversionRate: tastingsCount > 0 ? Math.round((totalSales / tastingsCount) * 1000) / 10 : 0,
        totalRevenue: totalRev,
        teamMembers: teamMembers.length,
      });

      // Build per-day activity for the last 7 days
      // Exclude tastings from pure VENTE campaigns (they use ventes as primary metric)
      const venteCampNames = new Set(campaigns.filter(c => c.type_campagne === "VENTE").map(c => c.nom));
      const tastingsForChart = tastingsArray.filter(t => !venteCampNames.has(t.campagne_nom));
      const hasTastingCampaigns = campaigns.some(c => c.type_campagne !== "VENTE");
      setShowTastingsLine(hasTastingCampaigns);

      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const dayStr = d.toISOString().slice(0, 10);
        return {
          date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
          tastings: tastingsForChart.filter(t => t.created_at.slice(0, 10) === dayStr).length,
          sales: ventesArray.filter(v => v.created_at.slice(0, 10) === dayStr).length,
        };
      });
      setChartData(days);

      // Underperformers: campaigns with no activity
      const campTastingMap = new Map<string, number>();
      tastingsArray.forEach(t => campTastingMap.set(t.campagne_nom, (campTastingMap.get(t.campagne_nom) ?? 0) + 1));
      const campSaleMap = new Map<string, number>();
      ventesArray.forEach(v => campSaleMap.set(v.campagne_nom, (campSaleMap.get(v.campagne_nom) ?? 0) + 1));
      const campGoodieMap = new Map<string, number>();
      gainsArray.forEach(g => campGoodieMap.set(g.campagne_nom, (campGoodieMap.get(g.campagne_nom) ?? 0) + 1));

      const up: UnderperformingCampaign[] = campaigns.map(c => {
        const t = campTastingMap.get(c.nom) ?? 0;
        const s = campSaleMap.get(c.nom) ?? 0;
        const g = campGoodieMap.get(c.nom) ?? 0;
        const tPct = t > 0 ? 100 : 0;
        const sPct = c.type_campagne === "VENTE"
          ? (s > 0 ? 100 : 0)
          : (t > 0 ? Math.round((s / t) * 100) : 0);
        const now = new Date();
        const status = new Date(c.date_debut) > now ? "planned"
          : new Date(c.date_fin) < now ? "ended"
          : "active";
        return {
          id: c.id, name: c.nom, company: c.entreprise_nom,
          status,
          type_campagne: c.type_campagne,
          type_recompense: c.type_recompense,
          tastings: t, tastingObjective: 0, tastingPct: tPct,
          sales: s, salesObjective: 0, salesPct: sPct,
          goodies: g,
        };
      }).filter(x => {
        if (x.type_campagne === "VENTE") return x.sales === 0 && x.goodies === 0;
        return x.tastings === 0;
      });
      setUnderperformers(up);

      // Répartition des ventes par produit (top 4 + Autres)
      const productMap: Record<string, number> = {};
      ventesArray.forEach(v => { productMap[v.produit_nom] = (productMap[v.produit_nom] ?? 0) + 1; });
      const totalVentes = ventesArray.length;
      if (totalVentes > 0) {
        const sorted = Object.entries(productMap).sort((a, b) => b[1] - a[1]);
        const top4 = sorted.slice(0, 4);
        const rest = sorted.slice(4).reduce((sum, [, cnt]) => sum + cnt, 0);
        const items = top4.map(([name, cnt]) => ({ name, value: Math.round((cnt / totalVentes) * 100) }));
        if (rest > 0) items.push({ name: "Autres", value: Math.round((rest / totalVentes) * 100) });
        setPieData(items);
      } else {
        setPieData([]);
      }

      // Équipe active : répartition hôtesses / superviseurs + taux d'activité
      const hotessesCount = teamMembers.filter(u => u.role === "Hotesse").length;
      const superviseursCount = teamMembers.filter(u => u.role === "Superviseur").length;
      const activeNames = new Set([
        ...tastingsArray.map(t => t.hotesse_nom),
        ...ventesArray.map(v => v.hotesse_nom),
      ]);
      const activeCount = teamMembers.filter(u => activeNames.has(u.name)).length;
      const activityRate = teamMembers.length > 0 ? Math.round((activeCount / teamMembers.length) * 100) : 0;
      setTeamBreakdown({ hotesses: hotessesCount, superviseurs: superviseursCount, activityRate });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const roleLabels: Record<string, string> = {
    Administrateur: "Administrateur", Superviseur: "Superviseur",
    Hotesse: "Hôtesse", Entreprise: "Entreprise",
  };
  const roleEmoji: Record<string, string> = {
    Administrateur: "🛡️", Superviseur: "👁️", Hotesse: "💃", Entreprise: "�",
  };

  const statCards = [
    { title: "Campagnes actives",    value: stats?.activeCampaigns ?? 0, icon: <Target className="w-6 h-6" />,        trend: "+2",    trendUp: true },
    { title: "Dégustations",         value: stats?.totalTastings ?? 0,   icon: <UtensilsCrossed className="w-6 h-6" />,trend: "+12%",  trendUp: true },
    { title: "Ventes",               value: stats?.totalSales ?? 0,      icon: <ShoppingCart className="w-6 h-6" />,   trend: "+8%",   trendUp: true },
    // { title: "Taux de conversion",   value: `${stats?.conversionRate ?? 0}%`, icon: <TrendingUp className="w-6 h-6" />,trend: "+2.5%", trendUp: true },
  ];

  const tooltipStyle = {
    backgroundColor: "white", border: "none",
    borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", fontSize: "12px",
  };

  const g1 = "gT_dash";
  const g2 = "gS_dash";

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">

      {/* ── Hero banner ── */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${hero.bg} p-6 md:p-7 text-white ${hero.shadow} animate-fade-up`}>
        <div className="absolute inset-0 bg-[url('/mediapuzzle.jpg')] bg-cover opacity-[0.04]" />
        <div className="absolute right-0 inset-y-0 w-1/3 bg-gradient-to-l from-white/5 to-transparent" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">
              {roleLabels[role] ?? role}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              Bonjour, {user?.name?.split(" ")[0] ?? "Utilisateur"}
            </h1>
            <p className="text-white/55 mt-1.5 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-white/10 border border-white/10 rounded-xl px-4 py-3 w-fit">
            <Star className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
            <div>
              <p className="text-[11px] text-white/50 font-medium">Performance globale</p>
              <p className="font-bold text-sm text-white">Excellent</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => {
          const acc = STAT_ACCENTS[i] ?? STAT_ACCENTS[0];
          return (
            <div key={i}
              className={`animate-fade-up bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md hover:border-slate-150 transition-all duration-200 cursor-default`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-10 h-10 ${acc.iconBg} rounded-xl flex items-center justify-center ${acc.iconColor}`}>
                  {card.icon}
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
                  <ArrowUp className="w-3 h-3" />{card.trend}
                </span>
              </div>
              <div className="text-3xl font-black text-foreground tabular-nums tracking-tight">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">{card.title}</p>
            </div>
          );
        })}
      </div>

      {/* ── Underperforming campaigns (admin + supervisor only) ── */}
      {(role === "Administrateur" || role === "Superviseur") && underperformers.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Campagnes en retard sur objectifs</h2>
              <p className="text-xs text-muted-foreground">{underperformers.length} campagne{underperformers.length > 1 ? "s" : ""} n&apos;ont pas atteint leurs objectifs</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {underperformers.map(c => (
              <div key={c.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.company}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    c.status === "active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {c.status === "active" ? "Active" : "Planifiée"}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Goodies distribués (si type_recompense = GOODIES) */}
                  {c.type_recompense === "GOODIES" && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Star className="w-3 h-3" /> Goodies distribués
                        </span>
                        <span className="text-xs font-bold">
                          <span className={c.goodies === 0 ? "text-rose-600" : "text-lime-600"}>{c.goodies}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${c.goodies === 0 ? "bg-rose-400" : "bg-lime-400"}`}
                          style={{ width: c.goodies > 0 ? "100%" : "0%" }} />
                      </div>
                      <p className={`text-xs mt-0.5 font-semibold ${c.goodies === 0 ? "text-rose-500" : "text-lime-600"}`}>
                        {c.goodies === 0 ? "Aucun" : `${c.goodies} unité${c.goodies > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  )}
                  {/* Distributions / Dégustations — masqué pour les campagnes VENTE */}
                  {c.type_campagne !== "VENTE" && c.type_recompense !== "GOODIES" && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <UtensilsCrossed className="w-3 h-3" /> Distributions
                        </span>
                        <span className="text-xs font-bold">
                          <span className={c.tastingPct < 30 ? "text-rose-600" : c.tastingPct < 70 ? "text-amber-600" : "text-lime-600"}>{c.tastings}</span>
                          <span className="text-muted-foreground"> / {c.tastingObjective}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            c.tastingPct < 30 ? "bg-rose-400" : c.tastingPct < 70 ? "bg-amber-400" : "bg-lime-400"
                          }`}
                          style={{ width: `${Math.min(c.tastingPct, 100)}%` }}
                        />
                      </div>
                      <p className={`text-xs mt-0.5 font-semibold ${
                        c.tastingPct < 30 ? "text-rose-500" : c.tastingPct < 70 ? "text-amber-500" : "text-lime-600"
                      }`}>{c.tastingPct}%</p>
                    </div>
                  )}
                  {/* Sales */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> Ventes
                      </span>
                      <span className="text-xs font-bold">
                        <span className={c.salesPct < 30 ? "text-rose-600" : c.salesPct < 70 ? "text-amber-600" : "text-lime-600"}>{c.sales}</span>
                        <span className="text-muted-foreground"> / {c.salesObjective}</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          c.salesPct < 30 ? "bg-rose-400" : c.salesPct < 70 ? "bg-amber-400" : "bg-lime-400"
                        }`}
                        style={{ width: `${Math.min(c.salesPct, 100)}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-0.5 font-semibold ${
                      c.salesPct < 30 ? "text-rose-500" : c.salesPct < 70 ? "text-amber-500" : "text-lime-600"
                    }`}>{c.salesPct}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        <Card className="lg:col-span-2 border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/10">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              Activité des 7 derniers jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id={g1} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={CHART_COLORS.c1} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.c1} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={g2} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={CHART_COLORS.c2} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.c2} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 2 }} />
                  {showTastingsLine && (
                    <Area type="monotone" dataKey="tastings" stroke={CHART_COLORS.c1} strokeWidth={2.5}
                      fill={`url(#${g1})`} name="Dégustations" dot={false}
                      activeDot={{ r: 5, fill: CHART_COLORS.c1, stroke: "#fff", strokeWidth: 2 }} />
                  )}
                  <Area type="monotone" dataKey="sales" stroke={CHART_COLORS.c2} strokeWidth={2.5}
                    fill={`url(#${g2})`} name="Ventes" dot={false}
                    activeDot={{ r: 5, fill: CHART_COLORS.c2, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-3 justify-center">
              {showTastingsLine && (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.c1 }} />
                  <span className="text-xs text-muted-foreground">Dégustations</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.c2 }} />
                <span className="text-xs text-muted-foreground">Ventes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-slate-100/80 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-50">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-100">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
              </div>
              Répartition des ventes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Aucune vente enregistrée</div>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={76}
                        paddingAngle={4} dataKey="value" strokeWidth={0}>
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS.pie[idx % CHART_COLORS.pie.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-3">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS.pie[i % CHART_COLORS.pie.length] }} />
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                      <span className="text-xs font-semibold text-foreground ml-auto">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom KPI cards ── */}
      <div className="grid md:grid-cols-2 gap-6">

        <Card className="border-0 shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Équipes actives</p>
                <div className="text-5xl font-black mt-1.5 text-foreground tabular-nums">{stats?.teamMembers ?? 0}</div>
                <p className="text-sm text-muted-foreground mt-1">membres terrain actifs</p>
              </div>
              <div className="w-14 h-14 bg-primary/8 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-primary" />
              </div>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Hôtesses</span>
                  <span className="font-semibold text-primary">{teamBreakdown.hotesses}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${stats?.teamMembers ? Math.round((teamBreakdown.hotesses / stats.teamMembers) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Superviseurs</span>
                  <span className="font-semibold text-cyan-600">{teamBreakdown.superviseurs}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                    style={{ width: `${stats?.teamMembers ? Math.round((teamBreakdown.superviseurs / stats.teamMembers) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Taux d&apos;activité</span>
                  <span className="font-semibold text-emerald-600">{teamBreakdown.activityRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${teamBreakdown.activityRate}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Chiffre d&apos;affaires</p>
                <div className="text-3xl font-black mt-1.5 text-foreground">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(stats?.totalRevenue ?? 0)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">total des ventes</p>
              </div>
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-accent" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Vs mois dernier</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />+8%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-[58%] bg-accent rounded-full transition-all duration-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
    </div>
  );
}
