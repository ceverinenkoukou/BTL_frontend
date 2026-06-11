"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { CampagneList, Degustation, Vente, VenteStats, RemoteUser } from "@/lib/types/backend";
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

// ─── Role-based theme config ────────────────────────────────────────────────
const ROLE_THEMES = {
  Administrateur: {
    heroBg: "from-indigo-700 via-blue-600 to-violet-500",
    heroShadow: "shadow-indigo-300",
    heroGlow: "rgba(99,102,241,0.35)",
    statCards: [
      { grad: "from-indigo-700 via-blue-500 to-blue-400",    shadow: "shadow-blue-300/50" },
      { grad: "from-violet-700 via-purple-500 to-fuchsia-400", shadow: "shadow-violet-300/50" },
      { grad: "from-sky-600 via-cyan-500 to-teal-400",        shadow: "shadow-sky-300/50" },
      { grad: "from-slate-700 via-slate-500 to-slate-400",    shadow: "shadow-slate-300/50" },
    ],
    chart1: "#4F46E5", chart2: "#7C3AED",
    pieColors: ["#4F46E5", "#7C3AED", "#0EA5E9", "#6366F1"],
    teamBg: "from-indigo-50 via-blue-50 to-violet-50",
    teamIconGrad: "from-indigo-600 to-blue-500", teamShadow: "shadow-indigo-200",
    teamText: "text-indigo-700", teamTrack: "bg-indigo-100", teamBar: "from-indigo-600 to-blue-400",
    revBg: "from-violet-50 via-purple-50 to-fuchsia-50",
    revIconGrad: "from-violet-600 to-fuchsia-500", revShadow: "shadow-violet-200",
    revText: "text-violet-700", revTrack: "bg-violet-100", revBar: "from-violet-600 to-fuchsia-400",
    sparkleColor: "text-indigo-500",
  },
  Superviseur: {
    heroBg: "from-teal-600 via-emerald-500 to-cyan-400",
    heroShadow: "shadow-teal-300",
    heroGlow: "rgba(20,184,166,0.35)",
    statCards: [
      { grad: "from-teal-600 via-teal-500 to-cyan-400",        shadow: "shadow-teal-300/50" },
      { grad: "from-emerald-600 via-green-500 to-lime-400",     shadow: "shadow-emerald-300/50" },
      { grad: "from-cyan-600 via-sky-500 to-blue-400",          shadow: "shadow-cyan-300/50" },
      { grad: "from-green-700 via-emerald-500 to-teal-400",     shadow: "shadow-green-300/50" },
    ],
    chart1: "#0D9488", chart2: "#0EA5E9",
    pieColors: ["#0D9488", "#10B981", "#0EA5E9", "#06B6D4"],
    teamBg: "from-teal-50 via-emerald-50 to-cyan-50",
    teamIconGrad: "from-teal-600 to-emerald-500", teamShadow: "shadow-teal-200",
    teamText: "text-teal-700", teamTrack: "bg-teal-100", teamBar: "from-teal-600 to-emerald-400",
    revBg: "from-cyan-50 via-sky-50 to-blue-50",
    revIconGrad: "from-cyan-600 to-sky-400", revShadow: "shadow-cyan-200",
    revText: "text-cyan-700", revTrack: "bg-cyan-100", revBar: "from-cyan-600 to-sky-400",
    sparkleColor: "text-teal-500",
  },
  Hotesse: {
    heroBg: "from-rose-500 via-pink-500 to-fuchsia-400",
    heroShadow: "shadow-rose-300",
    heroGlow: "rgba(244,63,94,0.35)",
    statCards: [
      { grad: "from-rose-500 via-pink-500 to-fuchsia-400",     shadow: "shadow-rose-300/50" },
      { grad: "from-fuchsia-600 via-purple-500 to-violet-400", shadow: "shadow-fuchsia-300/50" },
      { grad: "from-pink-600 via-rose-400 to-red-300",          shadow: "shadow-pink-300/50" },
      { grad: "from-violet-600 via-fuchsia-500 to-pink-400",   shadow: "shadow-violet-300/50" },
    ],
    chart1: "#F43F5E", chart2: "#EC4899",
    pieColors: ["#F43F5E", "#EC4899", "#A855F7", "#F97316"],
    teamBg: "from-rose-50 via-pink-50 to-fuchsia-50",
    teamIconGrad: "from-rose-500 to-pink-500", teamShadow: "shadow-rose-200",
    teamText: "text-rose-600", teamTrack: "bg-rose-100", teamBar: "from-rose-500 to-pink-400",
    revBg: "from-fuchsia-50 via-purple-50 to-violet-50",
    revIconGrad: "from-fuchsia-600 to-violet-500", revShadow: "shadow-fuchsia-200",
    revText: "text-fuchsia-600", revTrack: "bg-fuchsia-100", revBar: "from-fuchsia-500 to-violet-400",
    sparkleColor: "text-rose-500",
  },
  default: {
    heroBg: "from-orange-500 via-orange-400 to-amber-300",
    heroShadow: "shadow-orange-200",
    heroGlow: "rgba(249,115,22,0.3)",
    statCards: [
      { grad: "from-orange-500 via-amber-400 to-yellow-300",   shadow: "shadow-orange-300/50" },
      { grad: "from-violet-600 via-purple-500 to-fuchsia-400", shadow: "shadow-violet-300/50" },
      { grad: "from-emerald-500 via-green-400 to-teal-300",    shadow: "shadow-emerald-300/50" },
      { grad: "from-blue-600 via-blue-400 to-cyan-300",         shadow: "shadow-blue-300/50" },
    ],
    chart1: "#F97316", chart2: "#8B5CF6",
    pieColors: ["#F97316", "#8B5CF6", "#10B981", "#3B82F6"],
    teamBg: "from-emerald-50 via-teal-50 to-cyan-50",
    teamIconGrad: "from-emerald-500 to-teal-500", teamShadow: "shadow-emerald-200",
    teamText: "text-emerald-600", teamTrack: "bg-emerald-100", teamBar: "from-emerald-500 to-teal-400",
    revBg: "from-violet-50 via-purple-50 to-fuchsia-50",
    revIconGrad: "from-violet-500 to-fuchsia-500", revShadow: "shadow-violet-200",
    revText: "text-violet-600", revTrack: "bg-violet-100", revBar: "from-violet-500 to-fuchsia-400",
    sparkleColor: "text-orange-500",
  },
} as const;

type ThemeKey = keyof typeof ROLE_THEMES;

const PIE_DATA = [
  { name: "Produit A", value: 40 },
  { name: "Produit B", value: 30 },
  { name: "Produit C", value: 20 },
  { name: "Autres",   value: 10 },
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
  tastings: number;
  tastingObjective: number;
  tastingPct: number;
  sales: number;
  salesObjective: number;
  salesPct: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; tastings: number; sales: number }[]>([]);
  const [underperformers, setUnderperformers] = useState<UnderperformingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const role = user?.role ?? "default";
  const theme = ROLE_THEMES[(role as ThemeKey)] ?? ROLE_THEMES.default;

  useEffect(() => { fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    try {
      const [campRes, tastRes, ventesRes, statsRes, usersRes] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/").catch(() => ({ data: null })),
        api.get<RemoteUser[]>("/users/terrain-staff/").catch(() => ({ data: [] })),
      ]);

      const campaigns: CampagneList[] = Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []);
      const tastingsArray = Array.isArray(tastRes.data) ? tastRes.data : [];
      const ventesArray = Array.isArray(ventesRes.data) ? ventesRes.data : [];
      const venteStats = statsRes.data as VenteStats | null;
      const teamMembers = (usersRes.data as RemoteUser[]).filter((u: RemoteUser) => u.is_active);

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
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const dayStr = d.toISOString().slice(0, 10);
        return {
          date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
          tastings: tastingsArray.filter(t => t.created_at.slice(0, 10) === dayStr).length,
          sales: ventesArray.filter(v => v.created_at.slice(0, 10) === dayStr).length,
        };
      });
      setChartData(days);

      // Underperformers: campaigns without objective info but low tasting/sale counts
      const campTastingMap = new Map<string, number>();
      tastingsArray.forEach(t => campTastingMap.set(t.campagne_nom, (campTastingMap.get(t.campagne_nom) ?? 0) + 1));
      const campSaleMap = new Map<string, number>();
      ventesArray.forEach(v => campSaleMap.set(v.campagne_nom, (campSaleMap.get(v.campagne_nom) ?? 0) + 1));

      const up: UnderperformingCampaign[] = campaigns.map(c => {
        const t = campTastingMap.get(c.nom) ?? 0;
        const s = campSaleMap.get(c.nom) ?? 0;
        const tPct = t > 0 ? 100 : 0;
        const sPct = t > 0 ? Math.round((s / t) * 100) : 0;
        const now = new Date();
        const status = new Date(c.date_debut) > now ? "planned"
          : new Date(c.date_fin) < now ? "ended"
          : "active";
        return {
          id: c.id, name: c.nom, company: c.entreprise_nom,
          status,
          tastings: t, tastingObjective: 0, tastingPct: tPct,
          sales: s, salesObjective: 0, salesPct: sPct,
        };
      }).filter(x => x.tastings === 0);
      setUnderperformers(up);
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
    borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: "12px",
  };

  const g1 = `gT_${role}`;
  const g2 = `gS_${role}`;

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">

      {/* ── Hero banner ── */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.heroBg} p-6 md:p-8 text-white shadow-2xl ${theme.heroShadow}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-16 -bottom-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{roleEmoji[role] ?? "👤"}</span>
              <Badge className="bg-white/25 text-white border-white/40 hover:bg-white/35 text-xs backdrop-blur-sm">
                {roleLabels[role] ?? role}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
              Bonjour, {user?.name?.split(" ")[0] ?? "Utilisateur"} !
            </h1>
            <p className="text-white/75 mt-1 text-sm md:text-base">Voici un aperçu de vos activités</p>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 w-fit">
            <Star className="w-5 h-5 text-yellow-200 fill-yellow-200" />
            <div>
              <p className="text-xs text-white/70">Performance</p>
              <p className="font-bold text-sm">Excellent 🔥</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const c = theme.statCards[i];
          return (
            <div key={i}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.grad} p-5 text-white shadow-xl ${c.shadow} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-default`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.08),transparent)]" />
              <div className="absolute -right-3 -bottom-3 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    {card.icon}
                  </div>
                  <span className="flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full bg-white/25">
                    <ArrowUp className="w-3 h-3" />{card.trend}
                  </span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{card.value}</div>
                <p className="text-white/80 text-xs mt-1 font-medium">{card.title}</p>
              </div>
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
                  {/* Tastings */}
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

        <Card className="lg:col-span-2 border-0 shadow-lg shadow-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${theme.sparkleColor}`} />
              Activité des 7 derniers jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id={g1} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={theme.chart1} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={theme.chart1} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={g2} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={theme.chart2} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={theme.chart2} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="tastings" stroke={theme.chart1} strokeWidth={3}
                    fill={`url(#${g1})`} name="Dégustations" dot={false}
                    activeDot={{ r: 6, fill: theme.chart1, stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="sales" stroke={theme.chart2} strokeWidth={3}
                    fill={`url(#${g2})`} name="Ventes" dot={false}
                    activeDot={{ r: 6, fill: theme.chart2, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-3 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.chart1 }} />
                <span className="text-xs text-muted-foreground font-medium">Dégustations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.chart2 }} />
                <span className="text-xs text-muted-foreground font-medium">Ventes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg shadow-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition des ventes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={76}
                    paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {PIE_DATA.map((_, idx) => (
                      <Cell key={idx} fill={theme.pieColors[idx % theme.pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-3">
              {PIE_DATA.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.pieColors[i] }} />
                  <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                  <span className="text-xs font-semibold text-foreground ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom KPI cards ── */}
      <div className="grid md:grid-cols-2 gap-6">

        <Card className={`border-0 shadow-lg shadow-slate-100 rounded-2xl overflow-hidden bg-gradient-to-br ${theme.teamBg}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Équipe active</p>
                <div className={`text-5xl font-bold mt-1 ${theme.teamText}`}>{stats?.teamMembers ?? 0}</div>
                <p className="text-sm text-muted-foreground mt-1">membres actifs</p>
              </div>
              <div className={`w-16 h-16 bg-gradient-to-br ${theme.teamIconGrad} rounded-2xl flex items-center justify-center shadow-lg ${theme.teamShadow}`}>
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Disponibilité</span>
                <span className={`font-semibold ${theme.teamText}`}>72%</span>
              </div>
              <div className={`h-2 rounded-full ${theme.teamTrack} overflow-hidden`}>
                <div className={`h-full w-[72%] bg-gradient-to-r ${theme.teamBar} rounded-full transition-all duration-700`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-lg shadow-slate-100 rounded-2xl overflow-hidden bg-gradient-to-br ${theme.revBg}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Chiffre d&apos;affaires</p>
                <div className={`text-3xl font-bold mt-1 ${theme.revText}`}>
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(stats?.totalRevenue ?? 0)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">total des ventes</p>
              </div>
              <div className={`w-16 h-16 bg-gradient-to-br ${theme.revIconGrad} rounded-2xl flex items-center justify-center shadow-lg ${theme.revShadow}`}>
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Vs mois dernier</span>
                <span className={`font-semibold ${theme.revText} flex items-center gap-1`}>
                  <ArrowUp className="w-3 h-3" />+8%
                </span>
              </div>
              <div className={`h-2 rounded-full ${theme.revTrack} overflow-hidden`}>
                <div className={`h-full w-[58%] bg-gradient-to-r ${theme.revBar} rounded-full transition-all duration-700`} />
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
