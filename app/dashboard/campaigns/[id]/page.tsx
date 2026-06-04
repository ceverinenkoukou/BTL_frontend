"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type {
  CampagneDetail, Degustation, Vente, SiteList, MonSiteInfo,
  CreateDegustationPayload, TrancheAge, IntentionAchat, TypeConditionnement,
  CampagneRapportSites,
} from "@/lib/types/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Target, Users, Building2,
  UtensilsCrossed, ShoppingCart, TrendingUp, BarChart3,
  Sparkles, Star, Plus, Loader2, CheckCircle2,
  Frown, Meh, Smile, Laugh, Heart, Gift, Trophy, RotateCcw, MapPin, Package,
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

const WHEEL_PRIZES = [
  { id: "1", name: "T-Shirt"        },
  { id: "2", name: "Casquette"      },
  { id: "3", name: "Porte-clés"     },
  { id: "4", name: "Stylo"          },
  { id: "5", name: "Réduction 10%"  },
  { id: "6", name: "Réessayez"      },
];

const EMPTY_DEG_FORM = {
  site:            "",
  produit:         "",
  tranche_age:     "" as TrancheAge | "",
  note_gout:       0,
  intention_achat: "" as IntentionAchat | "",
  a_achete:        false,
  conditionnement: "UNITE" as TypeConditionnement,
  quantite:        1,
  nom_client:      "",
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

  const [wheelOpen, setWheelOpen] = useState(false);
  const [wheelClientName, setWheelClientName] = useState("");
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const wheelRotationRef = useRef(0);

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

  const handleDegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!degForm.site || !degForm.produit || !degForm.tranche_age || !degForm.note_gout || !degForm.intention_achat) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSavingDeg(true);
    try {
      const payload: CreateDegustationPayload = {
        site: degForm.site,
        produit: degForm.produit,
        tranche_age: degForm.tranche_age as TrancheAge,
        note_gout: degForm.note_gout,
        intention_achat: degForm.intention_achat as IntentionAchat,
        a_achete: degForm.a_achete,
        nom_client: degForm.nom_client.trim() || undefined,
        ...(degForm.a_achete && { conditionnement: degForm.conditionnement, quantite: degForm.quantite }),
      };
      const { data: created } = await api.post<Degustation>("/degustations/", payload);
      setTastings(prev => [created, ...prev]);
      invalidateCache("/degustations");
      toast.success("Dégustation enregistrée !");
      const clientName = degForm.nom_client.trim();
      setDegForm(f => ({ ...EMPTY_DEG_FORM, site: f.site }));
      setWheelClientName(clientName || "Client");
      setWonPrize(null);
      wheelRotationRef.current = 0;
      setWheelSpinning(false);
      setWheelOpen(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSavingDeg(false);
    }
  };

  const drawWheelImmediate = (rot: number) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const anglePerSlice = (2 * Math.PI) / WHEEL_PRIZES.length;
    const rotRad = (rot * Math.PI) / 180;
    WHEEL_PRIZES.forEach((prize, i) => {
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
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 3; stroke();
    ctx.beginPath();
    ctx.stroke();
    ctx.moveTo(cx + radius + 14, cy);
    ctx.lineTo(cx + radius - 8, cy - 12);
    ctx.lineTo(cx + radius - 8, cy + 12);
    ctx.closePath(); ctx.fillStyle = "#f97316"; ctx.fill();
  };

  const spinWheel = () => {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setWonPrize(null);
    const idx = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const selected = WHEEL_PRIZES[idx];
    const anglePerSlice = 360 / WHEEL_PRIZES.length;
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
    if (wheelOpen) {
      wheelRotationRef.current = 0;
      const t = setTimeout(() => drawWheelImmediate(0), 80);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelOpen]);

  useEffect(() => {
    if (isHostess && campaignSites.length === 1 && !degForm.site) {
      handleSiteChange(campaignSites[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignSites.length, isHostess]);

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

  // 📈 Calcul des performances par hôtesse et par site pour le dashboard Admin
  const staffPerformanceBySite = useMemo(() => {
    if (!campaign) return [];

    return campaignSites.map(site => {
      // Trouver les hôtesses rattachées à ce site d'après les logs de dégustation ou les affectations
      const siteTastings = tastings.filter(t => t.site_nom === site.nom);
      
      const hotessesPerformances = campaign.hotesses.map(hotesse => {
        const hTastings = siteTastings.filter(t => t.hotesse_nom === hotesse.name);
        const hSales = hTastings.filter(t => t.a_achete).length;
        const hConvRate = hTastings.length > 0 ? Math.round((hSales / hTastings.length) * 100) : 0;

        return {
          ...hotesse,
          totalTastings: hTastings.length,
          totalSales: hSales,
          conversionRate: hConvRate,
        };
      })
      // Trier par performance (nombre de ventes, puis taux de conversion)
      .sort((a, b) => b.totalSales - a.totalSales || b.conversionRate - a.conversionRate);

      return {
        siteId: site.id,
        siteNom: site.nom,
        ville: site.ville,
        hotesses: hotessesPerformances.filter(h => h.totalTastings > 0 || campaign.hotesses.length <= 1) 
      };
    });
  }, [campaign, campaignSites, tastings]);

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Hero banner ── */}
      {isAdmin ? (
        <div className="relative overflow-hidden rounded-2xl text-white shadow-2xl" style={{ background: brandGrad }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-24 -bottom-10 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <Link href="/dashboard/campaigns"
                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <span className="text-white/50 text-xs hidden sm:block">Campagnes / {campaign.nom}</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 backdrop-blur-sm">
                <Sparkles className="w-6 h-6 text-yellow-200" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{campaign.nom}</h1>
                <div className="flex flex-wrap gap-4 text-white/70 text-sm mt-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{campaign.entreprise_nom}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(campaign.date_debut).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: "Dégustations", value: tastings.length,    sub: "enregistrées",           icon: "🍷" },
                { label: "Acheteurs",    value: purchasedCount,      sub: `conv. ${convRate}%`,      icon: "🛒" },
                { label: "Note moy.",    value: `${avgRating}/5`,    sub: "satisfaction",            icon: "⭐" },
                { label: "Chiffre d'aff.", value: fmtXOF(totalRevenue), sub: `${ventes.length} ventes`, icon: "💰" },
              ].map((s, i) => (
                <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                  <div className="text-base mb-1">{s.icon}</div>
                  <div className="text-xl font-bold leading-none">
                    {s.value}
                    <span className="text-xs font-normal text-white/55 ml-1">{s.sub}</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl text-white shadow-xl" style={{ background: brandGrad }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative z-10 p-5 flex items-center gap-4">
            <Link href="/dashboard/campaigns"
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {campaign.logo_url
                ? <img src={campaign.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-white/20 p-1 border border-white/30 shrink-0" />
                : <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5" /></div>}
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight truncate">{campaign.nom}</h1>
                <p className="text-white/70 text-sm">{campaign.entreprise_nom}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin two-column layout ── */}
      {isAdmin && (
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left (2/3) */}
          <div className="lg:col-span-2 space-y-5">

            {/* Description + info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: p1 }} />
                </div>
                Description de la campagne
              </h3>
              {campaign.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{campaign.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">Aucune description disponible.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: p1 }} />
                  <span>Du {new Date(campaign.date_debut).toLocaleDateString("fr-FR")} au {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: p1 }} />
                  <span>{campaign.entreprise_nom}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" style={{ color: p2 }} />
                  <span><strong className="text-foreground">{tastings.length}</strong> dégustation{tastings.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShoppingCart className="w-3.5 h-3.5 shrink-0" style={{ color: p2 }} />
                  <span><strong className="text-foreground">{ventes.length}</strong> vente{ventes.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
                  <BarChart3 className="w-3.5 h-3.5" style={{ color: p1 }} />
                </div>
                Statistiques
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Dégustations",  value: tastings.length  },
                  { label: "Acheteurs",     value: purchasedCount    },
                  { label: "Taux conv.",    value: `${convRate}%`    },
                  { label: "Note moy.",     value: `${avgRating}/5`  },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl border p-3 text-center"
                    style={{ background: hex(i % 2 === 0 ? p1 : p2, 0.08), borderColor: hex(i % 2 === 0 ? p1 : p2, 0.2) }}>
                    <p className="text-lg font-black" style={{ color: i % 2 === 0 ? p1 : p2 }}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <CampaignProduitSensoryCard
              stats={produitSensoryStats}
              p1={p1}
              p2={p2}
              brandGrad={brandGrad}
            />

            {/* Recent tastings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p2, 0.12) }}>
                    <UtensilsCrossed className="w-3.5 h-3.5" style={{ color: p2 }} />
                  </div>
                  Dernières dégustations
                </h3>
                <span className="text-xs text-muted-foreground bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                  {tastings.length} total
                </span>
              </div>
              {tastings.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <UtensilsCrossed className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm text-muted-foreground">Aucune dégustation enregistrée</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tastings.slice(0, 8).map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl transition-colors" style={{ ['--hover-bg' as string]: hex(p1, 0.06) }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: brandGrad }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{t.produit_nom}</span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground">{t.hotesse_nom}</span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-muted-foreground">{t.tranche_age_display}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-amber-500 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{t.note_gout}/5
                          </span>
                          <span className="text-xs text-muted-foreground">{t.intention_achat_display}</span>
                          <span className="text-xs text-muted-foreground">{t.site_nom}</span>
                        </div>
                      </div>
                      {t.a_achete && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold shrink-0 border border-emerald-200">
                          Achat ✓
                        </span>
                      )}
                    </div>
                  ))}
                  {tastings.length > 8 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      +{tastings.length - 8} autres dégustations
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right (1/3) : Équipe triée par site et par performance hôtesses */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
                  <Users className="w-3.5 h-3.5" style={{ color: p1 }} />
                </div>
                Équipe par Site &amp; Performance
              </h3>

              <div className="space-y-5">
                {staffPerformanceBySite.map(group => (
                  <div key={group.siteId} className="space-y-2.5">
                    {/* Header du Site */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{group.siteNom} {group.ville ? `(${group.ville})` : ""}</span>
                    </div>

                    {/* Liste des Hôtesses du site classées par performance */}
                    <div className="space-y-2">
                      {group.hotesses.length > 0 ? (
                        group.hotesses.map((h, index) => {
                          // Définition d'un badge de performance simple
                          const isTop = index === 0 && h.totalSales > 0;
                          return (
                            <div key={h.id} className={cn(
                              "p-3 rounded-xl border flex flex-col gap-2 transition-all",
                              isTop ? "bg-amber-50/50 border-amber-200" : "bg-white border-slate-100"
                            )}>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: brandGrad }}>
                                  {initials(h.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold text-foreground truncate">{h.name}</p>
                                    {isTop && (
                                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-amber-200">
                                        <Trophy className="w-2.5 h-2.5 text-amber-600 fill-amber-500" /> Top
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{h.email}</p>
                                </div>
                              </div>

                              {/* Données de performance de l'hôtesse */}
                              <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100/70 text-center text-[11px]">
                                <div>
                                  <p className="text-slate-400 font-medium">Dégust.</p>
                                  <p className="font-bold text-slate-700">{h.totalTastings}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-medium">Ventes</p>
                                  <p className="font-bold text-emerald-600">{h.totalSales}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-medium">Conv.</p>
                                  <p className="font-bold text-indigo-600">{h.conversionRate}%</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic text-center py-1">En attente d&apos;activité sur ce site.</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Section Superviseurs Généraux si applicables */}
                {campaign.superviseurs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-150">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                      Superviseurs de campagne
                    </div>
                    {campaign.superviseurs.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border bg-slate-50/50 border-slate-100">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${p2}, ${p1})` }}>
                          {initials(s.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Non-admin info ── */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          {campaign.description && (
            <p className="text-muted-foreground leading-relaxed text-sm">{campaign.description}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: p1 }} />
              <span>Du {new Date(campaign.date_debut).toLocaleDateString("fr-FR")} au {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4 shrink-0" style={{ color: p1 }} />
              <span>{campaign.entreprise_nom}</span>
            </div>
          </div>

          {/* Sites chips */}
          {campaignSites.length > 0 && !isEntreprise && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: p1 }} />
              <div className="flex flex-wrap gap-1.5">
                {campaignSites.map(s => (
                  <span key={s.id}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                    style={{ background: hex(p1, 0.08), borderColor: hex(p1, 0.25), color: p1 }}>
                    {s.nom}{s.ville ? ` · ${s.ville}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Objectives mini-bars */}
          {(campaign.objectif_degustations || campaign.objectif_ventes) && (
            <div className="pt-3 border-t border-slate-100 grid sm:grid-cols-2 gap-3">
              {campaign.objectif_degustations ? (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: hex(p1, 0.07) }}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: p1 }}>
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span className="font-semibold">Objectif dégustations</span>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: p1 }}>
                      {tastings.length} / {campaign.objectif_degustations}
                    </span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}%`,
                      background: brandGrad,
                    }} />
                  </div>
                  <p className="text-xs text-right" style={{ color: p1 }}>
                    {Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}% atteint
                  </p>
                </div>
              ) : null}

              {campaign.objectif_ventes ? (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: hex(p2, 0.07) }}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: p2 }}>
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span className="font-semibold">Objectif ventes</span>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: p2 }}>
                      {purchasedCount} / {campaign.objectif_ventes}
                    </span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}%`,
                      background: `linear-gradient(to right, ${p2}, ${p1})`,
                    }} />
                  </div>
                  <p className="text-xs text-right" style={{ color: p2 }}>
                    {Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}% atteint
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Entreprise Section ── */}
      {isEntreprise && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Sites", value: siteRapport?.totaux.sites ?? campaignSites.length, icon: MapPin },
              { label: "Dégustations", value: siteRapport?.totaux.degustations ?? tastings.length, icon: UtensilsCrossed },
              { label: "Goodies distribués", value: siteRapport?.totaux.goodies_distribues ?? 0, icon: Gift },
              { label: "Conversion", value: `${convRate}%`, icon: TrendingUp },
            ].map((k, i) => (
              <div key={i} className="rounded-2xl border p-4 text-center"
                style={{ background: hex(i % 2 === 0 ? p1 : p2, 0.08), borderColor: hex(i % 2 === 0 ? p1 : p2, 0.2) }}>
                <k.icon className="w-4 h-4 mx-auto mb-2" style={{ color: i % 2 === 0 ? p1 : p2 }} />
                <p className="text-xl font-black" style={{ color: i % 2 === 0 ? p1 : p2 }}>{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {(siteRapport?.sites.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
                  <BarChart3 className="w-3.5 h-3.5" style={{ color: p1 }} />
                </div>
                Performance par site
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={siteRapport!.sites.map(s => ({
                      nom: s.nom,
                      degustations: s.degustations,
                      ventes: s.ventes,
                    }))}
                    margin={{ top: 5, right: 10, bottom: 30, left: -10 }}
                    barSize={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false}
                      angle={-18} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Bar dataKey="degustations" name="Dégustations" fill={p1} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ventes" name="Ventes" fill={p2} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <CampaignProduitSensoryCard
            stats={produitSensoryStats}
            p1={p1}
            p2={p2}
            brandGrad={brandGrad}
          />

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p2, 0.12) }}>
                <MapPin className="w-3.5 h-3.5" style={{ color: p2 }} />
              </div>
              Sites de la campagne
            </h3>

            {siteRapport?.sites.length ? (
              <div className="space-y-4">
                {siteRapport.sites.map(site => {
                  const maxProdDeg = Math.max(1, ...site.produits.map(p => p.degustations));
                  return (
                    <div key={site.id} className="rounded-xl border border-slate-100 overflow-hidden">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        style={{ background: hex(p1, 0.06) }}>
                        <div>
                          <p className="font-bold text-foreground">{site.nom}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {site.ville}{site.emplacement_precis ? ` · ${site.emplacement_precis}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {site.nb_hotesses} hôtesse{site.nb_hotesses !== 1 ? "s" : ""}
                            {" · "}{site.nb_superviseurs} superviseur{site.nb_superviseurs !== 1 ? "s" : ""}
                          </p>
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
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                            <Package className="w-3.5 h-3.5" style={{ color: p1 }} />
                            Répartition des produits
                          </p>
                          {site.produits.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Aucune dégustation enregistrée sur ce site.</p>
                          ) : (
                            <div className="space-y-2">
                              {site.produits.map(prod => (
                                <div key={prod.produit_nom}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium text-foreground truncate pr-2">{prod.produit_nom}</span>
                                    <span className="text-muted-foreground shrink-0">
                                      {prod.degustations} dég. · {prod.ventes} vente{prod.ventes !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{
                                      width: `${Math.round((prod.degustations / maxProdDeg) * 100)}%`,
                                      background: brandGrad,
                                    }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                            <Gift className="w-3.5 h-3.5" style={{ color: p2 }} />
                            Goodies distribués
                            <span className="font-bold ml-1" style={{ color: p2 }}>
                              ({site.goodies_distribues_total})
                            </span>
                          </p>
                          {site.goodies.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Aucun goodie configuré pour ce site.</p>
                          ) : (
                            <div className="space-y-2">
                              {site.goodies.map(g => (
                                <div key={g.goodie_id} className="flex items-center justify-between text-xs rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                                  <span className="font-medium text-foreground">{g.goodie_nom}</span>
                                  <span className="text-muted-foreground tabular-nums">
                                    {g.quantite_distribuee} / {g.quantite_initiale}
                                  </span>
                                </div>
                              ))}
                            </div>
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
                  <span key={s.id}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border"
                    style={{ background: hex(p1, 0.08), borderColor: hex(p1, 0.25), color: p1 }}>
                    <MapPin className="w-3.5 h-3.5" />{s.nom}{s.ville ? ` · ${s.ville}` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun site associé à cette campagne.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Hostess section ── */}
      {isHostess && (
        <div className="space-y-4">
          {/* Objectives */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center mb-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
                  <Target className="w-3.5 h-3.5" style={{ color: p1 }} />
                </div>
                Mes objectifs
              </h3>
            </div>

            <div className="space-y-5">
              {campaign.objectif_degustations ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4" style={{ color: p1 }} />
                      <span className="font-medium text-foreground">Dégustations</span>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: p1 }}>
                      {tastings.length} / {campaign.objectif_degustations}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}%`,
                        background: brandGrad,
                      }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {Math.min(100, Math.round((tastings.length / campaign.objectif_degustations) * 100))}% atteint
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: hex(p1, 0.07) }}>
                  <UtensilsCrossed className="w-4 h-4 shrink-0" style={{ color: p1 }} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tastings.length} dégustation{tastings.length !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">Aucun objectif défini</p>
                  </div>
                </div>
              )}

              {campaign.objectif_ventes ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" style={{ color: p2 }} />
                      <span className="font-medium text-foreground">Ventes</span>
                    </div>
                    <span className="font-bold tabular-nums" style={{ color: p2 }}>
                      {purchasedCount} / {campaign.objectif_ventes}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}%`,
                        background: `linear-gradient(to right, ${p2}, ${p1})`,
                      }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {Math.min(100, Math.round((purchasedCount / campaign.objectif_ventes) * 100))}% atteint
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: hex(p2, 0.07) }}>
                  <ShoppingCart className="w-4 h-4 shrink-0" style={{ color: p2 }} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{purchasedCount} vente{purchasedCount !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">Aucun objectif défini</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent tastings */}
          {tastings.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p2, 0.12) }}>
                  <UtensilsCrossed className="w-3.5 h-3.5" style={{ color: p2 }} />
                </div>
                Mes dégustations récentes
              </h3>
              <div className="space-y-2">
                {tastings.slice(0, 5).map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: brandGrad }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{t.produit_nom}</span>
                      {t.nom_client && (
                        <span className="text-muted-foreground ml-2 text-xs">· {t.nom_client}</span>
                      )}
                      <span className="text-muted-foreground ml-2 text-xs">{t.tranche_age_display}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{t.note_gout}/5
                    </div>
                    {t.a_achete && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">✓</span>
                    )}
                  </div>
                ))}
                {tastings.length > 5 && (
                  <p className="text-xs text-center text-muted-foreground">+{tastings.length - 5} autres</p>
                )}
              </div>
            </div>
          )}

          {/* Inline tasting form */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100" style={{ background: hex(p1, 0.06) }}>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.15) }}>
                  <UtensilsCrossed className="w-3.5 h-3.5" style={{ color: p1 }} />
                </div>
                Enregistrer une dégustation
              </h3>
            </div>
            <form onSubmit={handleDegSubmit} className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Campagne</Label>
                  <Input value={siteInfo?.campagne_nom ?? campaign.nom} readOnly disabled className="bg-slate-50 text-foreground cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label>Hôtesse</Label>
                  <Input value={user?.name ?? ""} readOnly disabled className="bg-slate-50 text-foreground cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Site *</Label>
                  <Select value={degForm.site} onValueChange={handleSiteChange}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {campaignSites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produit *</Label>
                  <Select value={degForm.produit} onValueChange={v => setDegForm(f => ({ ...f, produit: v }))} disabled={!degForm.site || loadingSite}>
                    <SelectTrigger>{loadingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Sélectionner" />}</SelectTrigger>
                    <SelectContent>
                      {(siteInfo?.produits ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nom du client <span className="text-muted-foreground text-xs font-normal">(utilisé pour la roue)</span></Label>
                <Input value={degForm.nom_client} onChange={e => setDegForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Prénom…" />
              </div>

              <div className="space-y-2">
                <Label>Tranche d&apos;âge *</Label>
                <Select value={degForm.tranche_age} onValueChange={v => setDegForm(f => ({ ...f, tranche_age: v as TrancheAge }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Note du goût *</Label>
                <div className="flex justify-between gap-2">
                  {RATING_ICONS.map(r => (
                    <button key={r.rating} type="button" onClick={() => setDegForm(f => ({ ...f, note_gout: r.rating }))}
                      className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all flex-1",
                        degForm.note_gout === r.rating ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-border hover:border-indigo-300")}>
                      {r.icon}
                      <span className="text-xs font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Intention d&apos;achat *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {INTENT_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setDegForm(f => ({ ...f, intention_achat: o.value }))}
                      className={cn("py-3 px-2 rounded-lg border-2 font-medium transition-all text-sm",
                        degForm.intention_achat === o.value ? o.color + " border-current" : "border-border hover:border-indigo-300")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Le client a-t-il acheté ?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setDegForm(f => ({ ...f, a_achete: false }))}
                    className={cn("py-3.5 rounded-xl border-2 font-medium transition-all", !degForm.a_achete ? "border-slate-400 bg-slate-50" : "border-border hover:border-slate-300")}>
                    Non
                  </button>
                  <button type="button" onClick={() => setDegForm(f => ({ ...f, a_achete: true }))}
                    className={cn("py-3.5 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2",
                      degForm.a_achete ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:border-emerald-400")}>
                    <CheckCircle2 className="w-4 h-4" />Oui !
                  </button>
                </div>
              </div>

              {degForm.a_achete && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Conditionnement *</Label>
                    <Select value={degForm.conditionnement} onValueChange={v => setDegForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                        <SelectItem value="PACK">En pack</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantité *</Label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDegForm(f => ({ ...f, quantite: Math.max(1, f.quantite - 1) }))} className="w-9 h-9 rounded-lg border-2 border-input flex items-center justify-center text-lg font-bold hover:bg-muted">−</button>
                      <Input type="number" min="1" value={degForm.quantite} onChange={e => setDegForm(f => ({ ...f, quantite: Math.max(1, parseInt(e.target.value) || 1) }))} className="w-16 text-center font-semibold h-9" />
                      <button type="button" onClick={() => setDegForm(f => ({ ...f, quantite: f.quantite + 1 }))} className="w-9 h-9 rounded-lg border-2 border-input flex items-center justify-center text-lg font-bold hover:bg-muted">+</button>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={savingDeg} className="w-full h-12 text-white text-base font-semibold" style={{ background: brandGrad }}>
                {savingDeg ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : <><UtensilsCrossed className="w-4 h-4 mr-2" />Enregistrer &amp; lancer la roue 🎡</>}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── Superviseur section ── */}
      {!isAdmin && !isHostess && !isEntreprise && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
              <Target className="w-3.5 h-3.5" style={{ color: p1 }} />
            </div>
            Suivi de la campagne
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Dégustations", value: tastings.length },
              { label: "Acheteurs",    value: purchasedCount   },
              { label: "Conversion",   value: `${convRate}%`   },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border p-3 text-center"
                style={{ background: hex(i % 2 === 0 ? p1 : p2, 0.08), borderColor: hex(i % 2 === 0 ? p1 : p2, 0.2) }}>
                <p className="text-xl font-black" style={{ color: i % 2 === 0 ? p1 : p2 }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Wheel Dialog ── */}
      {isHostess && campaign && (
        <Dialog open={wheelOpen} onOpenChange={open => { if (!open) { setWheelOpen(false); setWonPrize(null); wheelRotationRef.current = 0; } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl"><Trophy className="w-6 h-6 text-amber-500" />Roue de fortune</DialogTitle>
              <DialogDescription>
                {wonPrize ? wonPrize === "Réessayez" ? "Pas de chance cette fois !" : `🎉 Bravo ${wheelClientName} !` : `Faites tourner la roue pour ${wheelClientName}`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-1">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold" style={{ background: hex(p1, 0.1), borderColor: hex(p1, 0.3), color: p1 }}>👤 {wheelClientName}</div>
              <div className="relative"><canvas ref={wheelCanvasRef} width={280} height={280} className="max-w-full" /></div>
              {wonPrize && <div className={cn("w-full rounded-2xl p-3.5 text-center font-bold text-base border", wonPrize === "Réessayez" ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-amber-50 border-amber-200 text-amber-700")}>{wonPrize === "Réessayez" ? "😔 Réessayez" : `🎁 ${wonPrize}`}</div>}
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
              <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-slate-100">
                {WHEEL_PRIZES.map((prize, i) => (
                  <div key={prize.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{prize.name}
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}