"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Fragment, type ComponentType } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type {
  CampagneDetail,
  CampagneRapportSites,
  CampagneSiteRapport,
  SiteDetail,
  Degustation,
  Vente,
  GainPromotion,
  GainGoodie,
  JourAnimation,
  DonneesSiteJour,
  LivraisonGoodiesJour,
  TypeConditionnement,
} from "@/lib/types/backend";
import { DEFAULT_RAPPORT_CONFIG } from "@/lib/types/backend";
import CampaignReport from "@/components/Campaignreport";
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
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO, subDays, differenceInCalendarDays } from "date-fns";
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

function GaugeBar({ label, current, total, color, gradient, icon: Icon }: {
  label: string; current: number; total: number; color: string; gradient: string; icon?: ComponentType<{ className?: string }>;
}) {
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          {Icon && (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(color, 0.12) }}>
              <Icon className="w-3.5 h-3.5" />
            </span>
          )}
          {label}
        </span>
        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: hex(color, 0.12), color }}>{pct}%</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${gradient}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span><span className="font-semibold" style={{ color }}>{fmt(current)}</span> réalisés</span>
        <span>Objectif : {fmt(total)}</span>
      </div>
    </div>
  );
}

type ActionType = "deg" | "vente" | "promo" | "goodie";

function actionStyle(type: ActionType) {
  switch (type) {
    case "deg": return { dot: "bg-red-100", text: "text-red-600" };
    case "vente": return { dot: "bg-amber-100", text: "text-amber-600" };
    case "promo": return { dot: "bg-blue-100", text: "text-blue-600" };
    case "goodie": return { dot: "bg-emerald-100", text: "text-emerald-600" };
  }
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
  const [gainsGoodies, setGainsGoodies] = useState<GainGoodie[]>([]);
  const [joursAnimation, setJoursAnimation] = useState<JourAnimation[]>([]);
  const [donneesSiteJour, setDonneesSiteJour] = useState<DonneesSiteJour[]>([]);
  const [livraisons, setLivraisons] = useState<LivraisonGoodiesJour[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showAllActions, setShowAllActions] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const isFirstLoad = useRef(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCampaignData = useCallback(async () => {
    if (!campaignId) return;
    if (isFirstLoad.current) setLoading(true);
    // Le cache GET (30 s) coïnciderait avec l'intervalle de rafraîchissement (30 s) :
    // on le vide à chaque appel pour garantir des données réellement fraîches.
    invalidateCache();
    try {
      const [campRes, rapportRes, tastRes, ventesRes, gainsRes, gainsGoodiesRes, joursRes, donneesRes, livrRes] = await Promise.all([
        api.get<CampagneDetail>(`/campagnes/${campaignId}/`),
        api.get<CampagneRapportSites>(`/campagnes/${campaignId}/rapport-sites/`).catch(() => ({ data: null })),
        api.get<Degustation[]>(`/degustations/?campagne=${campaignId}`),
        api.get<Vente[]>(`/ventes/?campagne=${campaignId}`),
        api.get<GainPromotion[]>(`/gains-promotions/?campagne=${campaignId}`).catch(() => ({ data: [] })),
        api.get<GainGoodie[]>(`/gains-goodies/?campagne=${campaignId}`).catch(() => ({ data: [] })),
        api.get<JourAnimation[]>(`/jours-animation/?campagne=${campaignId}`).catch(() => ({ data: [] })),
        api.get<DonneesSiteJour[]>(`/donnees-site-jour/?campagne=${campaignId}`).catch(() => ({ data: [] })),
        api.get<LivraisonGoodiesJour[]>(`/livraisons-goodies/?campagne=${campaignId}`).catch(() => ({ data: [] })),
      ]);
      setCampaign(campRes.data);
      setRapport(rapportRes.data as CampagneRapportSites | null);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : (tastRes.data as { results?: Degustation[] }).results ?? []);
      setVentes(Array.isArray(ventesRes.data) ? ventesRes.data : (ventesRes.data as { results?: Vente[] }).results ?? []);
      const gainsData = Array.isArray(gainsRes.data) ? gainsRes.data : (gainsRes.data as { results?: GainPromotion[] }).results ?? [];
      setGainsPromotions(gainsData);
      const gainsGoodiesData = Array.isArray(gainsGoodiesRes.data) ? gainsGoodiesRes.data : (gainsGoodiesRes.data as { results?: GainGoodie[] }).results ?? [];
      setGainsGoodies(gainsGoodiesData);
      setJoursAnimation(Array.isArray(joursRes.data) ? joursRes.data : (joursRes.data as { results?: JourAnimation[] }).results ?? []);
      setDonneesSiteJour(Array.isArray(donneesRes.data) ? donneesRes.data : (donneesRes.data as { results?: DonneesSiteJour[] }).results ?? []);
      setLivraisons(Array.isArray(livrRes.data) ? livrRes.data : (livrRes.data as { results?: LivraisonGoodiesJour[] }).results ?? []);

      // Fetch site details with team info
      if (rapportRes.data && (rapportRes.data as CampagneRapportSites).sites?.length) {
        const sitePromises = (rapportRes.data as CampagneRapportSites).sites.map(s =>
          api.get<SiteDetail>(`/sites/${s.id}/`).catch(() => null)
        );
        const results = await Promise.all(sitePromises);
        setSiteDetails(results.filter(r => r?.data).map(r => r!.data) as SiteDetail[]);
      }
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
    isFirstLoad.current = false;
  }, [campaignId]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/auth/login"); return; }
      if (user.role !== "Entreprise") { router.push("/dashboard"); return; }
      if (campaignId) {
        fetchCampaignData();
        refreshTimer.current = setInterval(fetchCampaignData, 30000);
        return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
      }
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
  const showPacks = ventes.some(v => v.conditionnement === "PACK");

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
    const totalPacks = ventes.filter(v => v.conditionnement === "PACK").length;
    return { totalTastings, totalVentes, totalRevenue, conversionRate, avgRating, goodiesDistribues, totalGoodiesAlloues, gainsPromotions, totalPacks };
  }, [tastings, ventes, rapport]);

  const dateInfo = useMemo(() => {
    if (!campaign) return { joursEcoules: 0, joursRestants: 0, dureeJours: 0, nbEquipe: 0 };
    const today = new Date();
    const start = parseISO(campaign.date_debut);
    const end = parseISO(campaign.date_fin);
    const dureeJours = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const joursEcoules = Math.min(dureeJours, Math.max(0, differenceInCalendarDays(today, start) + 1));
    const joursRestants = Math.max(0, differenceInCalendarDays(end, today));
    const nbEquipe = (campaign.hotesses?.length ?? 0) + (campaign.superviseurs?.length ?? 0);
    return { joursEcoules, joursRestants, dureeJours, nbEquipe };
  }, [campaign]);

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

  const genreData = useMemo(() => {
    const counts: Record<string, number> = {};
    tastings.forEach(t => { counts[t.genre_display] = (counts[t.genre_display] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tastings]);

  const ageData = useMemo(() => {
    const order: string[] = [];
    const counts: Record<string, number> = {};
    tastings.forEach(t => {
      if (!(t.tranche_age_display in counts)) order.push(t.tranche_age_display);
      counts[t.tranche_age_display] = (counts[t.tranche_age_display] ?? 0) + 1;
    });
    return order.sort().map(tranche => ({ tranche, total: counts[tranche] }));
  }, [tastings]);

  const produitsRanking = useMemo(() => {
    if (!rapport) return [];
    const map: Record<string, { degustations: number; ventes: number }> = {};
    rapport.sites.forEach(site => {
      (site.produits ?? []).forEach(p => {
        if (!map[p.produit_nom]) map[p.produit_nom] = { degustations: 0, ventes: 0 };
        map[p.produit_nom].degustations += p.degustations;
        map[p.produit_nom].ventes += p.ventes;
      });
    });
    return Object.entries(map)
      .map(([nom, v]) => ({ nom, ...v, total: v.degustations + v.ventes }))
      .sort((a, b) => b.total - a.total);
  }, [rapport]);

  const mecaniquePromoSites = useMemo(() => {
    if (!rapport) return [];
    return rapport.sites
      .map(site => ({
        nom: site.nom,
        vendus: ventes.filter(v => v.site_nom === site.nom && v.type_vente === "NORMAL").length,
        offerts: gainsPromotions.filter(g => g.site_nom === site.nom && g.type_promotion === "OFFERT").length,
        goodies: gainsPromotions.filter(g => g.site_nom === site.nom && g.type_promotion === "GAGNE").length,
        tirages: gainsPromotions.filter(g => g.site_nom === site.nom && g.type_promotion === "TIRAGE").length,
      }))
      .filter(s => s.vendus + s.offerts + s.goodies + s.tirages > 0);
  }, [rapport, ventes, gainsPromotions]);

  const mecaniquePromoTotaux = useMemo(() => {
    const vendus = ventes.filter(v => v.type_vente === "NORMAL").length;
    const offerts = gainsPromotions.filter(g => g.type_promotion === "OFFERT").length;
    const goodies = gainsPromotions.filter(g => g.type_promotion === "GAGNE").length;
    const tirages = gainsPromotions.filter(g => g.type_promotion === "TIRAGE").length;
    return { vendus, offerts, goodies, tirages };
  }, [ventes, gainsPromotions]);

  const condLabel = (cond: TypeConditionnement) => (cond === "PACK" ? "Packs" : "Unités");

  // Conditionnements réellement utilisés par les ventes/offres de la campagne
  const conditionnementsPresents = useMemo(() => {
    const set = new Set<TypeConditionnement>();
    ventes.forEach(v => { if (v.type_vente === "NORMAL") set.add(v.conditionnement); });
    gainsPromotions.forEach(g => { if (g.type_promotion === "OFFERT") set.add(g.conditionnement); });
    return (["UNITE", "PACK"] as TypeConditionnement[]).filter(c => set.has(c));
  }, [ventes, gainsPromotions]);

  const hasTombola = gainsPromotions.some(g => g.type_promotion === "TIRAGE");
  const hasGoodiesPromo = gainsPromotions.some(g => g.type_promotion === "GAGNE");

  // ── Performance par PDV — répartition vendus/offerts par conditionnement, tirages, goodies ──
  const pdvPerformance = useMemo(() => {
    if (!rapport) return [];
    return rapport.sites.map(site => {
      const parCond: Record<string, { vendus: number; offerts: number }> = {};
      let total = 0;
      conditionnementsPresents.forEach(cond => {
        const vendus = ventes.filter(v => v.site_nom === site.nom && v.type_vente === "NORMAL" && v.conditionnement === cond).length;
        const offerts = gainsPromotions.filter(g => g.site_nom === site.nom && g.type_promotion === "OFFERT" && g.conditionnement === cond).length;
        parCond[cond] = { vendus, offerts };
        total += vendus + offerts;
      });
      const tirages = gainsPromotions.filter(g => g.site_nom === site.nom && g.type_promotion === "TIRAGE").length;
      const goodies = gainsPromotions.filter(g => g.site_nom === site.nom && g.type_promotion === "GAGNE").length;
      total += tirages + goodies;
      return { nom: site.nom, parCond, tirages, goodies, total };
    });
  }, [rapport, ventes, gainsPromotions, conditionnementsPresents]);

  const pdvTotaux = useMemo(() => {
    const parCond: Record<string, { vendus: number; offerts: number }> = {};
    conditionnementsPresents.forEach(cond => {
      parCond[cond] = {
        vendus: pdvPerformance.reduce((s, p) => s + (p.parCond[cond]?.vendus ?? 0), 0),
        offerts: pdvPerformance.reduce((s, p) => s + (p.parCond[cond]?.offerts ?? 0), 0),
      };
    });
    return {
      parCond,
      tirages: pdvPerformance.reduce((s, p) => s + p.tirages, 0),
      goodies: pdvPerformance.reduce((s, p) => s + p.goodies, 0),
      total: pdvPerformance.reduce((s, p) => s + p.total, 0),
    };
  }, [pdvPerformance, conditionnementsPresents]);

  // ── Mécaniques promotionnelles configurées — texte généré dynamiquement ──
  const mecaniqueRules = useMemo(() => {
    if (!campaign?.promotions) return [];
    return campaign.promotions.filter(p => p.is_active).map(p => {
      const label = condLabel(p.conditionnement).toLowerCase();
      const requise = `${fmt(p.quantite_requise)} ${label} acheté${p.quantite_requise > 1 ? "s" : ""}`;
      if (p.type_promotion === "OFFERT") {
        return `${requise} → ${fmt(p.quantite_offerte)} offert${p.quantite_offerte > 1 ? "s" : ""}`;
      }
      if (p.type_promotion === "TIRAGE") {
        return `${requise} → 1 ticket tombola`;
      }
      return `${requise} → ${p.recompense_description}`;
    });
  }, [campaign]);

  const [selectedMecaniqueSite, setSelectedMecaniqueSite] = useState<string>("");

  useEffect(() => {
    if (!selectedMecaniqueSite && mecaniquePromoSites.length > 0) {
      setSelectedMecaniqueSite(mecaniquePromoSites[0].nom);
    }
  }, [mecaniquePromoSites, selectedMecaniqueSite]);

  const mecaniqueSiteDaily = useMemo(() => {
    if (!selectedMecaniqueSite) return [];
    const dates = new Set<string>();
    ventes.forEach(v => { if (v.site_nom === selectedMecaniqueSite) dates.add(v.created_at.slice(0, 10)); });
    gainsPromotions.forEach(g => { if (g.site_nom === selectedMecaniqueSite) dates.add(g.created_at.slice(0, 10)); });
    return Array.from(dates).sort().map(d => ({
      date: format(parseISO(d), "dd MMM", { locale: fr }),
      vendus: ventes.filter(v => v.site_nom === selectedMecaniqueSite && v.type_vente === "NORMAL" && v.created_at.slice(0, 10) === d).length,
      offerts: gainsPromotions.filter(g => g.site_nom === selectedMecaniqueSite && g.type_promotion === "OFFERT" && g.created_at.slice(0, 10) === d).length,
      goodies: gainsPromotions.filter(g => g.site_nom === selectedMecaniqueSite && g.type_promotion === "GAGNE" && g.created_at.slice(0, 10) === d).length,
      tirages: gainsPromotions.filter(g => g.site_nom === selectedMecaniqueSite && g.type_promotion === "TIRAGE" && g.created_at.slice(0, 10) === d).length,
    }));
  }, [selectedMecaniqueSite, ventes, gainsPromotions]);

  const promoGainCounts = useMemo(() => {
    const map: Record<string, { gains: number; unitesOffertes: number; tirages: number }> = {};
    gainsPromotions.forEach(g => {
      if (!map[g.promotion]) map[g.promotion] = { gains: 0, unitesOffertes: 0, tirages: 0 };
      if (g.type_promotion === "TIRAGE") map[g.promotion].tirages += 1;
      else {
        map[g.promotion].gains += 1;
        map[g.promotion].unitesOffertes += g.quantite_offerte;
      }
    });
    return map;
  }, [gainsPromotions]);

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

  // ── Données mappées pour le bouton "Bilan final" (CampaignReport) ──
  const campaignForReport = useMemo(() => campaign ? {
    id: campaign.id,
    company_id: "",
    name: campaign.nom,
    description: campaign.description ?? undefined,
    start_date: campaign.date_debut,
    end_date: campaign.date_fin,
    sales_objective: campaign.objectif_ventes ?? 0,
    tasting_objective: campaign.objectif_degustations ?? 0,
    status: "active" as const,
    created_at: "",
    updated_at: "",
    company: {
      id: "",
      name: campaign.entreprise_nom,
      color: campaign.couleur_primaire,
      logoUrl: campaign.logo_url ?? undefined,
      created_at: "",
      updated_at: "",
    },
  } : null, [campaign]);

  const tastingsForReport = useMemo(() => campaign ? tastings.map(t => ({
    id: t.id,
    campaign_id: campaign.id,
    hostess_id: t.hotesse,
    product_id: t.produit,
    gender: "female" as const,
    age_range: "18-25" as const,
    taste_rating: "3" as const,
    purchase_intent: "medium" as const,
    has_purchased: t.a_achete,
    site_id: t.site,
    created_at: t.created_at,
    hostess_name: t.hotesse_nom,
    site_name: t.site_nom,
    product_name: t.produit_nom,
    nom_client: t.nom_client,
    tranche_age_display: t.tranche_age_display,
    intention_achat_display: t.intention_achat_display,
    note_gout: t.note_gout,
    note_ambiance: t.note_ambiance,
    a_achete: t.a_achete,
  })) : [], [tastings, campaign]);

  const salesForReport = useMemo(() => campaign ? ventes.map(v => ({
    id: v.id,
    campaign_id: campaign.id,
    hostess_id: v.hotesse,
    product_id: v.produit,
    quantity: v.quantite,
    unit_price: 0,
    total_amount: parseFloat(v.prix_total ?? "0"),
    validated: true,
    created_at: v.created_at,
    type_vente: v.type_vente,
    est_achat_promo: v.est_achat_promo,
  })) : [], [ventes, campaign]);

  const teamForReport = useMemo(() => campaign ? campaign.hotesses.map(h => ({
    id: h.id,
    campaign_id: campaign.id,
    user_id: h.id,
    role: "hostess" as const,
    assigned_at: "",
    user: { id: h.id, full_name: h.name, email: h.email ?? "", role: "hostess" as const, is_active: true, created_at: "", updated_at: "" },
  })) : [], [campaign]);

  const sitesForReport = useMemo(() => (rapport?.sites ?? []).map(s => ({
    id: s.id,
    campaign_id: campaign?.id ?? "",
    zone_id: "",
    name: s.nom,
    address: s.ville || "",
  })), [rapport, campaign]);

  const userForReport = useMemo(() => user ? {
    id: (user as any).id ?? "",
    email: (user as any).email ?? "",
    full_name: (user as any).name ?? "",
    role: "company" as const,
    is_active: true,
    created_at: "",
    updated_at: "",
  } : null, [user]);

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
            <nav aria-label="breadcrumb" className="text-xs mb-2">
              <Link href="/dashboard/company" className="text-white/60 hover:text-white/90 transition-colors">Mes campagnes</Link>
              <span className="text-white/60"> / </span>
              <span className="text-white/90">{campaign.nom}</span>
            </nav>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-white/25 text-white border-white/40 text-xs backdrop-blur-sm">
                {campaign.type_campagne_display}
              </Badge>
              {campaign.type_recompense !== "AUCUNE" && (
                <Badge className="bg-white/25 text-white border-white/40 text-xs backdrop-blur-sm">
                  {campaign.type_recompense === "GOODIES" ? "🎁 Goodies" : "🏷️ Promotions"}
                </Badge>
              )}
              <Badge className={`text-xs backdrop-blur-sm border-0 ${dateInfo.joursRestants > 0 || new Date(campaign.date_fin) >= new Date() ? "bg-emerald-500/40 text-white" : "bg-white/20 text-white/80"}`}>
                {new Date(campaign.date_fin) >= new Date() ? "Active" : "Terminée"}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">{campaign.nom}</h1>
            {campaign.description && (
              <p className="text-white/70 text-sm mt-1 max-w-2xl">{campaign.description}</p>
            )}
            <p className="text-white/80 text-sm mt-1">
              Du {format(parseISO(campaign.date_debut), "dd MMM yyyy", { locale: fr })} au {format(parseISO(campaign.date_fin), "dd MMM yyyy", { locale: fr })}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {[
                { label: "j. écoulés", value: dateInfo.joursEcoules },
                { label: "j. restants", value: dateInfo.joursRestants },
                { label: "PDV actifs", value: rapport?.sites.length ?? 0 },
                { label: "équipe", value: dateInfo.nbEquipe },
              ].map((chip) => (
                <div key={chip.label} className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <span className="text-sm font-bold">{fmt(chip.value)}</span>
                  <span className="text-xs text-white/70">{chip.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status bar : auto-refresh + exports ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Mis à jour : {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span className="hidden sm:inline">· Actualisation toutes les 30 s</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="h-9 w-44 text-xs rounded-lg border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
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
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!selectedDate} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export par jour
          </Button>
          {campaignForReport && userForReport && (
            <CampaignReport
              campaign={campaignForReport as any}
              user={userForReport as any}
              tastings={tastingsForReport as any}
              sales={salesForReport as any}
              team={teamForReport as any}
              sites={sitesForReport as any}
              horaires={joursAnimation as any}
              donneesSiteJour={donneesSiteJour}
              livraisons={livraisons}
              reportConfig={DEFAULT_RAPPORT_CONFIG}
              label="Bilan final"
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="global" className="gap-4">
        <TabsList className="sticky top-0 z-10 w-full justify-start overflow-x-auto bg-background/95 backdrop-blur-sm border border-slate-100 rounded-xl h-auto p-1 gap-1">
          <TabsTrigger value="global" className="gap-1.5 rounded-lg"><BarChart3 className="w-4 h-4" />Vue globale</TabsTrigger>
          <TabsTrigger value="sites" className="gap-1.5 rounded-lg"><MapPin className="w-4 h-4" />Sites</TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5 rounded-lg"><Activity className="w-4 h-4" />Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-6">
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
              <p className="text-white/80 text-xs mt-1">Interactions consommateurs</p>
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
              <p className="text-white/80 text-xs mt-1">Distributions réalisées</p>
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
              <p className="text-white/80 text-xs mt-1">Récompenses offertes</p>
            </div>
          </div>
        )}
        {showPacks && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-400 p-5 text-white shadow-xl shadow-violet-200/40 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-white/25 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold">{fmt(stats.totalPacks)}</div>
              <p className="text-white/80 text-xs mt-1">Packs distribués</p>
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
              label="Distribution réalisée"
              current={stats.totalVentes}
              total={campaign.objectif_ventes}
              color={COLORS.secondary}
              gradient="from-amber-500 to-yellow-400"
              icon={ShoppingCart}
            />
          )}
          {showTasting && campaign.objectif_degustations && (
            <GaugeBar
              label="Dégustations"
              current={stats.totalTastings}
              total={campaign.objectif_degustations}
              color={COLORS.primary}
              gradient="from-red-500 to-orange-400"
              icon={UtensilsCrossed}
            />
          )}
          {showGoodies && stats.totalGoodiesAlloues > 0 && (
            <GaugeBar
              label="Goodies distribués"
              current={stats.goodiesDistribues}
              total={stats.totalGoodiesAlloues}
              color={COLORS.success}
              gradient="from-emerald-500 to-teal-400"
              icon={Gift}
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
              {campaign.promotions.filter((p) => p.is_active).map((promo) => {
                const counts = promoGainCounts[promo.id] ?? { gains: 0, unitesOffertes: 0, tirages: 0 };
                return (
                  <div key={promo.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
                    <Badge className="text-[10px]"
                      style={{
                        background: promo.type_promotion === "OFFERT" ? hex("#10B981", 0.2) : hex("#F59E0B", 0.2),
                        color: promo.type_promotion === "OFFERT" ? "#10B981" : "#F59E0B",
                      }}>
                      {promo.type_promotion === "TIRAGE" ? "🎡 Tirage" : promo.type_promotion === "OFFERT" ? "🎁 Offert" : "🏆 À gagner"}
                    </Badge>
                    <p className="font-medium text-sm">Achetez <span className="text-blue-700 font-bold">{promo.quantite_requise}</span> produit{promo.quantite_requise > 1 ? "s" : ""}</p>
                    <p className="text-sm text-muted-foreground">→ {promo.recompense_description}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-blue-100 text-xs">
                      <span className="text-muted-foreground">
                        {promo.type_promotion === "TIRAGE" ? "Tirages effectués" : "Gains enregistrés"}
                      </span>
                      <span className="font-bold text-blue-700">
                        {fmt(promo.type_promotion === "TIRAGE" ? counts.tirages : counts.gains)}
                      </span>
                    </div>
                  </div>
                );
              })}
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
        <CardContent><div className="overflow-x-auto">
        <div className="h-80 min-w-[600px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <defs>
                {showTasting && <linearGradient id="gradTastings" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.primary} stopOpacity={0}/></linearGradient>}
                {showVente && <linearGradient id="gradVentes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.secondary} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.secondary} stopOpacity={0}/></linearGradient>}
                {showGoodies && <linearGradient id="gradGoodies" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.success} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.success} stopOpacity={0}/></linearGradient>}
                {showPromotions && <linearGradient id="gradPromos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.info} stopOpacity={0.5}/><stop offset="100%" stopColor={COLORS.info} stopOpacity={0}/></linearGradient>}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(0,0,0,0.06)", strokeWidth: 2 }} />
              {showTasting && <Area key="degustations" type="monotone" dataKey="degustations" stroke={COLORS.primary} strokeWidth={2} fill="url(#gradTastings)" name="Dégustations" dot={false} activeDot={{ r: 5 }} />}
              {showVente && <Area key="ventes" type="monotone" dataKey="ventes" stroke={COLORS.secondary} strokeWidth={2} fill="url(#gradVentes)" name="Ventes" dot={false} activeDot={{ r: 5 }} />}
              {showGoodies && <Area key="goodiesDistribues" type="monotone" dataKey="goodiesDistribues" stroke={COLORS.success} strokeWidth={2} fill="url(#gradGoodies)" name="Goodies" dot={false} activeDot={{ r: 5 }} />}
              {showPromotions && <Area key="gainsPromotions" type="monotone" dataKey="gainsPromotions" stroke={COLORS.info} strokeWidth={2} fill="url(#gradPromos)" name="Récompenses offertes" dot={false} activeDot={{ r: 5 }} />}
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div></div></CardContent>
      </Card>

      {genreData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: p1 }} /> Profil consommateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genreData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {genreData.map((entry, idx) => (
                        <Cell key={entry.name} fill={idx === 0 ? p1 : p2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: p1 }} /> Tranches d&apos;âge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="tranche" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="total" name="Dégustations" fill={p1} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {produitsRanking.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: p1 }} /> Performance produits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const max = Math.max(1, ...produitsRanking.map(p => p.total));
              return produitsRanking.map(p => (
                <div key={p.nom} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{p.nom}</span>
                    <span className="font-bold" style={{ color: p1 }}>{fmt(p.total)}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((p.total / max) * 100)}%`, background: `linear-gradient(90deg, ${p1}, ${p2})` }} />
                  </div>
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="sites" className="space-y-6">
      {/* ── Performance par site — graphique ── */}
      {rapport && rapport.sites.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-red-500" /> Performance par site
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rapport.sites.map(s => ({ nom: s.nom, degustations: s.degustations, ventes: s.ventes }))} margin={{ top: 5, right: 10, bottom: 30, left: -10 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                  <XAxis dataKey="nom" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                  {showTasting && <Bar key="degustations" dataKey="degustations" name="Dégustations" fill={COLORS.primary} radius={[4, 4, 0, 0]} />}
                  {showVente && <Bar key="ventes" dataKey="ventes" name="Ventes" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />}
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
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
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
      {/* ── Dernières actions sur les sites ── */}
      {(tastings.length > 0 || ventes.length > 0 || gainsPromotions.length > 0 || gainsGoodies.length > 0) && (() => {
        const actions = [
          ...tastings.slice(-50).map(t => ({
            id: `deg-${t.id}`, type: "deg" as ActionType, emoji: "🍺",
            label: t.produit_nom, badge: "Dégust.",
            site: t.site_nom,
            agent: t.hotesse_nom,
            meta: t.a_achete ? "acheté" : `note ${t.note_gout}/5`,
            date: t.created_at,
          })),
          ...ventes.slice(-50).map(v => ({
            id: `vente-${v.id}`, type: "vente" as ActionType, emoji: "🛒",
            label: v.produit_nom, badge: "Vente",
            site: v.site_nom,
            agent: v.hotesse_nom,
            meta: v.prix_total ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(Number(v.prix_total)) : "",
            date: v.created_at,
          })),
          ...gainsPromotions.slice(-50).map(g => {
            const emoji = g.type_promotion === "TIRAGE" ? "🎡" : g.type_promotion === "GAGNE" ? "🏆" : g.conditionnement === "PACK" ? "📦" : "🥤";
            const label = g.type_promotion === "TIRAGE" ? "Ticket tombola" : g.type_promotion === "GAGNE" ? "Lot remporté" : g.conditionnement === "PACK" ? "Pack offert" : "Produit offert";
            const badge = g.type_promotion === "TIRAGE" ? "Tirage" : g.type_promotion === "GAGNE" ? "Gain" : "Offert";
            return {
              id: `promo-${g.id}`, type: "promo" as ActionType, emoji,
              label, badge,
              site: g.site_nom,
              agent: g.hotesse_nom,
              meta: g.promotion_description,
              date: g.created_at,
            };
          }),
          ...gainsGoodies.slice(-50).map(g => ({
            id: `goodie-${g.id}`, type: "goodie" as ActionType, emoji: "🎁",
            label: "Goodie distribué", badge: "Goodie",
            site: g.site_nom,
            agent: g.hotesse_nom,
            meta: g.goodie_nom,
            date: g.created_at,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const newestId = actions[0]?.id;

        if (!showAllActions) {
          const recent = actions.slice(0, 10);
          return (
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" /> Dernières actions
                  <Badge className="ml-auto bg-slate-100 text-slate-600 border-0 text-xs font-normal">{actions.length} au total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  {recent.map((a, i) => {
                    const style = actionStyle(a.type);
                    return (
                      <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 ${
                        i < recent.length - 1 ? "border-b border-slate-50" : ""
                      } ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${style?.dot}`}>
                          {a.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-foreground truncate">{a.label}</p>
                            <Badge className={`text-[9px] border-0 shrink-0 ${style?.dot} ${style?.text}`}>{a.badge}</Badge>
                            {a.id === newestId && (
                              <Badge className="text-[9px] border-0 shrink-0 bg-emerald-500 text-white animate-pulse">Nouveau</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{a.site} · {a.agent} · {a.meta}</p>
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
                    );
                  })}
                </div>
                {actions.length > 10 && (
                  <button type="button" onClick={() => setShowAllActions(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 py-2 rounded-lg hover:bg-emerald-50 transition-colors">
                    Voir tout ({actions.length}) <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </CardContent>
            </Card>
          );
        }

        const siteNames = [...new Set(actions.map(a => a.site))];

        return (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" /> Dernières actions sur les sites
                <Badge className="ml-auto bg-slate-100 text-slate-600 border-0 text-xs font-normal">{actions.length} action{actions.length > 1 ? "s" : ""}</Badge>
                <button type="button" onClick={() => setShowAllActions(false)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1">
                  Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                </button>
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
                      {siteActions.map((a, i) => {
                        const style = actionStyle(a.type);
                        return (
                          <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 ${
                            i < siteActions.length - 1 ? "border-b border-slate-50" : ""
                          } ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${style?.dot}`}>
                              {a.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-foreground truncate">{a.label}</p>
                                <Badge className={`text-[9px] border-0 shrink-0 ${style?.dot} ${style?.text}`}>{a.badge}</Badge>
                                {a.id === newestId && (
                                  <Badge className="text-[9px] border-0 shrink-0 bg-emerald-500 text-white animate-pulse">Nouveau</Badge>
                                )}
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}
        </TabsContent>

        <TabsContent value="sites" className="space-y-6">
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
                          <p className="text-xs font-semibold text-blue-800">Récompenses sur ce site</p>
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

      {/* ── Mécaniques promotionnelles ── */}
      {showPromotions && mecaniquePromoSites.length > 0 && (
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" /> Mécaniques promotionnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                <p className="text-xl font-bold" style={{ color: COLORS.secondary }}>{fmt(mecaniquePromoTotaux.vendus)}</p>
                <p className="text-[11px] text-muted-foreground">produits vendus</p>
              </div>
              {mecaniquePromoTotaux.offerts > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  <p className="text-xl font-bold" style={{ color: COLORS.info }}>{fmt(mecaniquePromoTotaux.offerts)}</p>
                  <p className="text-[11px] text-muted-foreground">produits offerts</p>
                </div>
              )}
              {mecaniquePromoTotaux.goodies > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  <p className="text-xl font-bold" style={{ color: COLORS.success }}>{fmt(mecaniquePromoTotaux.goodies)}</p>
                  <p className="text-[11px] text-muted-foreground">goodies distribués</p>
                </div>
              )}
              {mecaniquePromoTotaux.tirages > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center">
                  <p className="text-xl font-bold" style={{ color: COLORS.purple }}>{fmt(mecaniquePromoTotaux.tirages)}</p>
                  <p className="text-[11px] text-muted-foreground">tirages effectués</p>
                </div>
              )}
            </div>

            {/* ── Performance par PDV (point de vente) ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Performance par PDV (point de vente)</p>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Site</th>
                      {conditionnementsPresents.map(cond => (
                        <Fragment key={cond}>
                          <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">{condLabel(cond)} vendues</th>
                          <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">{condLabel(cond)} offertes</th>
                        </Fragment>
                      ))}
                      {hasTombola && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Tickets tombola</th>}
                      {hasGoodiesPromo && <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Goodies</th>}
                      <th className="text-right text-xs font-semibold text-foreground px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdvPerformance.map((row, idx) => (
                      <tr key={row.nom} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{row.nom}</td>
                        {conditionnementsPresents.map(cond => (
                          <Fragment key={cond}>
                            <td className="px-4 py-3 text-right font-semibold" style={{ color: COLORS.secondary }}>{fmt(row.parCond[cond]?.vendus ?? 0)}</td>
                            <td className="px-4 py-3 text-right font-semibold" style={{ color: COLORS.info }}>{fmt(row.parCond[cond]?.offerts ?? 0)}</td>
                          </Fragment>
                        ))}
                        {hasTombola && <td className="px-4 py-3 text-right font-semibold" style={{ color: COLORS.purple }}>{fmt(row.tirages)}</td>}
                        {hasGoodiesPromo && <td className="px-4 py-3 text-right font-semibold" style={{ color: COLORS.success }}>{fmt(row.goodies)}</td>}
                        <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 font-bold text-sm text-foreground">Total</td>
                      {conditionnementsPresents.map(cond => (
                        <Fragment key={cond}>
                          <td className="px-4 py-3 text-right font-bold" style={{ color: COLORS.secondary }}>{fmt(pdvTotaux.parCond[cond]?.vendus ?? 0)}</td>
                          <td className="px-4 py-3 text-right font-bold" style={{ color: COLORS.info }}>{fmt(pdvTotaux.parCond[cond]?.offerts ?? 0)}</td>
                        </Fragment>
                      ))}
                      {hasTombola && <td className="px-4 py-3 text-right font-bold" style={{ color: COLORS.purple }}>{fmt(pdvTotaux.tirages)}</td>}
                      {hasGoodiesPromo && <td className="px-4 py-3 text-right font-bold" style={{ color: COLORS.success }}>{fmt(pdvTotaux.goodies)}</td>}
                      <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(pdvTotaux.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ── Mécaniques configurées (texte généré depuis les promotions actives) ── */}
            {mecaniqueRules.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Mécaniques
                </p>
                <p className="text-sm text-amber-900">{mecaniqueRules.join(" · ")}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Écoulement par site</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mecaniquePromoSites} margin={{ top: 5, right: 10, bottom: 30, left: -10 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar key="vendus" dataKey="vendus" name="Produits vendus" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
                    {mecaniquePromoTotaux.offerts > 0 && <Bar key="offerts" dataKey="offerts" name="Produits offerts" fill={COLORS.info} radius={[4, 4, 0, 0]} />}
                    {mecaniquePromoTotaux.goodies > 0 && <Bar key="goodies" dataKey="goodies" name="Goodies distribués" fill={COLORS.success} radius={[4, 4, 0, 0]} />}
                    {mecaniquePromoTotaux.tirages > 0 && <Bar key="tirages" dataKey="tirages" name="Tirages" fill={COLORS.purple} radius={[4, 4, 0, 0]} />}
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
                        <p className="text-sm font-bold" style={{ color: COLORS.secondary }}>{fmt(s.vendus)}</p>
                        <p className="text-[10px] text-muted-foreground">vendus</p>
                      </div>
                      {mecaniquePromoTotaux.offerts > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                          <p className="text-sm font-bold" style={{ color: COLORS.info }}>{fmt(s.offerts)}</p>
                          <p className="text-[10px] text-muted-foreground">offerts</p>
                        </div>
                      )}
                      {mecaniquePromoTotaux.goodies > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                          <p className="text-sm font-bold" style={{ color: COLORS.success }}>{fmt(s.goodies)}</p>
                          <p className="text-[10px] text-muted-foreground">goodies</p>
                        </div>
                      )}
                      {mecaniquePromoTotaux.tirages > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                          <p className="text-sm font-bold" style={{ color: COLORS.purple }}>{fmt(s.tirages)}</p>
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
                          <Bar key="vendus" dataKey="vendus" name="Vendus" fill={COLORS.secondary} radius={[3, 3, 0, 0]} />
                          {mecaniquePromoTotaux.offerts > 0 && <Bar key="offerts" dataKey="offerts" name="Offerts" fill={COLORS.info} radius={[3, 3, 0, 0]} />}
                          {mecaniquePromoTotaux.goodies > 0 && <Bar key="goodies" dataKey="goodies" name="Goodies" fill={COLORS.success} radius={[3, 3, 0, 0]} />}
                          {mecaniquePromoTotaux.tirages > 0 && <Bar key="tirages" dataKey="tirages" name="Tirages" fill={COLORS.purple} radius={[3, 3, 0, 0]} />}
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
        </TabsContent>
      </Tabs>
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
