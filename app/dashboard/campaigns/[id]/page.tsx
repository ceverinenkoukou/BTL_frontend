"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type {
  CampagneDetail, Degustation, Vente, SiteList, MonSiteInfo,
  CreateDegustationPayload, TrancheAge, IntentionAchat, TypeConditionnement,
  CampagneRapportSites, TypePromotion, Goodie,
} from "@/lib/types/backend";
import { getGoodiesByCampagne } from "@/lib/services/goodieService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Target, Users, Building2,
  UtensilsCrossed, ShoppingCart, TrendingUp, BarChart3,
  Sparkles, Star, Plus, Loader2, CheckCircle2, Edit,
  Frown, Meh, Smile, Laugh, Heart, Gift, Trophy, RotateCcw, MapPin, Package, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  CampaignProduitSensoryCard,
  computeProduitSensoryStats,
} from "@/components/dashboard/campaign-produit-sensory-stats";

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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

const AGE_OPTIONS: { value: TrancheAge; label: string }[] = [
  { value: "MOINS_18", label: "Moins de 18 ans" },
  { value: "18_25",    label: "18 – 25 ans" },
  { value: "26_35",    label: "26 – 35 ans" },
  { value: "36_50",    label: "36 – 50 ans" },
  { value: "PLUS_50",  label: "Plus de 50 ans" },
];

const INTENT_OPTIONS: { value: IntentionAchat; label: string; color: string }[] = [
  { value: "FAIBLE",  label: "Faible",  color: "bg-red-100 text-red-700 border-red-200" },
  { value: "MOYENNE", label: "Moyenne", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "ELEVEE",  label: "Élevée",  color: "bg-green-100 text-green-700 border-green-200" },
];

const RATING_ICONS: { rating: number; icon: React.ReactNode; label: string }[] = [
  { rating: 1, icon: <Frown className="w-7 h-7" />,  label: "Mauvais"   },
  { rating: 2, icon: <Meh className="w-7 h-7" />,    label: "Bof"       },
  { rating: 3, icon: <Smile className="w-7 h-7" />,  label: "Correct"   },
  { rating: 4, icon: <Laugh className="w-7 h-7" />,  label: "Bon"       },
  { rating: 5, icon: <Heart className="w-7 h-7" />,  label: "Excellent" },
];

const WHEEL_COLORS = ["#f97316","#3b82f6","#22c55e","#eab308","#ec4899","#8b5cf6","#14b8a6","#ef4444"];

const EMPTY_DEG_FORM = {
  site:            "",
  produit:         "",
  tranche_age:     "" as TrancheAge | "",
  note_gout:       0,
  intention_achat: "" as IntentionAchat | "",
  nom_client:      "",
  promotion_selectionnee: "" as string | "",
};

const PROMO_TYPE_STYLES: Record<TypePromotion, { bg: string; border: string; text: string; icon: string; label: string }> = {
  OFFERT: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: "🎁",
    label: "Produit offert",
  },
  GAGNE: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: "🎲",
    label: "À gagner",
  },
};

export default function CampaignDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<CampagneDetail | null>(null);
  const [tastings, setTastings] = useState<Degustation[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [loading, setLoading] = useState(true);

  const isHostess = user?.role === "Hotesse";
  const isAdmin = user?.role === "Administrateur";
  const isEntreprise = user?.role === "Entreprise";

  const [degForm, setDegForm] = useState({ ...EMPTY_DEG_FORM });
  const [savingDeg, setSavingDeg] = useState(false);
  const [loadingSite, setLoadingSite] = useState(false);
  const [siteInfo, setSiteInfo] = useState<MonSiteInfo | null>(null);
  const [campaignSites, setCampaignSites] = useState<SiteList[]>([]);
  const [siteRapport, setSiteRapport] = useState<CampagneRapportSites | null>(null);

  const [promoGains, setPromoGains] = useState<Record<string, number>>({});
  const [savingGain, setSavingGain] = useState<string | null>(null);
  const [promoAction, setPromoAction] = useState<Record<string, "OFFERT" | "GAGNE">>({});
  const [gainClientName, setGainClientName] = useState("");
  const [gainClientAge, setGainClientAge] = useState<TrancheAge | "">("");

  const [goodies, setGoodies] = useState<Goodie[]>([]);

  const [wheelClientName, setWheelClientName] = useState("");
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const wheelRotationRef = useRef(0);
  const [activeWheelPromoId, setActiveWheelPromoId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const requests: Promise<unknown>[] = [
        api.get<CampagneDetail>(`/campagnes/${id}/`),
        api.get<Degustation[]>("/degustations/"),
        api.get<Vente[]>("/ventes/"),
        api.get<SiteList[]>("/sites/"),
      ];
      if (user?.role === "Entreprise") {
        requests.push(api.get<CampagneRapportSites>(`/campagnes/${id}/rapport-sites/`));
      }
      const results = await Promise.all(requests);
      const campRes = results[0] as { data: CampagneDetail };
      const tastRes = results[1] as { data: Degustation[] | { results?: Degustation[] } };
      const ventesRes = results[2] as { data: Vente[] | { results?: Vente[] } };
      const siteRes = results[3] as { data: SiteList[] | { results?: SiteList[] } };

      try {
        const campGoodies = await getGoodiesByCampagne(id);
        setGoodies(campGoodies);
      } catch {
        setGoodies([]);
      }

      setCampaign(campRes.data);
      const campNom = campRes.data.nom;
      const allTastings = Array.isArray(tastRes.data) ? tastRes.data : ((tastRes.data as { results?: Degustation[] }).results ?? []);
      const allVentes   = Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: Vente[] }).results ?? []);
      const allSites    = Array.isArray(siteRes.data) ? siteRes.data : ((siteRes.data as { results?: SiteList[] }).results ?? []);
      setTastings(allTastings.filter(t => t.campagne_nom === campNom));
      setVentes(allVentes.filter(v => v.campagne_nom === campNom));
      setCampaignSites(allSites.filter(s => s.campagne === id));

      if (user?.role === "Entreprise" && results[4]) {
        setSiteRapport((results[4] as { data: CampagneRapportSites }).data);
      } else {
        setSiteRapport(null);
      }
    } catch {
      toast.error("Impossible de charger la campagne.");
      router.push("/dashboard/campaigns");
    } finally {
      setLoading(false);
    }
  }, [id, router, user?.role]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSiteChange = async (siteId: string) => {
    setDegForm(f => ({ ...f, site: siteId, produit: "" }));
    setSiteInfo(null);
    if (!siteId) return;
    setLoadingSite(true);
    try {
      const { data } = await api.get<MonSiteInfo>(`/degustations/mon-site/?site_id=${siteId}`);
      setSiteInfo(data);
      if (data.auto_select_produit && data.produits.length === 1) {
        setDegForm(f => ({ ...f, produit: data.produits[0].id }));
      }
    } catch {
      toast.error("Impossible de charger les infos du site.");
    } finally {
      setLoadingSite(false);
    }
  };

  const getWheelPrizes = useCallback(() => {
    let activeGoodies: { id: string; name: string }[] = [];
    if (siteInfo?.goodies_disponibles && siteInfo.goodies_disponibles.length > 0) {
      activeGoodies = siteInfo.goodies_disponibles
        .filter(g => g.quantite_restante > 0)
        .map(g => ({ id: g.id, name: g.nom }));
    } else {
      activeGoodies = goodies
        .filter(g => g.quantite_restante > 0)
        .map(g => ({ id: g.id, name: g.nom }));
    }
    if (activeGoodies.length === 0) return [];
    return [
      ...activeGoodies.map(g => ({ id: g.id, name: g.name, isGoodie: true })),
      { id: "retry", name: "Réessayez", isGoodie: false },
    ];
  }, [goodies, siteInfo]);

  const drawWheelImmediate = (rot: number) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const wheelPrizes = getWheelPrizes();
    if (wheelPrizes.length === 0) {
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
      grad.addColorStop(0, "#f1f5f9");
      grad.addColorStop(1, "#e2e8f0");
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 3; ctx.stroke();
      const N = 6;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 2 * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
        ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#64748b"; ctx.textAlign = "center";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("Aucun goodie", cx, cy - 10);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("configuré", cx, cy + 8);
      ctx.fillText("pour cette campagne", cx, cy + 24);
      return;
    }

    const anglePerSlice = (2 * Math.PI) / wheelPrizes.length;
    const rotRad = (rot * Math.PI) / 180;
    wheelPrizes.forEach((prize, i) => {
      const startAngle = i * anglePerSlice + rotRad;
      const endAngle = (i + 1) * anglePerSlice + rotRad;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy);
      ctx.rotate(startAngle + anglePerSlice / 2);
      ctx.textAlign = "right"; ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(prize.name, radius - 14, 5);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 3; ctx.stroke();
    ctx.moveTo(cx + radius + 14, cy);
    ctx.lineTo(cx + radius - 8, cy - 12);
    ctx.lineTo(cx + radius - 8, cy + 12);
    ctx.closePath(); ctx.fillStyle = "#f97316"; ctx.fill();
  };

  const spinWheel = () => {
    if (wheelSpinning) return;
    const wheelPrizes = getWheelPrizes();
    if (wheelPrizes.length === 0) {
      toast.error("Aucun goodie disponible pour le tirage");
      return;
    }
    setWheelSpinning(true);
    setWonPrize(null);
    const idx = Math.floor(Math.random() * wheelPrizes.length);
    const selected = wheelPrizes[idx];
    const anglePerSlice = 360 / wheelPrizes.length;
    const prizeAngle = idx * anglePerSlice + anglePerSlice / 2;
    const totalSpins = 5 + Math.random() * 3;
    const finalAngle = 360 * totalSpins + (360 - prizeAngle);
    const startRot = wheelRotationRef.current;
    const targetRot = startRot + finalAngle;
    const duration = 5000;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      wheelRotationRef.current = (startRot + (targetRot - startRot) * eased) % 360;
      drawWheelImmediate(wheelRotationRef.current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setWheelSpinning(false);
        setWonPrize(selected.name);
        if (selected.name !== "Réessayez") {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }
      }
    };
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (activeWheelPromoId) {
      wheelRotationRef.current = 0;
      const t = setTimeout(() => drawWheelImmediate(0), 80);
      return () => clearTimeout(t);
    }
  }, [activeWheelPromoId]);

  useEffect(() => {
    if (activeWheelPromoId && !wheelSpinning) {
      const t = setTimeout(() => drawWheelImmediate(wheelRotationRef.current), 50);
      return () => clearTimeout(t);
    }
  }, [siteInfo, goodies, activeWheelPromoId, wheelSpinning]);

  useEffect(() => {
    if (isHostess && campaignSites.length === 1 && !degForm.site) {
      handleSiteChange(campaignSites[0].id);
    }
  }, [campaignSites.length, isHostess]);

  const handlePromoGain = async (promoId: string, promoDesc: string, siteId: string) => {
    if (!siteId) { toast.error("Sélectionnez d'abord un site."); return; }
    setSavingGain(promoId);
    try {
      await api.post(`/promotions/${promoId}/enregistrer-gain/`, {
        site_id: siteId,
        nom_client: gainClientName.trim() || undefined,
        tranche_age: gainClientAge || undefined,
      });
      setPromoGains(prev => ({ ...prev, [promoId]: (prev[promoId] ?? 0) + 1 }));
      toast.success(`Gain enregistré : ${promoDesc} 🎉`);

      const promo = campaign?.promotions?.find(p => p.id === promoId);
      const chosenAction = promoAction[promoId] ?? promo?.type_promotion ?? "OFFERT";
      if (chosenAction === "GAGNE") {
        setWheelClientName(gainClientName.trim() || "Client");
        setWonPrize(null);
        wheelRotationRef.current = 0;
        setWheelSpinning(false);
        setActiveWheelPromoId(promoId);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement du gain.");
    } finally {
      setSavingGain(null);
    }
  };

  const handleDegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPromoMode = campaign?.type_recompense === "PROMOTIONS";
    const baseValid = degForm.site && degForm.produit && degForm.tranche_age;
    const promoValid = isPromoMode ? baseValid : baseValid && (showTasting ? (degForm.note_gout && degForm.intention_achat) : true);
    if (!promoValid) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSavingDeg(true);
    try {
      const a_achete = isPromoMode ? true : false;
      const payload: CreateDegustationPayload = {
        site: degForm.site,
        produit: degForm.produit,
        tranche_age: degForm.tranche_age as TrancheAge,
        note_gout: isPromoMode ? 1 : (showTasting ? degForm.note_gout : 1),
        intention_achat: isPromoMode ? "ELEVEE" : (showTasting ? degForm.intention_achat as IntentionAchat : "MOYENNE"),
        a_achete,
        nom_client: degForm.nom_client.trim() || undefined,
      };
      const { data: created } = await api.post<Degustation>("/degustations/", payload);

      let selectedPromo = null;
      if (isPromoMode && degForm.promotion_selectionnee) {
        selectedPromo = campaign?.promotions?.find(p => p.id === degForm.promotion_selectionnee);
        if (selectedPromo) {
          try {
            await api.post(`/promotions/${selectedPromo.id}/enregistrer-gain/`, {
              site_id: degForm.site,
              nom_client: degForm.nom_client.trim() || undefined,
            });
            toast.success("Gain promotionnel enregistré ! 🎉");
          } catch (promoErr: unknown) {
            const promoMsg = (promoErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            toast.warning(promoMsg ?? "Erreur lors de l'enregistrement de la promotion.");
          }
        }
      }

      setTastings(prev => [created, ...prev]);
      invalidateCache("/degustations");
      toast.success("Dégustation enregistrée !");
      const clientName = degForm.nom_client.trim();
      setDegForm(f => ({ ...EMPTY_DEG_FORM, site: f.site }));

      if (campaign?.type_recompense === "GOODIES") {
        setWheelClientName(clientName || "Client");
        setWonPrize(null);
        wheelRotationRef.current = 0;
        setWheelSpinning(false);
        setWheelOpen(true);
      } else if (isPromoMode && selectedPromo?.type_promotion === "GAGNE") {
        setWheelClientName(clientName || "Client");
        setWonPrize(null);
        wheelRotationRef.current = 0;
        setWheelSpinning(false);
        setActiveWheelPromoId(selectedPromo.id);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSavingDeg(false);
    }
  };

  const purchasedCount = tastings.filter(t => t.a_achete).length;
  const totalRevenue   = ventes.reduce((sum, v) => sum + Number(v.prix_total ?? 0), 0);
  const convRate       = tastings.length > 0 ? Math.round((purchasedCount / tastings.length) * 100) : 0;
  const avgRating      = tastings.length > 0
    ? Math.round((tastings.reduce((s, t) => s + t.note_gout, 0) / tastings.length) * 10) / 10
    : 0;

  const produitSensoryStats = useMemo(
    () => computeProduitSensoryStats(tastings),
    [tastings],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-50 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!campaign) return null;

  const p1 = campaign.couleur_primaire  || "#006776";
  const p2 = campaign.couleur_secondaire || "#00899b";
  const brandGrad = `linear-gradient(135deg, ${p1} 0%, ${p2} 100%)`;

  const showTasting  = campaign.type_campagne !== "VENTE";
  const showVente    = campaign.type_campagne !== "DEGUSTATION";
  const showWheel    = campaign.type_recompense === "GOODIES";
  const showPromos   = campaign.type_recompense === "PROMOTIONS";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Admin hero banner ── */}
      {isAdmin ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-600 to-violet-500 text-white shadow-2xl shadow-indigo-200">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-24 -bottom-10 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Link href="/dashboard/campaigns" className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <span className="text-white/50 text-xs hidden sm:block">Campagnes / {campaign.nom}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 border border-white/30">{campaign.type_campagne_display}</span>
                {campaign.type_recompense !== "AUCUNE" && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 border border-white/30">{campaign.type_recompense_display}</span>
                )}
                <Link href={`/dashboard/campaigns/${id}/edit`} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <Edit className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-yellow-200" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{campaign.nom}</h1>
                <div className="flex flex-wrap gap-4 text-white/70 text-sm mt-2">
                  <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /><span>{campaign.entreprise_nom}</span></div>
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /><span>{new Date(campaign.date_debut).toLocaleDateString("fr-FR")} → {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}</span></div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                showTasting && { label: "Dégustations", value: tastings.length, sub: `/ ${campaign.objectif_degustations ?? 0}`, icon: "🍷" },
                showTasting && { label: "Acheteurs", value: purchasedCount, sub: `conv. ${convRate}%`, icon: "🛒" },
                showTasting && { label: "Note moy.", value: `${avgRating}/5`, sub: "satisfaction", icon: "⭐" },
                showVente && { label: "Chiffre d'aff.", value: fmtXOF(totalRevenue), sub: `${ventes.length} ventes`, icon: "💰" },
              ].filter(Boolean).map((s, i) => (
                <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                  <div className="text-base mb-1">{(s as {icon:string}).icon}</div>
                  <div className="text-xl font-bold leading-none">
                    {(s as {value: string|number}).value}
                    <span className="text-xs font-normal text-white/55 ml-1">{(s as {sub:string}).sub}</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1">{(s as {label:string}).label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/campaigns"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{campaign.nom}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">{campaign.type_campagne_display}</span>
              {campaign.type_recompense !== "AUCUNE" && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">{campaign.type_recompense_display}</span>}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{campaign.entreprise_nom}</p>
          </div>
        </div>
      )}

      {/* ── Admin two-column layout ── */}
      {isAdmin && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Description */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0"><Sparkles className="w-3.5 h-3.5 text-indigo-600" /></div>
                Description de la campagne
              </h3>
              {campaign.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{campaign.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">Aucune description disponible.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" /><span>Du {new Date(campaign.date_debut).toLocaleDateString("fr-FR")} au {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}</span></div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="w-3.5 h-3.5 text-violet-400 shrink-0" /><span>{campaign.entreprise_nom}</span></div>
                {showTasting && <div className="flex items-center gap-2 text-sm text-muted-foreground"><UtensilsCrossed className="w-3.5 h-3.5 text-blue-400 shrink-0" /><span>Objectif : <strong className="text-foreground">{campaign.objectif_degustations ?? 0}</strong> dégustations</span></div>}
                {showVente && <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShoppingCart className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span>Objectif : <strong className="text-foreground">{campaign.objectif_ventes ?? 0}</strong> ventes</span></div>}
              </div>
            </div>

            {/* Objectives progress */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0"><BarChart3 className="w-3.5 h-3.5 text-violet-600" /></div>
                Avancement des objectifs
              </h3>
              {showTasting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm"><UtensilsCrossed className="w-4 h-4 text-indigo-500" /><span className="font-medium text-foreground">Dégustations</span></div>
                    <div className="flex items-center gap-2 text-sm"><span className="font-bold text-indigo-700">{tastings.length}</span><span className="text-muted-foreground">/ {campaign.objectif_degustations ?? 0}</span><span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold">{convRate}%</span></div>
                  </div>
                  <div className="h-3 rounded-full bg-indigo-50 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full shadow-sm transition-all duration-700" style={{ width: `${Math.min(100, campaign.objectif_degustations ? Math.round((tastings.length / campaign.objectif_degustations) * 100) : 0)}%` }} />
                  </div>
                </div>
              )}
              {showVente && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4 text-violet-500" /><span className="font-medium text-foreground">Ventes</span></div>
                    <div className="flex items-center gap-2 text-sm"><span className="font-bold text-violet-700">{purchasedCount}</span><span className="text-muted-foreground">/ {campaign.objectif_ventes ?? 0}</span><span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-semibold">{campaign.objectif_ventes ? Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100)) : 0}%</span></div>
                  </div>
                  <div className="h-3 rounded-full bg-violet-50 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full shadow-sm transition-all duration-700" style={{ width: `${campaign.objectif_ventes ? Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100)) : 0}%` }} />
                  </div>
                </div>
              )}
            </div>

            <CampaignProduitSensoryCard stats={produitSensoryStats} p1={p1} p2={p2} brandGrad={brandGrad} />

            {/* Recent tastings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" /></div>
                  Dernières dégustations
                </h3>
                <span className="text-xs text-muted-foreground bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">{tastings.length} total</span>
              </div>
              {tastings.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><UtensilsCrossed className="w-7 h-7 text-slate-300" /></div>
                  <p className="text-sm text-muted-foreground">Aucune dégustation enregistrée</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tastings.slice(0, 8).map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: brandGrad }}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{t.produit_nom}</span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground">{t.hotesse_nom}</span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground">{t.tranche_age_display}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-amber-500 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{t.note_gout}/5</span>
                          <span className="text-xs text-muted-foreground">{t.intention_achat_display}</span>
                          <span className="text-xs text-muted-foreground">{t.site_nom}</span>
                        </div>
                      </div>
                      {t.a_achete && <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold shrink-0 border border-emerald-200">Achat ✓</span>}
                    </div>
                  ))}
                  {tastings.length > 8 && <p className="text-xs text-center text-muted-foreground pt-2">+{tastings.length - 8} autres dégustations</p>}
                </div>
              )}
            </div>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-5">
            {/* Team */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-blue-600" /></div>
                Équipe assignée
              </h3>
              <div className="space-y-3">
                {campaign.hotesses.length > 0 && (
                  <div className="space-y-2">
                    {campaign.hotesses.map(h => (
                      <div key={h.id} className="flex items-center gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-100">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">{initials(h.name)}</div>
                        <div className="min-w-0">
                          <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider mb-0.5">Hôtesse</p>
                          <p className="text-sm font-bold text-foreground truncate">{h.name}</p>
                          {h.email && <p className="text-xs text-muted-foreground truncate">{h.email}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {campaign.superviseurs.length > 0 && (
                  <div className="space-y-2">
                    {campaign.superviseurs.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">{initials(s.name)}</div>
                        <div className="min-w-0">
                          <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider mb-0.5">Superviseur</p>
                          <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                          {s.email && <p className="text-xs text-muted-foreground truncate">{s.email}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {campaign.hotesses.length === 0 && campaign.superviseurs.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4">Aucune équipe assignée</p>
                )}
              </div>
            </div>

            {/* Sites */}
            {campaignSites.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0"><MapPin className="w-3.5 h-3.5 text-violet-600" /></div>
                  Sites ({campaignSites.length})
                </h3>
                <div className="space-y-2">
                  {campaignSites.map(s => (
                    <div key={s.id} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0"><MapPin className="w-3.5 h-3.5 text-violet-600" /></div>
                      <span className="text-sm font-medium text-foreground">{s.nom}{s.ville ? ` · ${s.ville}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revenue card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-xl shadow-indigo-200">
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-white/70" /><span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Chiffre d'affaires</span></div>
                <div className="text-3xl font-bold">{fmtXOF(totalRevenue)}</div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/20 text-xs text-white/65">
                  <span>{ventes.length} vente{ventes.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{purchasedCount} acheteur{purchasedCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>conv. {convRate}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Non-admin info (entreprise, superviseur, autre) ── */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          {campaign.description && <p className="text-muted-foreground leading-relaxed text-sm">{campaign.description}</p>}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4 text-indigo-400 shrink-0" /><span>Du {new Date(campaign.date_debut).toLocaleDateString("fr-FR")} au {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="w-4 h-4 text-violet-400 shrink-0" /><span>{campaign.entreprise_nom}</span></div>
          </div>
          {campaignSites.length > 0 && !isEntreprise && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: p1 }} />
              <div className="flex flex-wrap gap-1.5">
                {campaignSites.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border" style={{ background: hex(p1, 0.08), borderColor: hex(p1, 0.25), color: p1 }}>{s.nom}{s.ville ? ` · ${s.ville}` : ""}</span>
                ))}
              </div>
            </div>
          )}
          {((showTasting && campaign.objectif_degustations) || (showVente && campaign.objectif_ventes)) && (
            <div className="pt-3 border-t border-slate-100 grid sm:grid-cols-2 gap-3">
              {showTasting && campaign.objectif_degustations && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: hex(p1, 0.07) }}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: p1 }}><UtensilsCrossed className="w-3.5 h-3.5" /><span className="font-semibold">Objectif dégustations</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p1 }}>{tastings.length} / {campaign.objectif_degustations}</span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}%`, background: brandGrad }} /></div>
                  <p className="text-xs text-right" style={{ color: p1 }}>{Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}% atteint</p>
                </div>
              )}
              {showVente && campaign.objectif_ventes && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: hex(p2, 0.07) }}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: p2 }}><ShoppingCart className="w-3.5 h-3.5" /><span className="font-semibold">Objectif ventes</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p2 }}>{purchasedCount} / {campaign.objectif_ventes}</span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}%`, background: `linear-gradient(to right, ${p2}, ${p1})` }} /></div>
                  <p className="text-xs text-right" style={{ color: p2 }}>{Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}% atteint</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Entreprise Section ── */}
      {isEntreprise && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Sites", value: siteRapport?.totaux.sites ?? campaignSites.length, Icon: MapPin },
              showTasting ? { label: "Dégustations", value: siteRapport?.totaux.degustations ?? tastings.length, Icon: UtensilsCrossed } : null,
              showVente ? { label: "Ventes", value: (siteRapport?.totaux as {ventes?:number})?.ventes ?? ventes.length, Icon: ShoppingCart } : null,
              showWheel ? { label: "Goodies distribués", value: siteRapport?.totaux.goodies_distribues ?? 0, Icon: Gift } : null,
              showPromos ? { label: "Gains promo", value: (siteRapport?.totaux as {gains_promotions?:number})?.gains_promotions ?? 0, Icon: Tag } : null,
              showPromos ? { label: "Produits concernés", value: (siteRapport?.totaux as {produits_concernes?:number})?.produits_concernes ?? 0, Icon: Package } : null,
              showTasting ? { label: "Conversion", value: `${convRate}%`, Icon: TrendingUp } : null,
            ].filter((item): item is NonNullable<typeof item> => item !== null).map((k, i) => (
              <div key={i} className="rounded-2xl border p-4 text-center" style={{ background: hex(i % 2 === 0 ? p1 : p2, 0.08), borderColor: hex(i % 2 === 0 ? p1 : p2, 0.2) }}>
                <k.Icon className="w-4 h-4 mx-auto mb-2" style={{ color: i % 2 === 0 ? p1 : p2 }} />
                <p className="text-xl font-black" style={{ color: i % 2 === 0 ? p1 : p2 }}>{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {(siteRapport?.sites.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}><BarChart3 className="w-3.5 h-3.5" style={{ color: p1 }} /></div>
                Performance par site
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteRapport!.sites.map(s => ({ nom: s.nom, degustations: s.degustations, ventes: s.ventes }))} margin={{ top: 5, right: 10, bottom: 30, left: -10 }} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    {showTasting && <Bar dataKey="degustations" name="Dégustations" fill={p1} radius={[4, 4, 0, 0]} />}
                    {showVente && <Bar dataKey="ventes" name="Ventes" fill={p2} radius={[4, 4, 0, 0]} />}
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <CampaignProduitSensoryCard stats={produitSensoryStats} p1={p1} p2={p2} brandGrad={brandGrad} />

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p2, 0.12) }}><MapPin className="w-3.5 h-3.5" style={{ color: p2 }} /></div>
              Sites de la campagne
            </h3>
            {siteRapport?.sites.length ? (
              <div className="space-y-4">
                {siteRapport.sites.map(site => {
                  const maxProdDeg = Math.max(1, ...site.produits.map(p => p.degustations));
                  return (
                    <div key={site.id} className="rounded-xl border border-slate-100 overflow-hidden">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: hex(p1, 0.06) }}>
                        <div>
                          <p className="font-bold text-foreground">{site.nom}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{site.ville}{site.emplacement_precis ? ` · ${site.emplacement_precis}` : ""}</p>
                          <p className="text-xs text-muted-foreground mt-1">{site.nb_hotesses} hôtesse{site.nb_hotesses !== 1 ? "s" : ""} · {site.nb_superviseurs} superviseur{site.nb_superviseurs !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                          {[
                            { label: "Dégustations", value: site.degustations },
                            { label: "Ventes", value: site.ventes },
                            { label: "Conversion", value: `${site.taux_conversion}%` },
                            { label: "CA", value: fmtXOF(Number(site.chiffre_affaires)) },
                          ].map((m, mi) => (
                            <div key={mi} className="rounded-lg bg-white border border-slate-100 px-2 py-2">
                              <p className="font-bold text-foreground">{m.value}</p>
                              <p className="text-muted-foreground">{m.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 grid md:grid-cols-2 gap-4 border-t border-slate-100">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3"><Package className="w-3.5 h-3.5" style={{ color: p1 }} />Répartition des produits</p>
                          {site.produits.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Aucune dégustation enregistrée sur ce site.</p>
                          ) : (
                            <div className="space-y-2">
                              {site.produits.map(prod => (
                                <div key={prod.produit_nom}>
                                  <div className="flex justify-between text-xs mb-1"><span className="font-medium text-foreground truncate pr-2">{prod.produit_nom}</span><span className="text-muted-foreground shrink-0">{prod.degustations} dég. · {prod.ventes} vente{prod.ventes !== 1 ? "s" : ""}</span></div>
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.round((prod.degustations / maxProdDeg) * 100)}%`, background: brandGrad }} /></div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          {showWheel && (
                            <>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3"><Gift className="w-3.5 h-3.5" style={{ color: p2 }} />Goodies distribués<span className="font-bold ml-1" style={{ color: p2 }}>({(site as {goodies_distribues_total?:number}).goodies_distribues_total ?? 0})</span></p>
                              {((site as {goodies?:{goodie_id:string;goodie_nom:string;quantite_distribuee:number;quantite_initiale:number}[]}).goodies ?? []).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">Aucun goodie configuré pour ce site.</p>
                              ) : (
                                <div className="space-y-2">
                                  {((site as {goodies:{goodie_id:string;goodie_nom:string;quantite_distribuee:number;quantite_initiale:number}[]}).goodies).map(g => (
                                    <div key={g.goodie_id} className="flex items-center justify-between text-xs rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                                      <span className="font-medium text-foreground">{g.goodie_nom}</span>
                                      <span className="text-muted-foreground tabular-nums">{g.quantite_distribuee} / {g.quantite_initiale}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          {showPromos && (
                            <>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3 mt-3"><Tag className="w-3.5 h-3.5 text-blue-500" />Gains promotionnels<span className="font-bold ml-1 text-blue-600">({(site as {gains_total?:number}).gains_total ?? 0} gains)</span></p>
                              {((site as {promotions_stats?:{promotion_id:string;recompense_description:string;quantite_requise:number;gains_count:number;produits_concernes:number}[]}).promotions_stats ?? []).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">Aucun gain enregistré sur ce site.</p>
                              ) : (
                                <div className="space-y-2">
                                  {((site as {promotions_stats:{promotion_id:string;recompense_description:string;quantite_requise:number;gains_count:number;produits_concernes:number}[]}).promotions_stats).map(ps => (
                                    <div key={ps.promotion_id} className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 space-y-1">
                                      <div className="flex items-center justify-between text-xs"><span className="font-semibold text-foreground truncate pr-2">{ps.quantite_requise} produit{ps.quantite_requise > 1 ? "s" : ""} → {ps.recompense_description}</span><span className="font-bold text-blue-700 shrink-0 tabular-nums">{ps.gains_count} gain{ps.gains_count !== 1 ? "s" : ""}</span></div>
                                      <p className="text-xs text-blue-400">{ps.produits_concernes} produit{ps.produits_concernes !== 1 ? "s" : ""} concerné{ps.produits_concernes !== 1 ? "s" : ""}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : campaignSites.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {campaignSites.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border" style={{ background: hex(p1, 0.08), borderColor: hex(p1, 0.25), color: p1 }}><MapPin className="w-3.5 h-3.5" />{s.nom}{s.ville ? ` · ${s.ville}` : ""}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun site associé à cette campagne.</p>
            )}
          </div>
        </div>
      )}

      {/* ===================== HÔTESSE : FORMULAIRE SANS ACHAT NI CONDITIONNEMENT ===================== */}
      {isHostess && (
        <div className="space-y-4">
          {/* Objectifs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center mb-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}><Target className="w-3.5 h-3.5" style={{ color: p1 }} /></div>
                Mes objectifs
              </h3>
            </div>
            <div className="space-y-5">
              {showTasting && campaign.objectif_degustations ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><UtensilsCrossed className="w-4 h-4" style={{ color: p1 }} /><span className="font-medium text-foreground">Dégustations</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p1 }}>{tastings.length} / {campaign.objectif_degustations}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}%`, background: brandGrad }} /></div>
                  <p className="text-xs text-muted-foreground text-right">{Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}% atteint</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: hex(p1, 0.07) }}><UtensilsCrossed className="w-4 h-4 shrink-0" style={{ color: p1 }} /><div><p className="text-sm font-semibold text-foreground">{tastings.length} dégustation{tastings.length !== 1 ? "s" : ""}</p><p className="text-xs text-muted-foreground">Aucun objectif défini</p></div></div>
              )}
              {showVente && campaign.objectif_ventes ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" style={{ color: p2 }} /><span className="font-medium text-foreground">Ventes</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p2 }}>{purchasedCount} / {campaign.objectif_ventes}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}%`, background: `linear-gradient(to right, ${p2}, ${p1})` }} /></div>
                  <p className="text-xs text-muted-foreground text-right">{Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}% atteint</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: hex(p2, 0.07) }}><ShoppingCart className="w-4 h-4 shrink-0" style={{ color: p2 }} /><div><p className="text-sm font-semibold text-foreground">{purchasedCount} vente{purchasedCount !== 1 ? "s" : ""}</p><p className="text-xs text-muted-foreground">Aucun objectif défini</p></div></div>
              )}
            </div>
          </div>

          

          {/* Formulaire principal */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60">
              <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" /></div>
                {showPromos ? "Enregistrer une activation promo" : "Enregistrer une dégustation"}
              </h3>
            </div>
            <form onSubmit={handleDegSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Campagne</Label><div className="h-10 px-3 flex items-center rounded-xl border border-input bg-muted/40 text-sm font-medium">{siteInfo?.campagne_nom ?? campaign.nom}</div></div>
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Hôtesse</Label><div className="h-10 px-3 flex items-center rounded-xl border border-input bg-muted/40 text-sm font-medium">{user?.name ?? ""}</div></div>
              </div>
              <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Nom du client <span className="normal-case font-normal">(utilisé pour la roue)</span></Label><Input value={degForm.nom_client} onChange={e => setDegForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Prénom du client" className="h-10" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Site</Label><div className="h-10 px-3 flex items-center rounded-xl border border-input bg-muted/40 text-sm font-medium">{campaignSites.find(s => s.id === degForm.site)?.nom ?? siteInfo?.site_nom ?? "—"}</div></div>
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Produit *</Label><Select value={degForm.produit} onValueChange={v => setDegForm(f => ({ ...f, produit: v }))} disabled={!degForm.site || loadingSite}><SelectTrigger>{loadingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Sélectionner" />}</SelectTrigger><SelectContent>{(siteInfo?.produits ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Tranche d'âge *</Label><Select value={degForm.tranche_age} onValueChange={v => setDegForm(f => ({ ...f, tranche_age: v as TrancheAge }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>

              {/* Note et intention (uniquement si showTasting et pas de promo) */}
              {showTasting && !showPromos && (
                <>
                  <div className="space-y-2"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Note du goût *</Label><div className="flex justify-between gap-2">{RATING_ICONS.map(r => (<button key={r.rating} type="button" onClick={() => setDegForm(f => ({ ...f, note_gout: r.rating }))} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all flex-1", degForm.note_gout === r.rating ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-border hover:border-indigo-300")}>{r.icon}<span className="text-xs font-medium">{r.label}</span></button>))}</div></div>
                  <div className="space-y-2"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Intention d'achat *</Label><div className="grid grid-cols-3 gap-2">{INTENT_OPTIONS.map(o => (<button key={o.value} type="button" onClick={() => setDegForm(f => ({ ...f, intention_achat: o.value }))} className={cn("py-3 px-2 rounded-lg border-2 font-medium transition-all text-sm", degForm.intention_achat === o.value ? o.color + " border-current" : "border-border hover:border-indigo-300")}>{o.label}</button>))}</div></div>
                </>
              )}

              {/* Promotions : checkboxes */}
              {showPromos && (campaign?.promotions ?? []).length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2"><Label className="text-sm font-semibold text-blue-600">Offre promotionnelle applicable</Label><span className="text-xs text-muted-foreground">({(campaign?.promotions ?? []).filter(p => p.is_active).length} règle{(campaign?.promotions ?? []).filter(p => p.is_active).length > 1 ? "s" : ""})</span></div>
                  <div className="space-y-2">
                    {(campaign?.promotions ?? []).filter(p => p.is_active).map((promo) => {
                      const styles = PROMO_TYPE_STYLES[promo.type_promotion];
                      const isChecked = degForm.promotion_selectionnee === promo.id;
                      return (
                        <label key={promo.id} className={cn("flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", isChecked ? `${styles.bg} ${styles.border} ${styles.text}` : "border-slate-200 bg-white hover:border-slate-300")}>
                          <input type="checkbox" className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={isChecked} onChange={(e) => { if (e.target.checked) setDegForm(f => ({ ...f, promotion_selectionnee: promo.id })); else setDegForm(f => ({ ...f, promotion_selectionnee: "" })); }} />
                          <div className="flex-1 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0"><span className="text-xl">{styles.icon}</span></div><div><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{promo.quantite_requise} acheté{promo.quantite_requise > 1 ? "s" : ""}</span><span className="text-xs font-medium text-slate-500">→ {styles.label}</span></div><p className="font-semibold text-sm mt-1">{promo.recompense_description}</p></div></div>
                          {isChecked && <CheckCircle2 className={cn("w-5 h-5 shrink-0", styles.text)} />}
                        </label>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300" checked={degForm.promotion_selectionnee === ""} onChange={(e) => { if (e.target.checked) setDegForm(f => ({ ...f, promotion_selectionnee: "" })); }} />
                    <span className="text-sm font-medium text-slate-700">Aucune promotion applicable</span>
                  </label>
                </div>
              )}

              <Button type="submit" disabled={savingDeg} className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white h-12 text-base font-semibold">
                {savingDeg ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : <><UtensilsCrossed className="w-4 h-4 mr-2" />{showPromos ? "Enregistrer le client" : showWheel ? "Enregistrer & lancer la roue 🎡" : "Enregistrer la dégustation"}</>}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Superviseur (autre rôle) */}
      {!isAdmin && !isHostess && !isEntreprise && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2"><div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}><Target className="w-3.5 h-3.5" style={{ color: p1 }} /></div>Suivi de la campagne</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(
              [
                showTasting ? { label: "Dégustations", value: tastings.length } : null,
                showTasting ? { label: "Acheteurs", value: purchasedCount } : null,
                showVente ? { label: "Ventes", value: ventes.length } : null,
                showTasting ? { label: "Conversion", value: `${convRate}%` } : null,
              ] as ({ label: string; value: string | number } | null)[]
            ).filter((s): s is { label: string; value: string | number } => s !== null).map((s, i) => (
              <div key={i} className="rounded-xl border p-3 text-center" style={{ background: hex(i % 2 === 0 ? p1 : p2, 0.08), borderColor: hex(i % 2 === 0 ? p1 : p2, 0.2) }}>
                <p className="text-xl font-black" style={{ color: i % 2 === 0 ? p1 : p2 }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotions en lecture seule (non hôtesse) */}
      {showPromos && (campaign.promotions ?? []).length > 0 && !isHostess && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100" style={{ background: hex("#3b82f6", 0.06) }}>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2"><div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-blue-100"><Tag className="w-3.5 h-3.5 text-blue-600" /></div>Promotions en cours</h3>
          </div>
          <div className="p-4 space-y-2.5">
            {(campaign.promotions ?? []).filter(p => p.is_active).map(promo => (
              <div key={promo.id} className="flex items-start gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5"><Tag className="w-4 h-4 text-blue-600" /></div>
                <div><p className="text-sm font-semibold text-foreground">Acheter <span className="text-blue-700">{promo.quantite_requise} produit{promo.quantite_requise > 1 ? "s" : ""}</span> {promo.type_promotion === "OFFERT" ? "→ offert : " : "→ à gagner : "}<span className="text-blue-700">{promo.recompense_description}</span></p><p className="text-xs text-blue-500 mt-0.5">{promo.type_promotion_display}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale roue pour les promotions */}
      {activeWheelPromoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full"><div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /><span className="text-lg font-bold text-amber-700">Roue de fortune</span></div><div className="flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold" style={{ background: hex(p1, 0.1), borderColor: hex(p1, 0.3), color: p1 }}>👤 {wheelClientName}</div></div>
              <canvas ref={wheelCanvasRef} width={280} height={280} className="max-w-full" />
              {wonPrize && (<div className={cn("w-full rounded-2xl p-3.5 text-center font-bold text-base border", wonPrize === "Réessayez" ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-amber-50 border-amber-200 text-amber-700")}>{wonPrize === "Réessayez" ? "😔 Réessayez" : `🎁 ${wonPrize}`}</div>)}
              {getWheelPrizes().length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-slate-100">
                  {getWheelPrizes().map((prize, i) => (<div key={prize.id} className="flex items-center gap-2 text-xs text-muted-foreground"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{prize.name}</div>))}
                </div>
              )}
              {!wonPrize ? (
                <Button size="lg" className="w-full text-white" style={{ background: brandGrad }} onClick={spinWheel} disabled={wheelSpinning}>
                  {wheelSpinning ? <><RotateCcw className="w-5 h-5 mr-2 animate-spin" />En cours…</> : <><Sparkles className="w-5 h-5 mr-2" />Lancer la roue !</>}
                </Button>
              ) : wonPrize === "Réessayez" ? (
                <div className="flex gap-3 w-full">
                  <Button variant="outline" className="flex-1" onClick={() => { setWonPrize(null); wheelRotationRef.current = 0; setTimeout(() => drawWheelImmediate(0), 20); }}><RotateCcw className="w-4 h-4 mr-2" />Réessayer</Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setActiveWheelPromoId(null); setWonPrize(null); }}>Fermer</Button>
                </div>
              ) : (
                <Button className="w-full text-white" style={{ background: brandGrad }} onClick={() => { setActiveWheelPromoId(null); setWonPrize(null); wheelRotationRef.current = 0; }}><Gift className="w-4 h-4 mr-2" />Confirmer le gain</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale roue pour les goodies */}
      {wheelOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-between w-full"><div className="flex items-center gap-2"><Gift className="w-5 h-5 text-emerald-600" /><span className="text-lg font-bold text-emerald-700">Roue des goodies</span></div><div className="flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold" style={{ background: hex(p1, 0.1), borderColor: hex(p1, 0.3), color: p1 }}>👤 {wheelClientName}</div></div>
              <canvas ref={wheelCanvasRef} width={280} height={280} className="max-w-full" />
              {wonPrize && (<div className={cn("w-full rounded-2xl p-3.5 text-center font-bold text-base border", wonPrize === "Réessayez" ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-emerald-50 border-emerald-200 text-emerald-700")}>{wonPrize === "Réessayez" ? "😔 Réessayez" : `🎁 ${wonPrize}`}</div>)}
              {getWheelPrizes().length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-slate-100">
                  {getWheelPrizes().map((prize, i) => (<div key={prize.id} className="flex items-center gap-2 text-xs text-muted-foreground"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{prize.name}</div>))}
                </div>
              )}
              {!wonPrize ? (
                <Button size="lg" className="w-full text-white" style={{ background: brandGrad }} onClick={spinWheel} disabled={wheelSpinning}>
                  {wheelSpinning ? <><RotateCcw className="w-5 h-5 mr-2 animate-spin" />En cours…</> : <><Sparkles className="w-5 h-5 mr-2" />Lancer la roue !</>}
                </Button>
              ) : wonPrize === "Réessayez" ? (
                <div className="flex gap-3 w-full">
                  <Button variant="outline" className="flex-1" onClick={() => { setWonPrize(null); wheelRotationRef.current = 0; setTimeout(() => drawWheelImmediate(0), 20); }}><RotateCcw className="w-4 h-4 mr-2" />Réessayer</Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setWheelOpen(false); setWonPrize(null); }}>Fermer</Button>
                </div>
              ) : (
                <Button className="w-full text-white" style={{ background: brandGrad }} onClick={() => { setWheelOpen(false); setWonPrize(null); wheelRotationRef.current = 0; }}><Gift className="w-4 h-4 mr-2" />Confirmer le gain</Button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Dégustations récentes */}
          {tastings.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p2, 0.12) }}><UtensilsCrossed className="w-3.5 h-3.5" style={{ color: p2 }} /></div>
                Mes activités récentes
              </h3>
              <div className="space-y-2">
                {tastings.slice(0, 5).map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: brandGrad }}>{i+1}</div>
                    <div className="flex-1 min-w-0"><span className="font-medium text-foreground">{t.produit_nom}</span>{t.nom_client && <span className="text-muted-foreground ml-2 text-xs">· {t.nom_client}</span>}<span className="text-muted-foreground ml-2 text-xs">{t.tranche_age_display}</span></div>
                    <div className="flex items-center gap-1 text-xs text-amber-500"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{t.note_gout}/5</div>
                    {t.a_achete && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">✓</span>}
                  </div>
                ))}
                {tastings.length > 5 && <p className="text-xs text-center text-muted-foreground">+{tastings.length - 5} autres</p>}
              </div>
            </div>
          )}
    </div>
    
  );
}