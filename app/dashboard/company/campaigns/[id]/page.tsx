"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type {
  CampagneList,
  CampagneDetail,
  CampagneRapportSites,
  Degustation,
  Vente,
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
  Target,
  UtensilsCrossed,
  ShoppingCart,
  TrendingUp,
  Gift,
  Tag,
  Calendar,
  Download,
  ArrowLeft,
  BarChart3,
  MapPin,
  ChevronRight,
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
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [campaign, setCampaign] = useState<CampagneDetail | null>(null);
  const [rapport, setRapport] = useState<CampagneRapportSites | null>(null);
  const [tastings, setTastings] = useState<Degustation[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const fetchCampaigns = useCallback(async () => {
    try {
      const { data } = await api.get<CampagneList[]>("/campagnes/");
      setCampaigns(Array.isArray(data) ? data : (data as { results?: CampagneList[] }).results ?? []);
    } catch {}
  }, []);

  const fetchCampaignData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [campRes, rapportRes, tastRes, ventesRes] = await Promise.all([
        api.get<CampagneDetail>(`/campagnes/${campaignId}/`),
        api.get<CampagneRapportSites>(`/campagnes/${campaignId}/rapport-sites/`).catch(() => ({ data: null })),
        api.get<Degustation[]>(`/degustations/?campagne=${campaignId}`),
        api.get<Vente[]>(`/ventes/?campagne=${campaignId}`),
      ]);
      setCampaign(campRes.data);
      setRapport(rapportRes.data as CampagneRapportSites | null);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : (tastRes.data as { results?: Degustation[] }).results ?? []);
      setVentes(Array.isArray(ventesRes.data) ? ventesRes.data : (ventesRes.data as { results?: Vente[] }).results ?? []);
    } catch {}
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/auth/login"); return; }
      if (user.role !== "Entreprise") { router.push("/dashboard"); return; }
      fetchCampaigns();
      if (campaignId) fetchCampaignData();
    }
  }, [user, authLoading, router, campaignId, fetchCampaigns, fetchCampaignData]);

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
    const avgRating = totalTastings > 0
      ? Math.round((tastings.reduce((s, t) => s + t.note_gout, 0) / totalTastings) * 10) / 10
      : 0;
    const goodiesDistribues = rapport?.totaux?.goodies_distribues ?? 0;
    const gainsPromotions = (rapport?.totaux as { gains_promotions?: number })?.gains_promotions ?? 0;
    return { totalTastings, totalVentes, totalRevenue, conversionRate, avgRating, goodiesDistribues, gainsPromotions };
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
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <Link href="/dashboard/company" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: p1 }} />
            Mes Campagnes
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {campaigns.map((c) => {
            const isActive = c.id === campaignId;
            return (
              <Link key={c.id} href={`/dashboard/company/campaigns/${c.id}`}
                className={cn("block p-3 rounded-xl transition-all", isActive ? "bg-gradient-to-r shadow-sm" : "hover:bg-slate-50")}
                style={isActive ? { background: hex(p1, 0.1) } : {}}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${c.couleur_primaire || p1} 0%, ${c.couleur_secondaire || p2} 100%)` }}>
                    {c.nom.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium text-sm truncate", isActive ? "text-foreground" : "text-foreground/80")}>{c.nom}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{c.type_campagne_display}</Badge>
                      {c.type_recompense !== "AUCUNE" && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0">
                          {c.type_recompense === "GOODIES" ? "🎁" : "🏷️"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: p1 }} />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="text-xs" style={{ background: hex(p1, 0.15), color: p1, borderColor: hex(p1, 0.3) }}>
                {campaign.type_campagne_display}
              </Badge>
              {campaign.type_recompense !== "AUCUNE" && (
                <Badge className="text-xs"
                  style={{
                    background: campaign.type_recompense === "GOODIES" ? hex("#10B981", 0.15) : hex("#3B82F6", 0.15),
                    color: campaign.type_recompense === "GOODIES" ? "#10B981" : "#3B82F6",
                  }}>
                  {campaign.type_recompense === "GOODIES" ? <><Gift className="w-3 h-3 mr-1" /> Goodies</> : <><Tag className="w-3 h-3 mr-1" /> Promos</>}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold">{campaign.nom}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Du {format(parseISO(campaign.date_debut), "dd MMMM yyyy", { locale: fr })} au {format(parseISO(campaign.date_fin), "dd MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-2 shadow-sm">
            <Calendar className="w-4 h-4 text-muted-foreground ml-2" />
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-44 border-0 bg-transparent focus:ring-0">
                <SelectValue placeholder="Choisir un jour..." />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {format(parseISO(date), "EEEE dd MMMM", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleExport} disabled={!selectedDate} className="gap-1" style={{ background: p1 }}>
              <Download className="w-4 h-4" /> Exporter
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {showTasting && (
            <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Dégustations</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COLORS.primary }}>{fmt(stats.totalTastings)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: hex(COLORS.primary, 0.1) }}>
                  <UtensilsCrossed className="w-6 h-6" style={{ color: COLORS.primary }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Note moyenne: {stats.avgRating}/5</p>
            </CardContent></Card>
          )}
          {showVente && (
            <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Ventes</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COLORS.secondary }}>{fmt(stats.totalVentes)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: hex(COLORS.secondary, 0.1) }}>
                  <ShoppingCart className="w-6 h-6" style={{ color: COLORS.secondary }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">CA: {fmt(stats.totalRevenue)} FCFA</p>
            </CardContent></Card>
          )}
          {showGoodies && (
            <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Goodies</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COLORS.success }}>{fmt(stats.goodiesDistribues)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: hex(COLORS.success, 0.1) }}>
                  <Gift className="w-6 h-6" style={{ color: COLORS.success }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Distribués aux clients</p>
            </CardContent></Card>
          )}
          {showPromotions && (
            <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Gains Promo</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: COLORS.info }}>{fmt(stats.gainsPromotions)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: hex(COLORS.info, 0.1) }}>
                  <Tag className="w-6 h-6" style={{ color: COLORS.info }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Promotions activées</p>
            </CardContent></Card>
          )}
          <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Conversion</p>
                <p className="text-2xl font-bold mt-1" style={{ color: COLORS.purple }}>{stats.conversionRate}%</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: hex(COLORS.purple, 0.1) }}>
                <TrendingUp className="w-6 h-6" style={{ color: COLORS.purple }} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Taux de conversion</p>
          </CardContent></Card>
        </div>

        {/* Promotions */}
        {showPromotions && campaign.promotions && campaign.promotions.length > 0 && (
          <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
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

        {/* Charts */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
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
                {showPromotions && <Area type="monotone" dataKey="gainsPromotions" stroke={COLORS.info} strokeWidth={2} fill="url(#gradPromos)" name="Gains Promo" dot={false} activeDot={{ r: 5 }} />}
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>

        {/* Site Breakdown */}
        {rapport && rapport.sites.length > 0 && (
          <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-500" /> Performance par site
              </CardTitle>
            </CardHeader>
            <CardContent><div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rapport.sites} margin={{ top: 5, right: 10, bottom: 30, left: -20 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="nom" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  {showTasting && <Bar dataKey="degustations" name="Dégustations" fill={COLORS.primary} radius={[4, 4, 0, 0]} />}
                  {showVente && <Bar dataKey="ventes" name="Ventes" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />}
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                </BarChart>
              </ResponsiveContainer>
            </div></CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CompanyCampaignSkeleton() {
  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      <div className="w-72 flex-shrink-0"><Skeleton className="h-full rounded-2xl" /></div>
      <div className="flex-1 space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
