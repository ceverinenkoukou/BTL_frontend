"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type {
  CampagneDetail,
  CampagneRapportSites,
  CampagneSiteRapport,
  SiteDetail,
  Degustation,
  Vente,
  GainPromotion,
} from "@/lib/types/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UtensilsCrossed,
  ShoppingCart,
  TrendingUp,
  Gift,
  Tag,
  Calendar,
  Download,
  BarChart3,
  MapPin,
  Users,
  ArrowUp,
  Package,
  Activity,
  Beer,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = {
  primary: "#DC2626",
  secondary: "#F59E0B",
  success: "#10B981",
  info: "#3B82F6",
  purple: "#8B5CF6",
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
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

function GaugeBar({ label, current, total, color, gradient }: {
  label: string; current: number; total: number; color: string; gradient: string;
}) {
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{fmt(current)} <span className="text-muted-foreground font-normal text-xs">/ {fmt(total)}</span></span>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${gradient}`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">{pct}%</span>
      </div>
    </div>
  );
}

interface DailyData {
  date: string;
  dateFull: string;
  degustations: number;
  ventes: number;
  goodiesDistribues: number;
  gainsPromotions: number;
  conversion: number;
}

export default function CompanyCampaignDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const campaignId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampagneDetail | null>(null);
  const [rapport, setRapport] = useState<CampagneRapportSites | null>(null);
  const [tastings, setTastings] = useState<Degustation[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [siteDetails, setSiteDetails] = useState<SiteDetail[]>([]);
  const [gainsPromotions, setGainsPromotions] = useState<GainPromotion[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const promoChartRef = useRef<HTMLDivElement>(null);

  const fetchCampaignData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [campRes, rapportRes, tastRes, ventesRes, gainsRes] = await Promise.all([
        api.get<CampagneDetail>(`/campagnes/${campaignId}/`),
        api.get<CampagneRapportSites>(`/campagnes/${campaignId}/rapport-sites/`).catch(() => ({ data: null })),
        api.get<Degustation[]>(`/degustations/?campagne=${campaignId}`),
        api.get<Vente[]>(`/ventes/?campagne=${campaignId}`),
        api.get<GainPromotion[]>(`/gains-promotions/?campagne=${campaignId}`).catch(() => ({ data: [] })),
      ]);
      setCampaign(campRes.data);
      setRapport(rapportRes.data as CampagneRapportSites | null);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : (tastRes.data as { results?: Degustation[] }).results ?? []);
      setVentes(Array.isArray(ventesRes.data) ? ventesRes.data : (ventesRes.data as { results?: Vente[] }).results ?? []);
      const gainsData = Array.isArray(gainsRes.data) ? gainsRes.data : (gainsRes.data as { results?: GainPromotion[] }).results ?? [];
      setGainsPromotions(gainsData);

      // Fetch site details with team info
      if (rapportRes.data && (rapportRes.data as CampagneRapportSites).sites?.length) {
        const sitePromises = (rapportRes.data as CampagneRapportSites).sites.map(s =>
          api.get<SiteDetail>(`/sites/${s.id}/`).catch(() => null)
        );
        const results = await Promise.all(sitePromises);
        setSiteDetails(results.filter(r => r?.data).map(r => r!.data) as SiteDetail[]);
      }
    } catch {}
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/auth/login"); return; }
      if (user.role !== "Entreprise") { router.push("/dashboard"); return; }
      if (campaignId) fetchCampaignData();
    }
  }, [user, authLoading, router, campaignId, fetchCampaignData]);

  const showMetrics = useMemo(() => {
    if (!campaign) return { showTasting: true, showVente: true, showGoodies: false, showPromotions: false };
    return {
      showTasting: campaign.type_campagne === "DEGUSTATION" || campaign.type_campagne === "DEGUSTATION_VENTE",
      showVente: campaign.type_campagne === "VENTE" || campaign.type_campagne === "DEGUSTATION_VENTE",
      showGoodies: campaign.type_recompense === "GOODIES",
      showPromotions: campaign.type_recompense === "PROMOTIONS",
    };
  }, [campaign]);

  const { showTasting, showVente, showGoodies, showPromotions } = showMetrics;

  const stats = useMemo(() => {
    const totalTastings = tastings.length;
    const totalVentes = ventes.length;
    const totalRevenue = ventes.reduce((s, v) => s + Number(v.prix_total ?? 0), 0);
    const conversionRate = totalTastings > 0 ? Math.round((totalVentes / totalTastings) * 100) : 0;
    const ratedTastings = tastings.filter(t => t.note_gout !== null);
    const avgRating = ratedTastings.length > 0
      ? Math.round((ratedTastings.reduce((s, t) => s + (t.note_gout ?? 0), 0) / ratedTastings.length) * 10) / 10
      : 0;
    const goodiesDistribues = rapport?.totaux?.goodies_distribues ?? 0;
    const totalGoodiesAlloues = rapport?.sites?.reduce((sum, site) =>
      sum + (site.goodies ?? []).reduce((s, g) => s + g.quantite_initiale, 0), 0) ?? 0;
    const gainsPromotions = (rapport?.totaux as { gains_promotions?: number })?.gains_promotions ?? 0;
    return { totalTastings, totalVentes, totalRevenue, conversionRate, avgRating, goodiesDistribues, totalGoodiesAlloues, gainsPromotions };
  }, [tastings, ventes, rapport]);

  const dailyData: DailyData[] = useMemo(() => {
    const days = 14;
    return Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      const dateStr = format(d, "yyyy-MM-dd");
      return {
        date: format(d, "dd MMM", { locale: fr }),
        dateFull: dateStr,
        degustations: tastings.filter(t => t.created_at.slice(0, 10) === dateStr).length,
        ventes: ventes.filter(v => v.created_at.slice(0, 10) === dateStr).length,
        goodiesDistribues: tastings.filter(t => t.created_at.slice(0, 10) === dateStr && t.a_achete).length,
        gainsPromotions: 0,
        conversion: 0,
      };
    });
  }, [tastings, ventes]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    tastings.forEach(t => dates.add(t.created_at.slice(0, 10)));
    ventes.forEach(v => dates.add(v.created_at.slice(0, 10)));
    return Array.from(dates).sort().reverse();
  }, [tastings, ventes]);

  // Per-site daily performance (today)
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const siteDailyPerf = useMemo(() => {
    if (!rapport) return [];
    return rapport.sites.map(site => ({
      nom: site.nom,
      degustations_today: tastings.filter(t => t.site_nom === site.nom && t.created_at.slice(0, 10) === todayStr).length,
      ventes_today: ventes.filter(v => v.site_nom === site.nom && v.created_at.slice(0, 10) === todayStr).length,
    }));
  }, [rapport, tastings, ventes, todayStr]);

  const promoChartData = useMemo(() => {
    if (!gainsPromotions.length) return [];
    const map: Record<string, Record<string, number>> = {};
    const promoLabels = new Set<string>();
    gainsPromotions.forEach(g => {
      const d = g.created_at.slice(0, 10);
      const label = g.promotion_description;
      promoLabels.add(label);
      if (!map[d]) map[d] = {};
      map[d][label] = (map[d][label] || 0) + 1;
    });
    const labels = Array.from(promoLabels);
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => {
        const row: Record<string, string | number> = {
          date: format(parseISO(date), "dd MMM", { locale: fr }),
        };
        labels.forEach(l => { row[l] = counts[l] || 0; });
        return row;
      });
  }, [gainsPromotions]);

  const promoLabels = useMemo(() => {
    const labels = new Set<string>();
    gainsPromotions.forEach(g => labels.add(g.promotion_description));
    return Array.from(labels);
  }, [gainsPromotions]);

  const handleExportPromoPdf = useCallback(() => {
    const el = promoChartRef.current;
    if (!el) return;
    const svgElement = el.querySelector("svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx!.fillStyle = "#ffffff";
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.scale(2, 2);
      ctx!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imgData = canvas.toDataURL("image/png");
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Écoulements promotionnels - ${campaign?.nom ?? ""}</title>
          <style>body{margin:20px;font-family:sans-serif;text-align:center;}h2{margin-bottom:20px;}img{max-width:100%;}</style>
          </head><body>
          <h2>Écoulements des offres promotionnelles</h2>
          <p style="color:#666;margin-bottom:16px;">${campaign?.nom ?? ""} — Exporté le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}</p>
          <img src="${imgData}" />
          <script>setTimeout(()=>{window.print();window.close();},500)</script>
          </body></html>
        `);
        printWindow.document.close();
      }
    };
    img.src = url;
  }, [campaign]);

  const handleExport = useCallback(() => {
    if (!selectedDate || !campaign) return;
    const dayTastings = tastings.filter(t => t.created_at.slice(0, 10) === selectedDate);
    const dayVentes = ventes.filter(v => v.created_at.slice(0, 10) === selectedDate);
    const csvContent = [
      ["Date", "Type", "Produit", "Client", "Site", "Note", "Achat", "Quantité", "Montant"].join(";"),
      ...dayTastings.map(t => [selectedDate, "Dégustation", t.produit_nom, t.nom_client || "-", t.site_nom, t.note_gout, t.a_achete ? "Oui" : "Non", "-", "-"].join(";")),
      ...dayVentes.map(v => [selectedDate, "Vente", v.produit_nom, "-", v.site_nom, "-", "Oui", v.quantite, v.prix_total].join(";")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${campaign.nom}_${selectedDate}.csv`;
    link.click();
  }, [selectedDate, campaign, tastings, ventes]);

  if (authLoading || (!campaign && loading)) return <CompanyCampaignSkeleton />;
  if (!campaign) return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Campagne non trouvée</p></div>;

  const p1 = campaign.couleur_primaire || "#006776";
  const p2 = campaign.couleur_secondaire || "#00899b";

  return (
    <div className="space-y-6">
      {/* ── Hero Header ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-2xl"
        style={{ background: `linear-gradient(135deg, ${p1} 0%, ${p2} 100%)`, boxShadow: `0 20px 40px -12px ${hex(p1, 0.35)}` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-white/25 text-white border-white/40 text-xs backdrop-blur-sm">
                {campaign.type_campagne_display}
              </Badge>
              {campaign.type_recompense !== "AUCUNE" && (
                <Badge className="bg-white/25 text-white border-white/40 text-xs backdrop-blur-sm">
                  {campaign.type_recompense === "GOODIES" ? "🎁 Goodies" : "🏷️ Promotions"}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{campaign.nom}</h1>
            <p className="text-white/80 text-sm mt-1">
              Du {format(parseISO(campaign.date_debut), "dd MMM yyyy", { locale: fr })} au {format(parseISO(campaign.date_fin), "dd MMM yyyy", { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl p-2">
            <Calendar className="w-4 h-4 text-white/70 ml-2" />
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-44 border-0 bg-transparent text-white focus:ring-0 [&>span]:text-white/90">
                <SelectValue placeholder="Exporter un jour..." />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {format(parseISO(date), "EEEE dd MMMM", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleExport} disabled={!selectedDate} className="gap-1 bg-white/25 hover:bg-white/35 text-white border-0">
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Colored Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {showTasting && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-orange-400 p-5 text-white shadow-xl shadow-red-200/40 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/20">
                  <ArrowUp className="w-3 h-3 inline" /> {stats.avgRating}/5
                </span>
              </div>
              <div className="text-2xl font-bold">{fmt(stats.totalTastings)}</div>
              <p className="text-white/80 text-xs mt-1">Dégustations</p>
            </div>
          </div>
        )}
        {showVente && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-400 p-5 text-white shadow-xl shadow-amber-200/40 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/20">
                  {fmt(stats.totalRevenue)} F
                </span>
              </div>
              <div className="text-2xl font-bold">{fmt(stats.totalVentes)}</div>
              <p className="text-white/80 text-xs mt-1">Ventes / Distributions</p>
            </div>
          </div>
        )}
        {showGoodies && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-green-500 to-teal-400 p-5 text-white shadow-xl shadow-emerald-200/40 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Gift className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/20 animate-pulse">
                  temps réel
                </span>
              </div>
              <div className="text-2xl font-bold">{fmt(stats.goodiesDistribues)} / {fmt(stats.totalGoodiesAlloues)}</div>
              <p className="text-white/80 text-xs mt-1">Goodies distribués / total alloué</p>
            </div>
          </div>
        )}
        {showPromotions && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 p-5 text-white shadow-xl shadow-blue-200/40 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Tag className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/20">
                  promos
                </span>
              </div>
              <div className="text-2xl font-bold">{fmt(stats.gainsPromotions)}</div>
              <p className="text-white/80 text-xs mt-1">Canettes offertes</p>
            </div>
          </div>
        )}
        {/* <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400 p-5 text-white shadow-xl shadow-violet-200/40 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
          <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/20">
                conversion
              </span>
            </div>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-white/80 text-xs mt-1">Taux de conversion</p>
          </div>
        </div> */}
      </div>

      {/* ── Jauges des objectifs ── */}
      <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: p1 }} /> Objectifs de la campagne
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {showVente && campaign.objectif_ventes && (
            <GaugeBar
              label="Ventes / Distributions"
              current={stats.totalVentes}
              total={campaign.objectif_ventes}
              color={COLORS.secondary}
              gradient="from-amber-500 to-yellow-400"
            />
          )}
          {showTasting && campaign.objectif_degustations && (
            <GaugeBar
              label="Dégustations"
              current={stats.totalTastings}
              total={campaign.objectif_degustations}
              color={COLORS.primary}
              gradient="from-red-500 to-orange-400"
            />
          )}
          {showGoodies && stats.totalGoodiesAlloues > 0 && (
            <GaugeBar
              label="Goodies distribués"
              current={stats.goodiesDistribues}
              total={stats.totalGoodiesAlloues}
              color={COLORS.success}
              gradient="from-emerald-500 to-teal-400"
            />
          )}
          {showPromotions && (
            <GaugeBar
              label="Canettes offertes (Promotions)"
              current={stats.gainsPromotions}
              total={campaign.objectif_ventes ?? 50}
              color={COLORS.info}
              gradient="from-blue-500 to-cyan-400"
            />
          )}
        </CardContent>
      </Card>

      {/* ── Promotions ── */}
      {showPromotions && campaign.promotions && campaign.promotions.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3" style={{ background: hex(COLORS.info, 0.05) }}>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Tag className="w-4 h-4" style={{ color: COLORS.info }} /> Offres promotionnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {campaign.promotions.filter((p) => p.is_active).map((promo) => (
                <div key={promo.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
                  <Badge className="text-[10px]"
                    style={{
                      background: promo.type_promotion === "OFFERT" ? hex("#10B981", 0.2) : hex("#F59E0B", 0.2),
                      color: promo.type_promotion === "OFFERT" ? "#10B981" : "#F59E0B",
                    }}>
                    {promo.type_promotion === "OFFERT" ? "🎁 Offert" : "🏆 À gagner"}
                  </Badge>
                  <p className="font-medium text-sm">Acheter <span className="text-blue-700 font-bold">{promo.quantite_requise}</span> produit{promo.quantite_requise > 1 ? "s" : ""}</p>
                  <p className="text-sm text-muted-foreground">→ {promo.recompense_description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* ── Charts ── */}
      <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-red-500" /> Évolution sur 14 jours
          </CardTitle>
        </CardHeader>
        <CardContent><div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <defs>
                {showTasting && <linearGradient id="gradTastings" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.primary} stopOpacity={0}/></linearGradient>}
                {showVente && <linearGradient id="gradVentes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.secondary} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.secondary} stopOpacity={0}/></linearGradient>}
                {showGoodies && <linearGradient id="gradGoodies" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.success} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.success} stopOpacity={0}/></linearGradient>}
                {showPromotions && <linearGradient id="gradPromos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.info} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.info} stopOpacity={0}/></linearGradient>}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 2 }} />
              {showTasting && <Area type="monotone" dataKey="degustations" stroke={COLORS.primary} strokeWidth={2} fill="url(#gradTastings)" name="Dégustations" dot={false} activeDot={{ r: 5 }} />}
              {showVente && <Area type="monotone" dataKey="ventes" stroke={COLORS.secondary} strokeWidth={2} fill="url(#gradVentes)" name="Ventes" dot={false} activeDot={{ r: 5 }} />}
              {showGoodies && <Area type="monotone" dataKey="goodiesDistribues" stroke={COLORS.success} strokeWidth={2} fill="url(#gradGoodies)" name="Goodies" dot={false} activeDot={{ r: 5 }} />}
              {showPromotions && <Area type="monotone" dataKey="gainsPromotions" stroke={COLORS.info} strokeWidth={2} fill="url(#gradPromos)" name="Canettes offertes" dot={false} activeDot={{ r: 5 }} />}
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div></CardContent>
      </Card>

      {/* ── Performance par site — tableau ── */}
      {rapport && rapport.sites.length > 0 && (() => {
        const maxDeg = Math.max(1, ...rapport.sites.map(s => s.degustations));
        const maxVen = Math.max(1, ...rapport.sites.map(s => s.ventes));
        return (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-500" /> Performance par site
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Site</th>
                      {showTasting && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Dégust.</th>}
                      {showVente && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Ventes</th>}
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Conv.</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">CA</th>
                      {showGoodies && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Goodies</th>}
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Hôtesses</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Aujour. dégust.</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Aujour. ventes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapport.sites.map((site, idx) => {
                      const perf = siteDailyPerf.find(p => p.nom === site.nom);
                      const degPct = Math.round((site.degustations / maxDeg) * 100);
                      const venPct = Math.round((site.ventes / maxVen) * 100);
                      const ca = Number(site.chiffre_affaires ?? 0);
                      return (
                        <tr key={site.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${p1}, ${p2})` }}>
                                <MapPin className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground leading-tight">{site.nom}</p>
                                <p className="text-[10px] text-muted-foreground">{site.ville}</p>
                              </div>
                            </div>
                          </td>
                          {showTasting && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-bold text-red-600">{fmt(site.degustations)}</span>
                                <div className="w-16 h-1.5 bg-red-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${degPct}%` }} />
                                </div>
                              </div>
                            </td>
                          )}
                          {showVente && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="font-bold text-amber-600">{fmt(site.ventes)}</span>
                                <div className="w-16 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${venPct}%` }} />
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-3 text-right">
                            <Badge className={`text-[10px] border-0 ${
                              site.taux_conversion >= 50 ? "bg-emerald-100 text-emerald-700" :
                              site.taux_conversion >= 25 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {site.taux_conversion}%
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-foreground text-xs">
                              {ca > 0 ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(ca) : "—"}
                            </span>
                          </td>
                          {showGoodies && (
                            <td className="px-4 py-3 text-right">
                              <span className="text-xs font-semibold text-emerald-700">
                                {fmt(site.goodies_distribues_total ?? 0)}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-muted-foreground">{site.nb_hotesses}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs font-bold ${
                              (perf?.degustations_today ?? 0) > 0 ? "text-red-600" : "text-slate-400"
                            }`}>{fmt(perf?.degustations_today ?? 0)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs font-bold ${
                              (perf?.ventes_today ?? 0) > 0 ? "text-amber-600" : "text-slate-400"
                            }`}>{fmt(perf?.ventes_today ?? 0)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 font-bold text-sm text-foreground">Total</td>
                      {showTasting && <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(rapport.sites.reduce((s, x) => s + x.degustations, 0))}</td>}
                      {showVente && <td className="px-4 py-3 text-right font-bold text-amber-600">{fmt(rapport.sites.reduce((s, x) => s + x.ventes, 0))}</td>}
                      <td className="px-4 py-3 text-right">
                        <Badge className="bg-slate-200 text-slate-700 border-0 text-[10px]">
                          {rapport.sites.length > 0 ? Math.round(rapport.sites.reduce((s, x) => s + x.taux_conversion, 0) / rapport.sites.length) : 0}% moy.
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-xs">
                        {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(
                          rapport.sites.reduce((s, x) => s + Number(x.chiffre_affaires ?? 0), 0)
                        )}
                      </td>
                      {showGoodies && <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(rapport.totaux?.goodies_distribues ?? 0)}</td>}
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{rapport.sites.reduce((s, x) => s + x.nb_hotesses, 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(siteDailyPerf.reduce((s, p) => s + p.degustations_today, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600">{fmt(siteDailyPerf.reduce((s, p) => s + p.ventes_today, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Dernières actions sur les sites ── */}
      {(tastings.length > 0 || ventes.length > 0) && (() => {
        const actions = [
          ...tastings.slice(-30).map(t => ({
            id: t.id, type: "deg" as const,
            label: t.produit_nom,
            site: t.site_nom,
            agent: t.hotesse_nom,
            meta: t.a_achete ? "acheté" : `note ${t.note_gout}/5`,
            date: t.created_at,
          })),
          ...ventes.slice(-30).map(v => ({
            id: v.id, type: "vente" as const,
            label: v.produit_nom,
            site: v.site_nom,
            agent: v.hotesse_nom,
            meta: v.prix_total ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(Number(v.prix_total)) : "",
            date: v.created_at,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

        const siteNames = [...new Set(actions.map(a => a.site))];

        return (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" /> Dernières actions sur les sites
                <Badge className="ml-auto bg-slate-100 text-slate-600 border-0 text-xs font-normal">{actions.length} action{actions.length > 1 ? "s" : ""}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {siteNames.map(siteName => {
                const siteActions = actions.filter(a => a.site === siteName);
                return (
                  <div key={siteName}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${p1}, ${p2})` }}>
                        <MapPin className="w-3 h-3" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">{siteName}</p>
                      <span className="text-[10px] text-muted-foreground ml-auto">{siteActions.length} action{siteActions.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      {siteActions.map((a, i) => (
                        <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${
                          i < siteActions.length - 1 ? "border-b border-slate-50" : ""
                        } ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            a.type === "deg" ? "bg-red-100" : "bg-amber-100"
                          }`}>
                            {a.type === "deg"
                              ? <Beer className="w-3.5 h-3.5 text-red-500" />
                              : <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-foreground truncate">{a.label}</p>
                              <Badge className={`text-[9px] border-0 shrink-0 ${
                                a.type === "deg" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                              }`}>
                                {a.type === "deg" ? "Dégust." : "Vente"}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{a.agent} · {a.meta}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(a.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Écoulements des offres promotionnelles par jour ── */}
      {showPromotions && promoChartData.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-500" /> Écoulements des offres promotionnelles par jour
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleExportPromoPdf} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={promoChartRef} className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={promoChartData} margin={{ top: 5, right: 10, bottom: 30, left: -10 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  {promoLabels.map((label, idx) => {
                    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];
                    return (
                      <Bar
                        key={label}
                        dataKey={label}
                        name={label}
                        fill={colors[idx % colors.length]}
                        radius={[4, 4, 0, 0]}
                        stackId="promos"
                      />
                    );
                  })}
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Détails des sites (équipe + perf journalière + goodies) ── */}
      {rapport && rapport.sites.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: p1 }} /> Détails des sites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              {rapport.sites.map((site: CampagneSiteRapport) => {
                const detail = siteDetails.find(d => d.id === site.id);
                const perf = siteDailyPerf.find(p => p.nom === site.nom);
                return (
                  <div key={site.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                    {/* Site Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: `linear-gradient(135deg, ${p1}, ${p2})` }}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{site.nom}</p>
                            <p className="text-xs text-muted-foreground">{site.ville}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                          {site.taux_conversion}% conv.
                        </Badge>
                      </div>
                    </div>

                    {/* Team */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Hôtesses ({detail?.hotesses?.length ?? site.nb_hotesses})</p>
                        {detail?.hotesses?.length ? (
                          <div className="space-y-1">
                            {detail.hotesses.map(h => (
                              <div key={h.id} className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-red-600">{h.name.slice(0, 1)}</span>
                                </div>
                                <span className="text-xs text-foreground">{h.name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">{site.nb_hotesses} affectée{site.nb_hotesses > 1 ? "s" : ""}</p>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Superviseurs ({detail?.superviseurs?.length ?? site.nb_superviseurs})</p>
                        {detail?.superviseurs?.length ? (
                          <div className="space-y-1">
                            {detail.superviseurs.map(s => (
                              <div key={s.id} className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-blue-600">{s.name.slice(0, 1)}</span>
                                </div>
                                <span className="text-xs text-foreground">{s.name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">{site.nb_superviseurs} affecté{site.nb_superviseurs > 1 ? "s" : ""}</p>
                        )}
                      </div>
                    </div>

                    {/* Daily Performance */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-lg bg-red-50 border border-red-100 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Dégust. aujourd&apos;hui</p>
                        <p className="text-sm font-bold text-red-600">{fmt(perf?.degustations_today ?? 0)}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Ventes aujourd&apos;hui</p>
                        <p className="text-sm font-bold text-amber-600">{fmt(perf?.ventes_today ?? 0)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Total dégust.</p>
                        <p className="text-sm font-bold text-foreground">{fmt(site.degustations)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Total ventes</p>
                        <p className="text-sm font-bold text-foreground">{fmt(site.ventes)}</p>
                      </div>
                    </div>

                    {/* Goodies par site */}
                    {showGoodies && (site.goodies ?? []).length > 0 && (
                      <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift className="w-4 h-4 text-emerald-600" />
                          <p className="text-xs font-semibold text-emerald-800">Goodies sur ce site</p>
                          <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-0 text-[10px] animate-pulse">
                            temps réel
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {(site.goodies ?? []).map(g => {
                            const pct = g.quantite_initiale > 0 ? Math.round((g.quantite_distribuee / g.quantite_initiale) * 100) : 0;
                            return (
                              <div key={g.goodie_id} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-foreground">{g.goodie_nom}</span>
                                  <span className="text-emerald-700 font-semibold">{fmt(g.quantite_distribuee)} <span className="text-muted-foreground font-normal">/ {fmt(g.quantite_initiale)}</span></span>
                                </div>
                                <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>{pct}% distribués</span>
                                  <span>{fmt(g.quantite_restante)} restant{g.quantite_restante > 1 ? "s" : ""}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-emerald-100 flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Total distribués sur ce site</span>
                          <span className="text-sm font-bold text-emerald-700">{fmt(site.goodies_distribues_total ?? 0)}</span>
                        </div>
                      </div>
                    )}

                    {/* Promotions stats par site */}
                    {showPromotions && site.promotions_stats && site.promotions_stats.length > 0 && (
                      <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-blue-600" />
                          <p className="text-xs font-semibold text-blue-800">Canettes offertes sur ce site</p>
                        </div>
                        <div className="space-y-1.5">
                          {site.promotions_stats.map((ps, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-blue-50">
                              <span className="text-foreground">{ps.recompense_description}</span>
                              <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">{fmt(ps.gains_count)} gagné{ps.gains_count > 1 ? "s" : ""}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

function CompanyCampaignSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
