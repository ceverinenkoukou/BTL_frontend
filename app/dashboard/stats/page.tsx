"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, BarChart3, TrendingUp, Users, ShoppingCart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { CampagneList, Degustation, Vente } from "@/lib/types/backend";
import * as XLSX from "xlsx";

const CHART_ORANGE  = "#f97316";
const CHART_PURPLE  = "#a855f7";
const CHART_CYAN    = "#06b6d4";
const CHART_GREEN   = "#10b981";
const PIE_COLORS    = ["#f97316", "#a855f7", "#06b6d4", "#10b981", "#f43f5e"];
const INTENT_COLORS = ["#f43f5e", "#f59e0b", "#10b981"];

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-100 p-3 text-xs min-w-[130px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useUrlState("campagne", "all");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTastings: 0,
    totalSales: 0,
    totalRevenue: 0,
    conversionRate: 0,
    avgRating: 0,
  });
  const [genderData, setGenderData] = useState<{ name: string; value: number }[]>([]);
  const [ageData, setAgeData] = useState<{ name: string; tastings: number; sales: number }[]>([]);
  const [intentData, setIntentData] = useState<{ name: string; value: number }[]>([]);
  const [ratingData, setRatingData] = useState<{ name: string; value: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; tastings: number; sales: number }[]>([]);
  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedCampaign, user]);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get<CampagneList[]>("/campagnes/");
      const list = Array.isArray(res.data) ? res.data : ((res.data as { results?: CampagneList[] }).results ?? []);
      setCampaigns([...list].sort((a, b) => a.nom.localeCompare(b.nom)));
    } catch { /* silent */ }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [tastRes, ventesRes] = await Promise.all([
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
      ]);
      let tastings = Array.isArray(tastRes.data) ? tastRes.data : ((tastRes.data as { results?: Degustation[] }).results ?? []);
      let ventes = Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: Vente[] }).results ?? []);

      if (selectedCampaign !== "all") {
        const camp = campaigns.find(c => c.id === selectedCampaign);
        if (camp) {
          tastings = tastings.filter(t => t.campagne_nom === camp.nom);
          ventes = ventes.filter(v => v.campagne_nom === camp.nom);
        }
      }

      const totalTastings = tastings.length;
      const totalSales = ventes.length;
      const totalRevenue = ventes.reduce((sum, v) => sum + Number(v.prix_total ?? 0), 0);
      const conversionRate = totalTastings > 0 ? (totalSales / totalTastings) * 100 : 0;
      const ratedTastings = tastings.filter(t => t.note_gout !== null);
      const avgRating = ratedTastings.length > 0
        ? ratedTastings.reduce((sum, t) => sum + (t.note_gout ?? 0), 0) / ratedTastings.length
        : 0;

      setStats({
        totalTastings,
        totalSales,
        totalRevenue,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgRating: Math.round(avgRating * 10) / 10,
      });

      // Gender data — not available in backend
      setGenderData([]);

      // Age breakdown (tranche_age_display)
      const ageMap: Record<string, { tastings: number; sales: number }> = {};
      tastings.forEach(t => {
        const age = t.tranche_age_display;
        if (!ageMap[age]) ageMap[age] = { tastings: 0, sales: 0 };
        ageMap[age].tastings++;
        if (t.a_achete) ageMap[age].sales++;
      });
      setAgeData(Object.entries(ageMap).map(([name, d]) => ({ name, ...d })));

      // Purchase intent (intention_achat_display)
      const intentMap: Record<string, number> = {};
      tastings.forEach(t => {
        intentMap[t.intention_achat_display] = (intentMap[t.intention_achat_display] ?? 0) + 1;
      });
      setIntentData(Object.entries(intentMap).map(([name, value]) => ({ name, value })));

      // Rating distribution (note_gout 1-5)
      const ratingMap: Record<number, number> = {};
      tastings.forEach(t => { if (t.note_gout !== null) { ratingMap[t.note_gout] = (ratingMap[t.note_gout] ?? 0) + 1; } });
      const ratingLabels: Record<number, string> = { 1: "Mauvais", 2: "Bof", 3: "Correct", 4: "Bon", 5: "Excellent" };
      setRatingData([1, 2, 3, 4, 5].map(r => ({ name: ratingLabels[r], value: ratingMap[r] ?? 0 })));

      // Daily trend (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });
      const dailyStats = last7Days.map((date) => ({
        date: new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
        tastings: tastings.filter(t => t.created_at.slice(0, 10) === date).length,
        sales: ventes.filter(v => v.created_at.slice(0, 10) === date).length,
      }));
      setDailyData(dailyStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === "Administrateur";
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Statistiques", "Valeur"],
      ["Total dégustations", stats.totalTastings],
      ["Total ventes", stats.totalSales],
      ["Chiffre d'affaires", stats.totalRevenue],
      // ["Taux de conversion", `${stats.conversionRate}%`],
      ["Note moyenne", stats.avgRating],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Résumé");

    // Age data sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ageData), "Par âge");

    // Gender data sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(genderData), "Par sexe");

    // Rating data sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ratingData), "Par note");

    XLSX.writeFile(wb, `statistiques_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const axisStyle = { fill: "#94a3b8", fontSize: 11 };
  const gridStyle = { stroke: "#f1f5f9" };

  return (
    <div className="space-y-6">

      <PageHeader
        title="Statistiques"
        description="Analysez les performances de vos campagnes"
        icon={<BarChart3 className="w-5 h-5" />}
        ctaSlot={
          <div className="flex items-center gap-2 shrink-0">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-56 min-w-[14rem] bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl text-sm [&>svg]:text-white">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={handleExport}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: "🍷", label: "Dégustations",    value: stats.totalTastings        },
          { icon: "🛒", label: "Ventes",           value: stats.totalSales           },
          { icon: "📈", label: "Conversion",       value: `${stats.conversionRate}%` },
          { icon: "⭐", label: "Note moyenne",     value: `${stats.avgRating}/5`     },
          { icon: "💰", label: "Chiffre d'aff.",  value: fmt(stats.totalRevenue)    },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
            <div className="text-base mb-1">{s.icon}</div>
            <div className="text-xl font-bold leading-none text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row 1 : Tendance + Âge ── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Tendance 7 jours */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Tendance sur 7 jours</h3>
          </div>
          {loading ? (
            <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="tastings" stroke={CHART_ORANGE} strokeWidth={2.5}
                    dot={{ fill: CHART_ORANGE, r: 4 }} activeDot={{ r: 6 }} name="Dégustations" />
                  <Line type="monotone" dataKey="sales" stroke={CHART_PURPLE} strokeWidth={2.5}
                    dot={{ fill: CHART_PURPLE, r: 4 }} activeDot={{ r: 6 }} name="Ventes" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Par tranche d'âge */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Par tranche d&apos;âge</h3>
          </div>
          {loading ? (
            <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="tastings" fill={CHART_ORANGE} name="Dégustations" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sales"    fill={CHART_PURPLE} name="Ventes"        radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 : Sexe + Intention + Notes ── */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* Répartition par sexe */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-cyan-100 rounded-lg flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-cyan-600" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Répartition par sexe</h3>
          </div>
          {loading ? (
            <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
          ) : genderData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genderData} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                      paddingAngle={4} dataKey="value">
                      {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-1">
                {genderData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Intention d'achat */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5 text-green-600" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Intention d&apos;achat</h3>
          </div>
          {loading ? (
            <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
          ) : intentData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Aucune donnée</div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={intentData} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                      paddingAngle={4} dataKey="value">
                      {intentData.map((_, i) => <Cell key={i} fill={INTENT_COLORS[i % INTENT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-1">
                {intentData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: INTENT_COLORS[i % INTENT_COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notes de goût */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Notes de goût</h3>
          </div>
          {loading ? (
            <div className="h-56 bg-slate-50 rounded-xl animate-pulse" />
          ) : (
            <div className="h-[13.5rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={axisStyle} />
                  <YAxis dataKey="name" type="category" tick={axisStyle} width={68} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Réponses" radius={[0, 5, 5, 0]}>
                    {ratingData.map((_, i) => {
                      const barColors = ["#f43f5e","#f97316","#f59e0b","#84cc16","#10b981"];
                      return <Cell key={i} fill={barColors[i]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Admin insight strip ── */}
      {isAdmin && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Meilleure tranche d'âge",
              value: ageData.reduce((best, d) => d.sales > (best?.sales ?? 0) ? d : best, ageData[0])?.name ?? "—",
              sub: `${ageData.reduce((best, d) => d.sales > (best?.sales ?? 0) ? d : best, ageData[0])?.sales ?? 0} achats`,
              gradient: "from-orange-500 to-amber-400",
              icon: "🎯",
            },
            {
              label: "Intention d'achat forte",
              value: `${intentData.find(d => d.name === "Élevée")?.value ?? 0}`,
              sub: `sur ${stats.totalTastings} dégustations`,
              gradient: "from-green-500 to-emerald-400",
              icon: "💡",
            },
            {
              label: "Note la plus fréquente",
              value: ratingData.reduce((best, d) => d.value > (best?.value ?? 0) ? d : best, ratingData[0])?.name ?? "—",
              sub: `${ratingData.reduce((best, d) => d.value > (best?.value ?? 0) ? d : best, ratingData[0])?.value ?? 0} réponses`,
              gradient: "from-purple-500 to-violet-400",
              icon: "⭐",
            },
          ].map((s, i) => (
            <div key={i} className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br text-white p-5 shadow-md", s.gradient)}>
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
              <div className="relative z-10">
                <div className="text-2xl mb-2">{s.icon}</div>
                <p className="text-3xl font-black leading-none mb-1">{s.value}</p>
                <p className="text-white/70 text-xs mt-1">{s.sub}</p>
                <p className="text-white/55 text-xs mt-0.5 uppercase tracking-wider font-semibold">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
