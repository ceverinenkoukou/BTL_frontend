"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type {
  CampagneDetail, Degustation, Vente, SiteList, MonSiteInfo,
  CreateDegustationPayload, TrancheAge, IntentionAchat, TypeConditionnement, Genre,
  CampagneRapportSites, TypePromotion, Promotion, Goodie, JourAnimation, RapportConfig,
  Pointage, LivraisonGoodiesJour, DonneesSiteJour,
} from "@/lib/types/backend";
import { DEFAULT_RAPPORT_CONFIG } from "@/lib/types/backend";
import { getGoodiesByCampagne } from "@/lib/services/goodieService";
import { genererObjectifsCampagne } from "@/lib/services/objectifService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Target, Users, Building2,
  UtensilsCrossed, ShoppingCart, TrendingUp, BarChart3,
  Sparkles, Star, Plus, Loader2, CheckCircle2, Edit,
  Frown, Meh, Smile, Laugh, Heart, Gift, Trophy, RotateCcw, MapPin, Package, Tag, UserPlus,
  Clock, Trash2, FerrisWheel,
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
import CampaignReport from "@/components/Campaignreport";
import ReportConfigPanel from "@/components/dashboard/ReportConfigPanel";
import RapportJournalierConfigPanel from "@/components/dashboard/RapportJournalierConfigPanel";

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

/** Une offre ciblée sur des sites précis (`sites.length > 0`) n'est proposable
 * que sur ces sites — sinon enregistrer-gain la rejette (400) alors que la
 * dégustation a déjà été créée, ce qui produit des ventes orphelines. */
function isPromoEligibleForSite(promo: Promotion, siteId: string): boolean {
  return promo.is_active && ((promo.sites?.length ?? 0) === 0 || (!!siteId && !!promo.sites?.includes(siteId)));
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

const RATING_ICONS_5: { rating: number; icon: React.ReactNode; label: string }[] = [
  { rating: 1, icon: <Frown className="w-7 h-7" />,  label: "Mauvais"   },
  { rating: 2, icon: <Meh className="w-7 h-7" />,    label: "Bof"       },
  { rating: 3, icon: <Smile className="w-7 h-7" />,  label: "Correct"   },
  { rating: 4, icon: <Laugh className="w-7 h-7" />,  label: "Bon"       },
  { rating: 5, icon: <Heart className="w-7 h-7" />,  label: "Excellent" },
];

const WHEEL_COLORS = ["#f97316","#3b82f6","#22c55e","#eab308","#ec4899","#8b5cf6","#14b8a6","#ef4444"];

type WheelPrize = {
  id: string;
  name: string;
  isGoodie: boolean;
};

function normalizeWheelDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function getPrizeAtPointer<T extends WheelPrize>(prizes: T[], rotationDegrees: number): T | null {
  if (prizes.length === 0) return null;
  const anglePerSlice = 360 / prizes.length;
  const pointerAngleOnWheel = normalizeWheelDegrees(-rotationDegrees);
  const index = Math.floor(pointerAngleOnWheel / anglePerSlice) % prizes.length;
  return prizes[index] ?? null;
}

function fitCanvasLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 3 && ctx.measureText(`${shortened}...`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

const EMPTY_DEG_FORM = {
  site:            "",
  produit:         "",
  tranche_age:     "" as TrancheAge | "",
  genre:           "" as Genre | "",
  note_gout:       0,
  note_ambiance:   0,
  intention_achat: "" as IntentionAchat | "",
  nom_client:      "",
  promotion_selectionnee: "" as string | "",
  conditionnement: "UNITE" as TypeConditionnement,
  quantite:        1,
};

const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "HOMME", label: "Homme" },
  { value: "FEMME", label: "Femme" },
];

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
  TIRAGE: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    icon: "🎡",
    label: "Tirage à la roue",
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
  const [degStep, setDegStep] = useState<1 | 2 | 3>(1);
  const [showDegConfirm, setShowDegConfirm] = useState(false);
  const [loadingSite, setLoadingSite] = useState(false);
  const [siteInfo, setSiteInfo] = useState<MonSiteInfo | null>(null);
  const activeSiteRef = useRef<string>("");
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
  const [savingWheelGain, setSavingWheelGain] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [pendingDegustationId, setPendingDegustationId] = useState<string | null>(null);
  const [wonPrize, setWonPrize] = useState<WheelPrize | null>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const wheelRotationRef = useRef(0);
  const [activeWheelPromoId, setActiveWheelPromoId] = useState<string | null>(null);
  const [tirageGoodiesOverride, setTirageGoodiesOverride] = useState<{ id: string; nom: string }[] | null>(null);

  // Statistiques de l'entreprise
  const [entrepriseStats, setEntrepriseStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Config rapport ──
  const [reportConfig, setReportConfig] = useState<RapportConfig | null>(null);

  // ── Pointage hôtesse ──
  const [pointageDuJour, setPointageDuJour] = useState<Pointage | null | undefined>(undefined);
  const [savingPointage, setSavingPointage] = useState<"arrivee" | "depart" | null>(null);

  // ── Livraisons goodies (admin/superviseur) ──
  const [livraisons, setLivraisons] = useState<LivraisonGoodiesJour[]>([]);
  const [livraisonForm, setLivraisonForm] = useState({ goodie: "", date: new Date().toISOString().slice(0, 10), quantite: 1 });
  const [livraisonSite, setLivraisonSite] = useState("");
  const [savingLivraison, setSavingLivraison] = useState(false);

  // ── Données du site / jour : stock de boissons, boissons gratuites (admin/superviseur) ──
  const [donneesSiteJour, setDonneesSiteJour] = useState<DonneesSiteJour[]>([]);
  const [donneesSiteForm, setDonneesSiteForm] = useState({
    site: "", date: new Date().toISOString().slice(0, 10),
    conditionnement: "UNITE" as TypeConditionnement,
    stock_boissons: "", nombre_boissons_gratuites: "",
  });
  const [savingDonneesSite, setSavingDonneesSite] = useState(false);

  // ── Planning (jours animés) ──
  const [joursAnimation, setJoursAnimation] = useState<JourAnimation[]>([]);
  const [planForm, setPlanForm] = useState({ date: "", heure_ouverture: "08:00", heure_fermeture: "18:00", site: "" });
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const fetchPlanning = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<JourAnimation[]>(`/jours-animation/?campagne=${id}`);
      setJoursAnimation(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  }, [id]);

  const handleAddJour = async () => {
    if (!planForm.date) { setPlanError("La date est requise."); return; }
    setSavingPlan(true); setPlanError("");
    try {
      await api.post("/jours-animation/", {
        campagne: id,
        site: planForm.site || null,
        date: planForm.date,
        heure_ouverture: planForm.heure_ouverture,
        heure_fermeture: planForm.heure_fermeture,
      });
      setPlanForm({ date: "", heure_ouverture: "08:00", heure_fermeture: "18:00", site: "" });
      fetchPlanning();
    } catch (e: any) {
      const d = e?.response?.data;
      setPlanError(d?.date?.[0] || d?.heure_fermeture?.[0] || d?.detail || "Erreur lors de l'ajout.");
    } finally { setSavingPlan(false); }
  };

  const handleDeleteJour = async (jourId: string) => {
    try {
      await api.delete(`/jours-animation/${jourId}/`);
      fetchPlanning();
    } catch { toast.error("Impossible de supprimer ce jour."); }
  };

  // ── Manage-team dialog ──
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [allStaff, setAllStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [teamSel, setTeamSel] = useState<{ superviseurs_ids: string[]; hotesses_ids: string[] }>({ superviseurs_ids: [], hotesses_ids: [] });
  const [savingTeam, setSavingTeam] = useState(false);

  useEffect(() => { if (id) fetchPlanning(); }, [id, fetchPlanning]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const requests: Promise<unknown>[] = [
        api.get<CampagneDetail>(`/campagnes/${id}/`),
        api.get<Degustation[]>(`/degustations/?campagne=${id}`),
        api.get<Vente[]>(`/ventes/?campagne=${id}`),
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

      // Charger le pointage du jour (hôtesse)
      if (user?.role === "Hotesse") {
        const siteOfHostess = allSites.filter(s => s.campagne === id)[0];
        if (siteOfHostess) {
          try {
            const ptRes = await api.get<Pointage | null>(
              `/pointages/mon-pointage-du-jour/?site_id=${siteOfHostess.id}`
            );
            setPointageDuJour(ptRes.data ?? null);
          } catch { setPointageDuJour(null); }
        }
      }

      // Charger les livraisons goodies + config rapport (admin + superviseur)
      if (user?.role === "Administrateur" || user?.role === "Superviseur") {
        try {
          const livrRes = await api.get<LivraisonGoodiesJour[]>(`/livraisons-goodies/?campagne=${id}`);
          setLivraisons(Array.isArray(livrRes.data) ? livrRes.data : []);
        } catch { setLivraisons([]); }
        try {
          const dsjRes = await api.get<DonneesSiteJour[]>(`/donnees-site-jour/?campagne=${id}`);
          setDonneesSiteJour(Array.isArray(dsjRes.data) ? dsjRes.data : []);
        } catch { setDonneesSiteJour([]); }
      }

      // Charger la config rapport (admin + superviseur)
      if (user?.role === "Administrateur" || user?.role === "Superviseur") {
        try {
          const cfgRes = await api.get<RapportConfig | { detail: string; defaults: boolean }>(
            `/rapport-configs/par-campagne/?campagne=${id}`
          );
          if ("defaults" in cfgRes.data && cfgRes.data.defaults) {
            setReportConfig(null);
          } else {
            setReportConfig(cfgRes.data as RapportConfig);
          }
        } catch {
          setReportConfig(null);
        }
      }

      if (user?.role === "Entreprise" && results[4]) {
        setSiteRapport((results[4] as { data: CampagneRapportSites }).data);
        
        // Charger les stats de l'entreprise si disponible
        const userWithEntrepriseId = user as any;
        if (userWithEntrepriseId.entreprise_id) {
          try {
            setLoadingStats(true);
            const statsRes = await api.get<any>(`/entreprises/${userWithEntrepriseId.entreprise_id}/statistiques/`);
            setEntrepriseStats(statsRes.data);
          } catch {
            setEntrepriseStats(null);
          } finally {
            setLoadingStats(false);
          }
        }
      } else {
        setSiteRapport(null);
      }
    } catch {
      toast.error("Impossible de charger la campagne.");
      router.push("/dashboard/campaigns");
    } finally {
      setLoading(false);
    }
  }, [id, router, user?.role, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Pointage hôtesse ──
  const handlePointerArrivee = useCallback(async () => {
    if (!campaignSites[0]) return;
    setSavingPointage("arrivee");
    try {
      const res = await api.post<{ pointage: typeof pointageDuJour }>("/pointages/pointer-arrivee/", {
        site_id: campaignSites[0].id,
      });
      setPointageDuJour(res.data.pointage as any);
      toast.success(res.data ? `Arrivée pointée` : "Déjà pointé");
    } catch { toast.error("Erreur lors du pointage d'arrivée."); }
    finally { setSavingPointage(null); }
  }, [campaignSites]);

  const handlePointerDepart = useCallback(async () => {
    if (!campaignSites[0]) return;
    setSavingPointage("depart");
    try {
      const res = await api.post<{ pointage: typeof pointageDuJour }>("/pointages/pointer-depart/", {
        site_id: campaignSites[0].id,
      });
      setPointageDuJour(res.data.pointage as any);
      toast.success("Départ pointé !");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Erreur lors du pointage de départ.");
    } finally { setSavingPointage(null); }
  }, [campaignSites]);

  // ── Livraison goodies (admin/superviseur) ──
  const handleSubmitLivraison = useCallback(async () => {
    if (!livraisonForm.goodie || !livraisonSite || !livraisonForm.date) {
      toast.error("Remplissez tous les champs."); return;
    }
    setSavingLivraison(true);
    try {
      const res = await api.post<LivraisonGoodiesJour>("/livraisons-goodies/", {
        site: livraisonSite,
        goodie: livraisonForm.goodie,
        date: livraisonForm.date,
        quantite_apportee: livraisonForm.quantite,
      });
      setLivraisons(prev => {
        const idx = prev.findIndex(l => l.site === res.data.site && l.goodie === res.data.goodie && l.date === res.data.date);
        if (idx >= 0) { const n = [...prev]; n[idx] = res.data; return n; }
        return [res.data, ...prev];
      });
      toast.success("Livraison enregistrée !");
      setLivraisonForm(f => ({ ...f, goodie: "", quantite: 1 }));
    } catch { toast.error("Erreur lors de l'enregistrement."); }
    finally { setSavingLivraison(false); }
  }, [livraisonForm, livraisonSite]);

  // ── Données du site / jour : stock de boissons, boissons gratuites (admin/superviseur) ──
  const handleSubmitDonneesSiteJour = useCallback(async () => {
    if (!donneesSiteForm.site || !donneesSiteForm.date) {
      toast.error("Sélectionnez un site et une date."); return;
    }
    setSavingDonneesSite(true);
    try {
      const res = await api.post<DonneesSiteJour>("/donnees-site-jour/", {
        site: donneesSiteForm.site,
        date: donneesSiteForm.date,
        conditionnement: donneesSiteForm.conditionnement,
        stock_boissons: donneesSiteForm.stock_boissons === "" ? null : Number(donneesSiteForm.stock_boissons),
        nombre_boissons_gratuites: donneesSiteForm.nombre_boissons_gratuites === "" ? null : Number(donneesSiteForm.nombre_boissons_gratuites),
      });
      setDonneesSiteJour(prev => {
        const idx = prev.findIndex(d => d.site === res.data.site && d.date === res.data.date);
        if (idx >= 0) { const n = [...prev]; n[idx] = res.data; return n; }
        return [res.data, ...prev];
      });
      toast.success("Données du site enregistrées !");
    } catch { toast.error("Erreur lors de l'enregistrement."); }
    finally { setSavingDonneesSite(false); }
  }, [donneesSiteForm]);

  const openTeamDialog = useCallback(async () => {
    try {
      const { data } = await api.get<{ id: string; name: string; role: string }[]>("/users/terrain-staff/");
      const staff = Array.isArray(data) ? data : (data as any).results ?? [];
      setAllStaff(staff);
      setTeamSel({
        superviseurs_ids: (campaign?.superviseurs ?? []).map(s => s.id),
        hotesses_ids:     (campaign?.hotesses     ?? []).map(h => h.id),
      });
      setTeamDialogOpen(true);
    } catch {
      toast.error("Impossible de charger le personnel.");
    }
  }, [campaign]);

  const toggleTeamMember = (role: "superviseurs_ids" | "hotesses_ids", memberId: string) => {
    setTeamSel(prev => {
      const arr = prev[role];
      return { ...prev, [role]: arr.includes(memberId) ? arr.filter(x => x !== memberId) : [...arr, memberId] };
    });
  };

  const handleSaveTeam = async () => {
    if (!campaign) return;
    setSavingTeam(true);
    try {
      await api.post(`/campagnes/${campaign.id}/manage-team/`, { ...teamSel, notify: true });
      toast.success("Équipe mise à jour. Les nouveaux membres ont été notifiés.");
      setTeamDialogOpen(false);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la mise à jour de l'équipe.");
    } finally {
      setSavingTeam(false);
    }
  };

  const refreshSiteInfo = useCallback(async () => {
    const siteId = activeSiteRef.current;
    if (!siteId) return;
    try {
      invalidateCache("/degustations/mon-site");
      const { data } = await api.get<MonSiteInfo>(`/degustations/mon-site/?site_id=${siteId}`);
      setSiteInfo(data);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) refreshSiteInfo(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(refreshSiteInfo, 60_000);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [refreshSiteInfo]);

  const handleSiteChange = async (siteId: string) => {
    activeSiteRef.current = siteId;
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

  const getWheelPrizes = useCallback((): WheelPrize[] => {
    // TIRAGE promo with specific goodies linked to the promotion — contenu
    // déjà filtré côté backend par stock du jour/site (cf. handlePromoGain /
    // handleDegSubmit).
    if (tirageGoodiesOverride !== null) {
      if (tirageGoodiesOverride.length === 0) return [];
      return tirageGoodiesOverride.map(g => ({ id: g.id, name: g.nom, isGoodie: true }));
    }
    // TIRAGE/GAGNE sans goodies spécifiques à la promo, ou roue "Goodies"
    // classique : dans les deux cas, seuls les goodies avec un stock du jour
    // disponible sur ce site apparaissent (filtré côté backend dans
    // goodies_disponibles). Tant que siteInfo n'a pas encore chargé, on
    // affiche le catalogue complet de la campagne ; une fois chargé, une
    // liste vide signifie réellement "rupture sur ce site aujourd'hui" et
    // ne doit pas retomber sur le catalogue complet.
    const activeGoodies: { id: string; name: string }[] = siteInfo
      ? siteInfo.goodies_disponibles.map(g => ({ id: g.id, name: g.nom }))
      : goodies.map(g => ({ id: g.id, name: g.nom }));
    if (activeGoodies.length === 0) return [];
    return activeGoodies.map(g => ({ id: g.id, name: g.name, isGoodie: true }));
  }, [goodies, siteInfo, tirageGoodiesOverride]);

  const drawWheelImmediate = (rot: number) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 28;
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
      ctx.fillText("ou disponible", cx, cy + 24);
      return;
    }

    const anglePerSlice = (2 * Math.PI) / wheelPrizes.length;
    const rotRad = (rot * Math.PI) / 180;

    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.24)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    const rim = ctx.createRadialGradient(cx, cy, radius * 0.62, cx, cy, radius + 16);
    rim.addColorStop(0, "#f8fafc");
    rim.addColorStop(0.74, "#334155");
    rim.addColorStop(1, "#0f172a");
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 16, 0, 2 * Math.PI);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.restore();

    wheelPrizes.forEach((prize, i) => {
      const startAngle = i * anglePerSlice + rotRad;
      const endAngle = (i + 1) * anglePerSlice + rotRad;
      const middleAngle = startAngle + anglePerSlice / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy);
      ctx.rotate(middleAngle);
      const flipped = Math.cos(middleAngle) < 0;
      if (flipped) ctx.rotate(Math.PI);
      ctx.textAlign = flipped ? "left" : "right";
      ctx.fillStyle = "#fff";
      ctx.font = "700 12px sans-serif";
      ctx.shadowColor = "rgba(15, 23, 42, 0.42)";
      ctx.shadowBlur = 4;
      const label = fitCanvasLabel(ctx, prize.name, Math.max(54, radius * 0.42));
      ctx.fillText(label, flipped ? -(radius - 18) : radius - 18, 5);
      ctx.restore();
    });

    const innerGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
    innerGlow.addColorStop(0, "rgba(255,255,255,0.18)");
    innerGlow.addColorStop(0.52, "rgba(255,255,255,0.05)");
    innerGlow.addColorStop(1, "rgba(15,23,42,0.14)");
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = innerGlow; ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4; ctx.stroke();

    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    const hub = ctx.createRadialGradient(cx - 8, cy - 10, 5, cx, cy, 30);
    hub.addColorStop(0, "#ffffff");
    hub.addColorStop(0.55, "#f8fafc");
    hub.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = hub; ctx.fill();
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.font = "800 10px sans-serif";
    ctx.fillText("BTL", cx, cy + 4);

    ctx.beginPath();
    ctx.moveTo(cx + radius + 22, cy);
    ctx.lineTo(cx + radius - 8, cy - 16);
    ctx.lineTo(cx + radius - 8, cy + 16);
    ctx.closePath(); ctx.fillStyle = "#f97316"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
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
    const anglePerSlice = 360 / wheelPrizes.length;
    const prizeAngle = idx * anglePerSlice + anglePerSlice / 2;
    const totalSpins = 5 + Math.floor(Math.random() * 3);
    const startRot = wheelRotationRef.current;
    const normalizedStart = normalizeWheelDegrees(startRot);
    const targetFinalRot = (360 - prizeAngle + 360) % 360;
    const delta = (targetFinalRot - normalizedStart + 360) % 360;
    const targetRot = normalizedStart + 360 * totalSpins + delta;
    const duration = 5000;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      wheelRotationRef.current = normalizedStart + (targetRot - normalizedStart) * eased;
      drawWheelImmediate(wheelRotationRef.current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setWheelSpinning(false);
        const finalPrize = getPrizeAtPointer(wheelPrizes, targetRot);
        setWonPrize(finalPrize);
        if (finalPrize?.isGoodie) {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        }
      }
    };
    requestAnimationFrame(animate);
  };

  const handleConfirmWheelGain = async (closeWheel: () => void) => {
    if (!wonPrize) return;
    if (!wonPrize.isGoodie) {
      closeWheel();
      setWonPrize(null);
      wheelRotationRef.current = 0;
      return;
    }

    const siteId = degForm.site || siteInfo?.site_id;
    if (!siteId) {
      toast.error("Aucun site sélectionné pour enregistrer le goodie.");
      return;
    }

    setSavingWheelGain(true);
    try {
      const { data } = await api.post<{ stock_jour_restant?: number }>("/gains-goodies/enregistrer/", {
        goodie_id: wonPrize.id,
        site_id: siteId,
        nom_client: wheelClientName.trim() || undefined,
        promotion_id: activeWheelPromoId || undefined,
        degustation_id: pendingDegustationId || undefined,
      });
      invalidateCache("/gains-goodies");
      invalidateCache("/goodies");
      const restant = data.stock_jour_restant;
      const stockMsg = restant !== undefined
        ? (restant > 0 ? ` — ${restant} restant${restant > 1 ? "s" : ""} aujourd'hui` : " — dernier du jour !")
        : "";
      toast.success(`Gain enregistré : ${wonPrize.name}${stockMsg}`);
      closeWheel();
      setWonPrize(null);
      wheelRotationRef.current = 0;
      setPendingDegustationId(null);
      // Recharge le stock du jour du site (un goodie épuisé doit disparaître
      // de la roue immédiatement, sans attendre le rafraîchissement périodique).
      refreshSiteInfo();
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement du goodie.");
    } finally {
      setSavingWheelGain(false);
    }
  };

  useEffect(() => {
    if (activeWheelPromoId || wheelOpen) {
      wheelRotationRef.current = 0;
      const t = setTimeout(() => drawWheelImmediate(0), 80);
      return () => clearTimeout(t);
    }
  }, [activeWheelPromoId, wheelOpen]);

  useEffect(() => {
    if ((activeWheelPromoId || wheelOpen) && !wheelSpinning) {
      const t = setTimeout(() => drawWheelImmediate(wheelRotationRef.current), 50);
      return () => clearTimeout(t);
    }
  }, [siteInfo, goodies, activeWheelPromoId, wheelOpen, wheelSpinning]);

  useEffect(() => {
    if (isHostess && campaignSites.length === 1 && !degForm.site) {
      handleSiteChange(campaignSites[0].id);
    }
  }, [campaignSites.length, isHostess]);

  const handlePromoGain = async (promoId: string, promoDesc: string, siteId: string) => {
    if (!siteId) { toast.error("Sélectionnez d'abord un site."); return; }
    setSavingGain(promoId);
    try {
      const { data: gainRes } = await api.post<{
        tirage_disponible: boolean;
        goodies_roue: { id: string; nom: string }[];
      }>(`/promotions/${promoId}/enregistrer-gain/`, {
        site_id: siteId,
        produit_id: degForm.produit || undefined,
        nom_client: gainClientName.trim() || undefined,
        tranche_age: gainClientAge || undefined,
      });
      setPromoGains(prev => ({ ...prev, [promoId]: (prev[promoId] ?? 0) + 1 }));
      toast.success(`Gain enregistré : ${promoDesc} 🎉`);

      const promo = campaign?.promotions?.find(p => p.id === promoId);
      const chosenAction = promoAction[promoId] ?? promo?.type_promotion ?? "OFFERT";
      if (chosenAction === "GAGNE" || gainRes.tirage_disponible) {
        setWheelClientName(gainClientName.trim() || "Client");
        setWonPrize(null);
        wheelRotationRef.current = 0;
        setWheelSpinning(false);
        // Override seulement si la promo restreint à des goodies précis
        // (le contenu vient du backend, déjà filtré par stock du jour/site) ;
        // sinon repli sur le stock du jour du site, pas tout le catalogue.
        const promoHasSpecificGoodies = (promo?.goodies_details?.length ?? 0) > 0;
        if (gainRes.tirage_disponible && promoHasSpecificGoodies) {
          setTirageGoodiesOverride(gainRes.goodies_roue);
        } else {
          setTirageGoodiesOverride(null);
        }
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
    const isVenteCampaign = campaign?.type_campagne === "VENTE";
    const isPromoMode = campaign?.type_recompense === "PROMOTIONS";
    const baseValid = degForm.site && degForm.produit && degForm.tranche_age && degForm.genre;
    const noteRequired     = !!campaign?.note_gout_active;
    const ambianceRequired = !!campaign?.note_ambiance_active;
    const promoChoiceValid = !isPromoMode || degForm.promotion_selectionnee !== "";
    const promoValid = (isPromoMode
      ? baseValid && (!noteRequired || degForm.note_gout) && (!ambianceRequired || degForm.note_ambiance)
      : baseValid && (showTasting ? ((noteRequired ? degForm.note_gout : true) && (ambianceRequired ? degForm.note_ambiance : true) && degForm.intention_achat) : (!noteRequired || degForm.note_gout) && (!ambianceRequired || degForm.note_ambiance))
    ) && promoChoiceValid;
    if (!promoValid) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSavingDeg(true);
    try {
      const clientName = degForm.nom_client.trim();

      if (isVenteCampaign) {
        // ── VENTE : enregistrement direct dans Vente, sans Degustation ──
        const willRegisterPromo = isPromoMode && degForm.promotion_selectionnee !== "" && degForm.promotion_selectionnee !== "__NONE__";
        let selectedPromo = null;
        let promoGoodiesRoue: { id: string; nom: string }[] = [];

        if (willRegisterPromo) {
          // La promo crée elle-même la Vente NORMAL + Vente PROMOTION en interne
          selectedPromo = campaign?.promotions?.find(p => p.id === degForm.promotion_selectionnee) ?? null;
          if (selectedPromo) {
            try {
              const { data: promoGainRes } = await api.post<{ goodies_roue: { id: string; nom: string }[] }>(
                `/promotions/${selectedPromo.id}/enregistrer-gain/`,
                {
                  site_id: degForm.site,
                  produit_id: degForm.produit,
                  nom_client: clientName || undefined,
                  tranche_age: degForm.tranche_age || undefined,
                  genre: degForm.genre || undefined,
                }
              );
              promoGoodiesRoue = promoGainRes.goodies_roue ?? [];
              toast.success("Gain promotionnel enregistré ! 🎉");
            } catch (promoErr: unknown) {
              const promoMsg = (promoErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
              toast.warning(promoMsg ?? "Erreur lors de l'enregistrement de la promotion.");
            }
          }
        } else {
          // Vente simple (ou promo mode sans promo sélectionnée)
          const { data: createdVente } = await api.post<Vente>("/ventes/creer-directe/", {
            site_id: degForm.site,
            produit_id: degForm.produit,
            conditionnement: degForm.conditionnement || "UNITE",
            quantite: Number(degForm.quantite) || 1,
            nom_client: clientName || undefined,
            tranche_age: degForm.tranche_age || undefined,
            genre: degForm.genre || undefined,
          });
          setVentes(prev => [createdVente, ...prev]);
          invalidateCache("/ventes");
        }

        setDegForm(f => ({ ...EMPTY_DEG_FORM, site: f.site }));
        setDegStep(1);
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(120);
        setShowDegConfirm(true);
        setTimeout(() => {
          setShowDegConfirm(false);
          if (!willRegisterPromo && campaign?.type_recompense === "GOODIES") {
            setWheelClientName(clientName || "Client");
            setWonPrize(null);
            wheelRotationRef.current = 0;
            setWheelSpinning(false);
            setWheelOpen(true);
          } else if (selectedPromo && (selectedPromo.type_promotion === "GAGNE" || selectedPromo.type_promotion === "TIRAGE")) {
            setWheelClientName(clientName || "Client");
            setWonPrize(null);
            wheelRotationRef.current = 0;
            setWheelSpinning(false);
            if (selectedPromo.type_promotion === "TIRAGE" && (selectedPromo.goodies_details?.length ?? 0) > 0) {
              setTirageGoodiesOverride(promoGoodiesRoue);
            } else {
              setTirageGoodiesOverride(null);
            }
            setActiveWheelPromoId(selectedPromo.id);
          }
        }, 1000);

      } else {
        // ── DEGUSTATION / DEGUSTATION_VENTE : flux existant ─────────────
        const a_achete = isPromoMode ? true : false;
        const willRegisterPromo = isPromoMode && degForm.promotion_selectionnee !== "" && degForm.promotion_selectionnee !== "__NONE__";
        const payload: CreateDegustationPayload = {
          site: degForm.site,
          produit: degForm.produit,
          tranche_age: degForm.tranche_age as TrancheAge,
          genre: degForm.genre as Genre,
          note_gout:     campaign?.note_gout_active     ? (degForm.note_gout     || null) : null,
          note_ambiance: campaign?.note_ambiance_active ? (degForm.note_ambiance || null) : null,
          intention_achat: isPromoMode ? "ELEVEE" : (showTasting ? degForm.intention_achat as IntentionAchat : "MOYENNE"),
          a_achete,
          nom_client: clientName || undefined,
          promotion_appliquee: willRegisterPromo,
          ...(isPromoMode && degForm.promotion_selectionnee === "__NONE__" && {
            conditionnement: degForm.conditionnement,
            quantite: degForm.quantite,
          }),
        };
        const { data: created } = await api.post<Degustation>("/degustations/", payload);

        let selectedPromo = null;
        let promoGoodiesRoue: { id: string; nom: string }[] = [];
        if (willRegisterPromo) {
          selectedPromo = campaign?.promotions?.find(p => p.id === degForm.promotion_selectionnee) ?? null;
          if (selectedPromo) {
            try {
              const { data: promoGainRes } = await api.post<{ goodies_roue: { id: string; nom: string }[] }>(
                `/promotions/${selectedPromo.id}/enregistrer-gain/`,
                {
                  site_id: degForm.site,
                  produit_id: degForm.produit,
                  nom_client: clientName || undefined,
                  degustation_id: created.id,
                }
              );
              promoGoodiesRoue = promoGainRes.goodies_roue ?? [];
              toast.success("Gain promotionnel enregistré ! 🎉");
            } catch (promoErr: unknown) {
              const promoMsg = (promoErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
              toast.warning(promoMsg ?? "Erreur lors de l'enregistrement de la promotion.");
            }
          }
        }

        setTastings(prev => [created, ...prev]);
        invalidateCache(`/degustations/?campagne=${id}`);
        setPendingDegustationId(created.id);
        setDegForm(f => ({ ...EMPTY_DEG_FORM, site: f.site }));
        setDegStep(1);
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(120);
        setShowDegConfirm(true);
        setTimeout(() => {
          setShowDegConfirm(false);
          if (campaign?.type_recompense === "GOODIES") {
            setWheelClientName(clientName || "Client");
            setWonPrize(null);
            wheelRotationRef.current = 0;
            setWheelSpinning(false);
            setWheelOpen(true);
          } else if (isPromoMode && selectedPromo && (selectedPromo.type_promotion === "GAGNE" || selectedPromo.type_promotion === "TIRAGE")) {
            setWheelClientName(clientName || "Client");
            setWonPrize(null);
            wheelRotationRef.current = 0;
            setWheelSpinning(false);
            if (selectedPromo.type_promotion === "TIRAGE" && (selectedPromo.goodies_details?.length ?? 0) > 0) {
              setTirageGoodiesOverride(promoGoodiesRoue);
            } else {
              setTirageGoodiesOverride(null);
            }
            setActiveWheelPromoId(selectedPromo.id);
          }
        }, 1000);
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
  // Pour les campagnes VENTE (sans dégustation), le compteur d'objectif ventes
  // lit directement les Vente NORMAL — les anciennes ventes liées à des
  // dégustations ET les nouvelles ventes directes sont ainsi toutes comptées.
  const isVenteCampagne = campaign?.type_campagne === "VENTE";
  const venteNormalCount = isVenteCampagne
    ? ventes.length
    : purchasedCount;
  const ratedTastings  = tastings.filter(t => t.note_gout !== null);
  const avgRating      = ratedTastings.length > 0
    ? Math.round((ratedTastings.reduce((s, t) => s + (t.note_gout ?? 0), 0) / ratedTastings.length) * 10) / 10
    : null;

  const produitSensoryStats = useMemo(
    () => computeProduitSensoryStats(tastings),
    [tastings],
  );

  // ── Données mappées pour CampaignReport ──
  // Hooks must run on every render — including while `campaign` is still
  // loading — so they live above the early returns below, guarded by `campaign &&`.
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
    // ── Données brutes du formulaire hôtesse, pour la section "Détail des dégustations" du rapport ──
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

  const sitesForReport = useMemo(() => campaignSites.map(s => ({
    id: s.id,
    campaign_id: s.campagne,
    zone_id: "",
    name: s.nom,
    address: s.ville || "",
  })), [campaignSites]);

  const userForReport = useMemo(() => user ? {
    id: (user as any).id ?? "",
    email: (user as any).email ?? "",
    full_name: (user as any).name ?? "",
    role: (user.role === "Administrateur" ? "admin"
      : user.role === "Superviseur" ? "supervisor"
      : "company") as "admin" | "supervisor" | "company",
    is_active: true,
    created_at: "",
    updated_at: "",
  } : null, [user]);

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
  const degustationCount = isVenteCampagne ? tastings.length + ventes.length : tastings.length;
  const showDegustationBar = showTasting || (isVenteCampagne && (tastings.length > 0 || !!campaign.objectif_degustations));
  const showWheel    = campaign.type_recompense === "GOODIES";
  const showPromos   = campaign.type_recompense === "PROMOTIONS";

  return (
    <>
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Admin hero banner ── */}
      {isAdmin ? (
        <div
          className="relative overflow-hidden rounded-2xl text-white shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${campaign.couleur_primaire ?? "#4f46e5"} 0%, ${campaign.couleur_secondaire ?? "#7c3aed"} 100%)`,
            boxShadow: `0 20px 60px -10px ${hex(campaign.couleur_primaire ?? "#4f46e5", 0.4)}`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-24 -bottom-10 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Link href="/dashboard/campaigns" className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <nav aria-label="breadcrumb" className="text-xs hidden sm:block">
                  <Link href="/dashboard/campaigns" className="text-white/50 hover:text-white/80 transition-colors">Campagnes</Link>
                  <span className="text-white/50"> / </span>
                  <span className="text-white/80">{campaign.nom}</span>
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 border border-white/30">{campaign.type_campagne_display}</span>
                {campaign.type_recompense !== "AUCUNE" && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 border border-white/30">{campaign.type_recompense_display}</span>
                )}
                <button
                  title="Générer les objectifs par hôtesse"
                  onClick={async () => {
                    try {
                      const res = await genererObjectifsCampagne(id as string);
                      toast.success(res.detail);
                    } catch {
                      toast.error("Erreur lors de la génération des objectifs.");
                    }
                  }}
                  className="text-xs font-semibold px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 transition-colors"
                >
                  Objectifs
                </button>
                <Link href={`/dashboard/campaigns/${id}/edit`} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <Edit className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 backdrop-blur-sm overflow-hidden">
                {campaign.logo_url
                  ? <img src={campaign.logo_url} alt={campaign.entreprise_nom} className="w-full h-full object-contain p-1" />
                  : <span className="text-sm font-bold text-white">{initials(campaign.entreprise_nom ?? "??")}</span>
                }
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
                showDegustationBar && { label: "Dégustations", value: degustationCount, sub: `/ ${campaign.objectif_degustations ?? 0}`, icon: "🍷" },
                showTasting && { label: "Acheteurs", value: purchasedCount, sub: `conv. ${convRate}%`, icon: "🛒" },
                showTasting && campaign.note_gout_active && avgRating !== null && { label: "Note moy.", value: `${avgRating}/${campaign.note_gout_max}`, sub: "satisfaction", icon: "⭐" },
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
        <div
          className="relative overflow-hidden rounded-2xl text-white shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${campaign.couleur_primaire ?? "#4f46e5"} 0%, ${campaign.couleur_secondaire ?? "#7c3aed"} 100%)`,
            boxShadow: `0 12px 40px -8px ${hex(campaign.couleur_primaire ?? "#4f46e5", 0.4)}`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Link href="/dashboard/campaigns" className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <span className="text-white/50 text-xs hidden sm:block">Campagnes / {campaign.nom}</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 border border-white/30">{campaign.type_campagne_display}</span>
                {campaign.type_recompense !== "AUCUNE" && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 border border-white/30">{campaign.type_recompense_display}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 backdrop-blur-sm overflow-hidden">
                {campaign.logo_url
                  ? <img src={campaign.logo_url} alt={campaign.entreprise_nom} className="w-full h-full object-contain p-1" />
                  : <span className="text-sm font-bold text-white">{initials(campaign.entreprise_nom ?? "??")}</span>
                }
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{campaign.nom}</h1>
                <p className="text-white/70 text-sm mt-0.5 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{campaign.entreprise_nom}</p>
              </div>
            </div>
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
              {showDegustationBar && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm"><UtensilsCrossed className="w-4 h-4 text-indigo-500" /><span className="font-medium text-foreground">Dégustations</span></div>
                    <div className="flex items-center gap-2 text-sm"><span className="font-bold text-indigo-700">{degustationCount}</span><span className="text-muted-foreground">/ {campaign.objectif_degustations ?? 0}</span><span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold">{convRate}%</span></div>
                  </div>
                  <div className="h-3 rounded-full bg-indigo-50 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full shadow-sm transition-all duration-700" style={{ width: `${Math.min(100, campaign.objectif_degustations ? Math.round((degustationCount / campaign.objectif_degustations) * 100) : 0)}%` }} />
                  </div>
                </div>
              )}
              {showVente && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4 text-violet-500" /><span className="font-medium text-foreground">Ventes</span></div>
                    <div className="flex items-center gap-2 text-sm"><span className="font-bold text-violet-700">{venteNormalCount}</span><span className="text-muted-foreground">/ {campaign.objectif_ventes ?? 0}</span><span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-semibold">{campaign.objectif_ventes ? Math.min(100, Math.round((venteNormalCount / campaign.objectif_ventes) * 100)) : 0}%</span></div>
                  </div>
                  <div className="h-3 rounded-full bg-violet-50 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full shadow-sm transition-all duration-700" style={{ width: `${campaign.objectif_ventes ? Math.min(100, Math.round((venteNormalCount / campaign.objectif_ventes) * 100)) : 0}%` }} />
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
                          {t.note_gout !== null && <span className="text-xs text-amber-500 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{t.note_gout}/{campaign?.note_gout_max ?? 5}</span>}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-blue-600" /></div>
                  Équipe assignée
                </h3>
                {(isAdmin || isEntreprise) && (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs rounded-lg" onClick={openTeamDialog}>
                    <UserPlus className="w-3.5 h-3.5" /> Gérer
                  </Button>
                )}
              </div>
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

            {/* Planning — jours animés */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0"><Clock className="w-3.5 h-3.5 text-indigo-600" /></div>
                Planning ({joursAnimation.length} jour{joursAnimation.length !== 1 ? "s" : ""})
              </h3>

              {/* Existing days */}
              {joursAnimation.length > 0 ? (
                <div className="space-y-2">
                  {joursAnimation.map(j => (
                    <div key={j.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-xs font-semibold text-foreground">
                          {new Date(j.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <span className="text-xs text-muted-foreground">{j.heure_ouverture.slice(0, 5)}–{j.heure_fermeture.slice(0, 5)}</span>
                        {j.site_nom && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 border border-violet-100 truncate">{j.site_nom}</span>
                        )}
                      </div>
                      {isAdmin && (
                        <button onClick={() => handleDeleteJour(j.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">Aucun jour animé défini</p>
              )}

              {/* Add form — admin only */}
              {isAdmin && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ajouter un jour</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input type="date" value={planForm.date}
                        min={campaign.date_debut} max={campaign.date_fin}
                        onChange={e => setPlanForm(f => ({ ...f, date: e.target.value }))}
                        className="h-8 text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ouverture</Label>
                      <Input type="time" value={planForm.heure_ouverture}
                        onChange={e => setPlanForm(f => ({ ...f, heure_ouverture: e.target.value }))}
                        className="h-8 text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fermeture</Label>
                      <Input type="time" value={planForm.heure_fermeture}
                        onChange={e => setPlanForm(f => ({ ...f, heure_fermeture: e.target.value }))}
                        className="h-8 text-xs mt-0.5" />
                    </div>
                    {campaignSites.length > 0 && (
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Site (optionnel)</Label>
                        <Select value={planForm.site} onValueChange={v => setPlanForm(f => ({ ...f, site: v === "__all__" ? "" : v }))}>
                          <SelectTrigger className="h-8 text-xs mt-0.5">
                            <SelectValue placeholder="Tous les sites" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Tous les sites</SelectItem>
                            {campaignSites.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {planError && <p className="text-xs text-rose-500">{planError}</p>}
                  <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleAddJour} disabled={savingPlan}>
                    {savingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Ajouter
                  </Button>
                </div>
              )}
            </div>

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

            {/* ── Livraisons goodies (admin) ── */}
            {showWheel && goodies.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><Gift className="w-3.5 h-3.5 text-emerald-600" /></div>
                  Goodies livrés / jour
                </h3>
                {/* Stock disponible aujourd'hui */}
                {(() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const todayLivraisons = livraisons.filter(l => l.date === today);
                  if (todayLivraisons.length === 0) return (
                    <p className="text-xs text-muted-foreground italic">Aucune livraison enregistrée pour aujourd'hui.</p>
                  );
                  const bysite = todayLivraisons.reduce((acc, l) => {
                    if (!acc[l.site_nom]) acc[l.site_nom] = [];
                    acc[l.site_nom].push(l);
                    return acc;
                  }, {} as Record<string, typeof livraisons>);
                  return (
                    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/60 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Stock disponible aujourd'hui</p>
                      {Object.entries(bysite).map(([siteNom, items]) => (
                        <div key={siteNom} className="space-y-1">
                          <p className="text-xs font-semibold text-foreground">{siteNom}</p>
                          {items.map(l => (
                            <div key={l.id} className="flex items-center justify-between text-xs pl-2">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                {l.goodie_nom}
                                {l.est_report && <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">↩ J-1</span>}
                              </span>
                              <span className={`font-bold ${l.restants_du_jour === 0 ? "text-rose-500" : l.restants_du_jour <= 3 ? "text-amber-600" : "text-emerald-600"}`}>
                                {l.restants_du_jour} restant{l.restants_du_jour !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* Formulaire saisie livraison */}
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Site</Label>
                      <Select value={livraisonSite} onValueChange={setLivraisonSite}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Site" /></SelectTrigger>
                        <SelectContent>{campaignSites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Goodie</Label>
                      <Select value={livraisonForm.goodie} onValueChange={v => setLivraisonForm(f => ({ ...f, goodie: v }))}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Goodie" /></SelectTrigger>
                        <SelectContent>{goodies.map(g => <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input type="date" className="h-8 text-xs mt-0.5" value={livraisonForm.date} onChange={e => setLivraisonForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantité</Label>
                      <Input type="number" min={1} className="h-8 text-xs mt-0.5" value={livraisonForm.quantite} onChange={e => setLivraisonForm(f => ({ ...f, quantite: parseInt(e.target.value) || 1 }))} />
                    </div>
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSubmitLivraison} disabled={savingLivraison}>
                    {savingLivraison ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Enregistrer livraison
                  </Button>
                </div>
                {/* Historique */}
                {livraisons.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                    {livraisons.slice(0, 10).map(l => (
                      <div key={l.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${l.est_report ? "bg-amber-50 border border-amber-100" : "bg-slate-50"}`}>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{l.goodie_nom}</p>
                          <p className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            {l.site_nom} · {new Date(l.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            {l.est_report && (
                              <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">↩ report J-1</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-right">
                          <span className="text-emerald-600 font-bold">+{l.quantite_apportee}</span>
                          {l.gains_du_jour > 0 && <span className="text-rose-500">−{l.gains_du_jour}</span>}
                          <span className="font-semibold text-foreground">={l.restants_du_jour}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Stock de boissons & boissons gratuites du site (admin) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center shrink-0"><Package className="w-3.5 h-3.5 text-sky-600" /></div>
                Stock de boissons & boissons gratuites (jour)
              </h3>
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Site</Label>
                    <Select value={donneesSiteForm.site} onValueChange={v => setDonneesSiteForm(f => ({ ...f, site: v }))}>
                      <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Site" /></SelectTrigger>
                      <SelectContent>{campaignSites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input type="date" className="h-8 text-xs mt-0.5" value={donneesSiteForm.date} onChange={e => setDonneesSiteForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Conditionnement</Label>
                  <Select value={donneesSiteForm.conditionnement} onValueChange={v => setDonneesSiteForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}>
                    <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                      <SelectItem value="PACK">En pack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Stock de boissons</Label>
                    <Input type="number" min={0} className="h-8 text-xs mt-0.5" value={donneesSiteForm.stock_boissons} onChange={e => setDonneesSiteForm(f => ({ ...f, stock_boissons: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Boissons gratuites</Label>
                    <Input type="number" min={0} className="h-8 text-xs mt-0.5" value={donneesSiteForm.nombre_boissons_gratuites} onChange={e => setDonneesSiteForm(f => ({ ...f, nombre_boissons_gratuites: e.target.value }))} />
                  </div>
                </div>
                <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSubmitDonneesSiteJour} disabled={savingDonneesSite}>
                  {savingDonneesSite ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Enregistrer
                </Button>
              </div>
              {donneesSiteJour.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                  {donneesSiteJour.slice(0, 10).map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{d.site_nom}</p>
                        <p className="text-muted-foreground">{new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-muted-foreground">{d.conditionnement_display}</span>
                        <span className="text-sky-600 font-semibold">Stock {d.stock_boissons ?? "—"}</span>
                        <span className="text-amber-600 font-semibold">Gratuites {d.nombre_boissons_gratuites ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Config rapport + bouton export PDF */}
            <ReportConfigPanel
              campaignId={campaign.id}
              onConfigChange={setReportConfig}
            />
            <RapportJournalierConfigPanel campaignId={campaign.id} />
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
              reportConfig={reportConfig ?? { ...DEFAULT_RAPPORT_CONFIG }}
            />
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
          {((showDegustationBar && campaign.objectif_degustations) || (showVente && campaign.objectif_ventes)) && (
            <div className="pt-3 border-t border-slate-100 grid sm:grid-cols-2 gap-3">
              {showDegustationBar && campaign.objectif_degustations && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: hex(p1, 0.07) }}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: p1 }}><UtensilsCrossed className="w-3.5 h-3.5" /><span className="font-semibold">Objectif dégustations</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p1 }}>{degustationCount} / {campaign.objectif_degustations}</span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((degustationCount / campaign.objectif_degustations) * 100))}%`, background: brandGrad }} /></div>
                  <p className="text-xs text-right" style={{ color: p1 }}>{Math.min(100, Math.round((degustationCount / campaign.objectif_degustations) * 100))}% atteint</p>
                </div>
              )}
              {showVente && campaign.objectif_ventes && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: hex(p2, 0.07) }}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5" style={{ color: p2 }}><ShoppingCart className="w-3.5 h-3.5" /><span className="font-semibold">Objectif ventes</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p2 }}>{venteNormalCount} / {campaign.objectif_ventes}</span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((venteNormalCount / campaign.objectif_ventes) * 100))}%`, background: `linear-gradient(to right, ${p2}, ${p1})` }} /></div>
                  <p className="text-xs text-right" style={{ color: p2 }}>{Math.min(100, Math.round((venteNormalCount / campaign.objectif_ventes) * 100))}% atteint</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Entreprise Section ── */}
      {isEntreprise && (
        <div className="space-y-5">
          {/* Cartes KPI avec jauges colorées */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Carte Objectif Ventes/Distributions */}
            {showVente && campaign?.objectif_ventes && (
              <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ background: hex(p1, 0.02) }}>
                <div className="p-5 border-b border-slate-100" style={{ background: hex(p1, 0.08) }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: hex(p1, 0.15) }}><ShoppingCart className="w-4 h-4" style={{ color: p1 }} /></div>
                      <span className="font-semibold text-sm text-foreground">Distributions</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black" style={{ color: p1 }}>{(siteRapport?.totaux as {ventes?:number})?.ventes ?? 0}</p>
                    <p className="text-xs text-muted-foreground">sur {campaign.objectif_ventes} objectif</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(((siteRapport?.totaux as {ventes?:number})?.ventes ?? 0) / campaign.objectif_ventes * 100, 100)}%`, background: `linear-gradient(90deg, ${p1}, ${p2})` }} />
                  </div>
                  <p className="text-xs font-semibold text-foreground text-center">{Math.round(((siteRapport?.totaux as {ventes?:number})?.ventes ?? 0) / campaign.objectif_ventes * 100)}%</p>
                </div>
              </div>
            )}

            {/* Carte Goodies Gagnés */}
            {goodies.length > 0 && (
              <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ background: hex(p2, 0.02) }}>
                <div className="p-5 border-b border-slate-100" style={{ background: hex(p2, 0.08) }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: hex(p2, 0.15) }}><Gift className="w-4 h-4" style={{ color: p2 }} /></div>
                      <span className="font-semibold text-sm text-foreground">Goodies Gagnés</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black" style={{ color: p2 }}>
                      {siteRapport?.totaux?.goodies_distribues
                        ?? goodies.reduce((sum, g) => sum + (g.quantite_distribuee ?? 0), 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">goodies en temps réel</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: hex(p2, 0.1), color: p2 }}>🎁 Distribué en direct</div>
                </div>
              </div>
            )}

            {/* Carte Canettes Offertes */}
            {goodies.length > 0  && (
              <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ background: hex("#ec4899", 0.02) }}>
                <div className="p-5 border-b border-slate-100" style={{ background: hex("#ec4899", 0.08) }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: hex("#ec4899", 0.15) }}><Sparkles className="w-4 h-4" style={{ color: "#ec4899" }} /></div>
                      <span className="font-semibold text-sm text-foreground">Canettes Offertes</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black" style={{ color: "#ec4899" }}>{ventes.filter(v => v.type_vente === "GRATUIT").length}</p>
                    <p className="text-xs text-muted-foreground">offertes avec goodies</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: hex("#ec4899", 0.1), color: "#ec4899" }}>📦 Produits offerts</div>
                </div>
              </div>
            )}

            {/* Carte Conversion */}
            {showTasting && (
              <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ background: hex("#14b8a6", 0.02) }}>
                <div className="p-5 border-b border-slate-100" style={{ background: hex("#14b8a6", 0.08) }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: hex("#14b8a6", 0.15) }}><TrendingUp className="w-4 h-4" style={{ color: "#14b8a6" }} /></div>
                      <span className="font-semibold text-sm text-foreground">Conversion</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black" style={{ color: "#14b8a6" }}>{convRate}%</p>
                    <p className="text-xs text-muted-foreground">{purchasedCount} acheteurs</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${convRate}%`, background: "#14b8a6" }} />
                  </div>
                  <p className="text-xs font-semibold text-foreground text-center">{purchasedCount}/{tastings.length}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Statistiques Globales de l'Entreprise */}
          {entrepriseStats && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex("#8b5cf6", 0.12) }}><BarChart3 className="w-3.5 h-3.5" style={{ color: "#8b5cf6" }} /></div>
                Statistiques Globales de l'Entreprise
              </h3>

              {/* Grille de stats globales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Produits */}
                <div className="rounded-xl border border-slate-100 p-4" style={{ background: hex("#0ea5e9", 0.03) }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">📦 Produits</span>
                    <span className="text-lg font-black" style={{ color: "#0ea5e9" }}>{entrepriseStats.produits.total}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Ventes normales: <span className="font-semibold text-foreground">{entrepriseStats.ventes.total_normales}</span></p>
                    <p>• Ventes offertes: <span className="font-semibold text-foreground">{entrepriseStats.ventes.total_offertes}</span></p>
                    <p>• Total: <span className="font-semibold text-foreground">{entrepriseStats.ventes.total_unite}</span></p>
                  </div>
                </div>

                {/* Goodies */}
                <div className="rounded-xl border border-slate-100 p-4" style={{ background: hex("#ec4899", 0.03) }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">🎁 Goodies</span>
                    <span className="text-lg font-black" style={{ color: "#ec4899" }}>{entrepriseStats.goodies.total_types}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Initial: <span className="font-semibold text-foreground">{entrepriseStats.goodies.total_initial}</span></p>
                    <p>• Distribués: <span className="font-semibold text-foreground">{entrepriseStats.goodies.total_distribue}</span></p>
                    <p>• Distribution: <span className="font-semibold text-foreground">{entrepriseStats.goodies.taux_distribution}%</span></p>
                  </div>
                </div>

                {/* Dégustations */}
                <div className="rounded-xl border border-slate-100 p-4" style={{ background: hex("#10b981", 0.03) }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">🍽️ Dégustations</span>
                    <span className="text-lg font-black" style={{ color: "#10b981" }}>{entrepriseStats.degustations.total}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Converties: <span className="font-semibold text-foreground">{entrepriseStats.degustations.converties}</span></p>
                    <p>• Taux: <span className="font-semibold text-foreground">{entrepriseStats.degustations.taux_conversion}%</span></p>
                    <p>• CA: <span className="font-semibold text-foreground">{Number(entrepriseStats.ventes.chiffre_affaires).toLocaleString('fr-FR')} F</span></p>
                  </div>
                </div>
              </div>

              {/* Tableau détail des produits */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Détail des Produits</h4>
                <div className="space-y-2">
                  {entrepriseStats.produits.detail.map((prod: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-sm font-medium text-foreground">{prod.nom}</p>
                        <p className="text-xs text-muted-foreground">{prod.type_conditionnement}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{prod.total_vendu}</p>
                        <p className="text-xs text-muted-foreground">{prod.ventes_normales} + {prod.ventes_offertes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distribution des goodies par site */}
              {entrepriseStats.goodies.par_site.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Distribution Goodies par Site</h4>
                  <div className="space-y-2">
                    {entrepriseStats.goodies.par_site.map((site: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-slate-100 p-3" style={{ background: hex("#ec4899", 0.02) }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm text-foreground">{site.site_nom}</p>
                          <p className="text-sm font-semibold" style={{ color: "#ec4899" }}>{site.total_distribue}/{site.total_initial}</p>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${site.total_initial > 0 ? (site.total_distribue / site.total_initial) * 100 : 0}%`, background: "#ec4899" }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {site.goodies.map((goodie: any, gidx: number) => (
                            <div key={gidx} className="text-xs p-1.5 rounded bg-white border border-slate-100">
                              <p className="font-medium truncate">{goodie.goodie_nom}</p>
                              <p className="text-muted-foreground">{goodie.quantite_distribuee}/{goodie.quantite_initiale}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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

          {/* Affiche le graphique des dégustations/ventes par jour par quantité */}
          {(tastings.length > 0 || ventes.length > 0) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p2, 0.12) }}><TrendingUp className="w-3.5 h-3.5" style={{ color: p2 }} /></div>
                Activité par jour
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(() => {
                      const map: Record<string, { date: string; degustations: number; ventes: number }> = {};
                      if (showTasting) {
                        tastings.forEach(t => {
                          const d = new Date(t.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
                          if (!map[d]) map[d] = { date: d, degustations: 0, ventes: 0 };
                          map[d].degustations += 1;
                        });
                      }
                      if (showVente) {
                        ventes.forEach(v => {
                          const d = new Date(v.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
                          if (!map[d]) map[d] = { date: d, degustations: 0, ventes: 0 };
                          map[d].ventes += v.quantite;
                        });
                      }
                      return Object.values(map).sort((a, b) => {
                        const [dA, mA] = a.date.split("/").map(Number);
                        const [dB, mB] = b.date.split("/").map(Number);
                        return mA !== mB ? mA - mB : dA - dB;
                      });
                    })()}
                    margin={{ top: 5, right: 10, bottom: 30, left: -10 }}
                    barSize={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" interval={0} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    {showTasting && <Bar dataKey="degustations" name="Dégustations" fill={p1} radius={[4, 4, 0, 0]} />}
                    {showVente && <Bar dataKey="ventes" name="Ventes (qté)" fill={p2} radius={[4, 4, 0, 0]} />}
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Section: Détails des Sites avec Hôtesses et Superviseurs */}
          {(siteRapport?.sites.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}><Users className="w-3.5 h-3.5" style={{ color: p1 }} /></div>
                Équipes affectées par site
              </h3>
              <div className="grid gap-3">
                {siteRapport!.sites.map(site => (
                  <div key={site.id} className="rounded-xl border border-slate-100 p-4" style={{ background: hex(p1, 0.03) }}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-bold text-foreground">{site.nom}</p>
                        <p className="text-xs text-muted-foreground">{site.ville}{site.emplacement_precis ? ` • ${site.emplacement_precis}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: p1 }}>{site.degustations} dég.</p>
                        <p className="text-xs text-muted-foreground">{site.ventes} ventes</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Hôtesses */}
                      <div className="rounded-lg bg-white border border-slate-100 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hex(p1, 0.1) }}>👩‍💼</div>
                          Hôtesses ({site.nb_hotesses})
                        </p>
                        <div className="space-y-1.5">
                          {(site as any).hotesses_noms && (site as any).hotesses_noms.length > 0 ? (
                            (site as any).hotesses_noms.map((name: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold" style={{ background: p1 }}>
                                  {initials(name)}
                                </div>
                                <span className="text-foreground truncate">{name}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Aucune hôtesse affectée</p>
                          )}
                        </div>
                      </div>

                      {/* Superviseurs */}
                      <div className="rounded-lg bg-white border border-slate-100 p-3">
                        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hex(p2, 0.1) }}>👨‍💼</div>
                          Superviseurs ({site.nb_superviseurs})
                        </p>
                        <div className="space-y-1.5">
                          {(site as any).superviseurs_noms && (site as any).superviseurs_noms.length > 0 ? (
                            (site as any).superviseurs_noms.map((name: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold" style={{ background: p2 }}>
                                  {initials(name)}
                                </div>
                                <span className="text-foreground truncate">{name}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Aucun superviseur affecté</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Goodies en Temps Réel par Site */}
          {goodies.length > 0 && (siteRapport?.sites.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex("#ec4899", 0.12) }}><Gift className="w-3.5 h-3.5" style={{ color: "#ec4899" }} /></div>
                Goodies en temps réel par site
              </h3>
              <div className="grid gap-4">
                {siteRapport!.sites.map(site => {
                  const siteGoodies = (site as any).goodies ?? [];
                  const totalDistributed = siteGoodies.reduce((sum: number, g: any) => sum + g.quantite_distribuee, 0);
                  const totalInitial = siteGoodies.reduce((sum: number, g: any) => sum + g.quantite_initiale, 0);
                  
                  return (
                    <div key={site.id} className="rounded-xl border border-slate-100 overflow-hidden" style={{ background: hex("#ec4899", 0.02) }}>
                      <div className="p-4 border-b border-slate-100 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-sm text-foreground">{site.nom}</p>
                          <p className="text-sm font-bold" style={{ color: "#ec4899" }}>{totalDistributed}/{totalInitial}</p>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${totalInitial > 0 ? Math.round((totalDistributed / totalInitial) * 100) : 0}%`, background: "#ec4899" }} />
                        </div>
                      </div>
                      <div className="p-4 space-y-2.5">
                        {siteGoodies.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Aucun goodie configuré pour ce site</p>
                        ) : (
                          siteGoodies.map((g: any, idx: number) => {
                            const percentage = g.quantite_initiale > 0 ? Math.round((g.quantite_distribuee / g.quantite_initiale) * 100) : 0;
                            return (
                              <div key={idx} className="rounded-lg bg-white border border-slate-100 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-foreground truncate">{g.goodie_nom}</p>
                                  <span className="text-xs font-bold tabular-nums" style={{ color: "#ec4899" }}>{g.quantite_distribuee}/{g.quantite_initiale}</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, background: "#ec4899" }} />
                                </div>
                                <p className="text-xs text-muted-foreground text-center mt-1.5">{percentage}% distribué</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Dernières Activités */}
          {(tastings.length > 0 || ventes.length > 0) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex("#3b82f6", 0.12) }}><BarChart3 className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} /></div>
                Dernières activités sur les sites
              </h3>
              <div className="space-y-2">
                {[
                  ...tastings.map(t => ({
                    type: "dégustation",
                    text: `${t.produit_nom} dégusté${t.nom_client ? ` par ${t.nom_client}` : ""} à ${t.site_nom}`,
                    timestamp: new Date(t.created_at).getTime(),
                    time: new Date(t.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                    color: p1,
                    icon: UtensilsCrossed,
                  })),
                  ...ventes.map(v => ({
                    type: "vente",
                    text: `${v.produit_nom} vendu${v.nom_client ? ` à ${v.nom_client}` : ""} à ${v.site_nom}`,
                    timestamp: new Date(v.created_at).getTime(),
                    time: new Date(v.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                    color: p2,
                    icon: ShoppingCart,
                  })),
                ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6).map((activity, idx) => {
                  const ActivityIcon = activity.icon;
                  return (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hex(activity.color, 0.1) }}>
                        <ActivityIcon className="w-4 h-4" style={{ color: activity.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{activity.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  );
                })}
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

          {/* ── Pointage arrivée / départ ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}>
                <Clock className="w-3.5 h-3.5" style={{ color: p1 }} />
              </div>
              Pointage du jour
            </h3>
            {pointageDuJour !== undefined && (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Arrivée */}
                <div className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors"
                  style={{ background: pointageDuJour?.heure_arrivee ? hex(p1, 0.07) : "transparent", borderColor: pointageDuJour?.heure_arrivee ? p1 : "#e2e8f0" }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: p1 }}>Arrivée</span>
                  {pointageDuJour?.heure_arrivee ? (
                    <span className="text-2xl font-black tabular-nums" style={{ color: p1 }}>{pointageDuJour.heure_arrivee.slice(0, 5)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Non pointée</span>
                  )}
                  {!pointageDuJour?.heure_arrivee && (
                    <Button size="sm" className="w-full h-9 text-xs mt-1 text-white"
                      style={{ background: p1 }}
                      onClick={handlePointerArrivee}
                      disabled={savingPointage === "arrivee"}>
                      {savingPointage === "arrivee" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pointer l'arrivée"}
                    </Button>
                  )}
                </div>
                {/* Départ */}
                <div className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors"
                  style={{ background: pointageDuJour?.heure_depart ? hex(p2, 0.07) : "transparent", borderColor: pointageDuJour?.heure_depart ? p2 : "#e2e8f0" }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: p2 }}>Départ</span>
                  {pointageDuJour?.heure_depart ? (
                    <span className="text-2xl font-black tabular-nums" style={{ color: p2 }}>{pointageDuJour.heure_depart.slice(0, 5)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Non pointé</span>
                  )}
                  {pointageDuJour?.heure_arrivee && !pointageDuJour?.heure_depart && (
                    <Button size="sm" variant="outline" className="w-full h-9 text-xs mt-1"
                      onClick={handlePointerDepart}
                      disabled={savingPointage === "depart"}>
                      {savingPointage === "depart" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pointer le départ"}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {pointageDuJour === undefined && (
              <p className="text-xs text-muted-foreground italic text-center py-2">Chargement du pointage…</p>
            )}
            {pointageDuJour?.heure_ouverture_prevue && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Horaires prévus : <strong>{pointageDuJour.heure_ouverture_prevue}</strong> – <strong>{pointageDuJour.heure_fermeture_prevue}</strong>
              </p>
            )}
          </div>

          {/* Objectifs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center mb-5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: hex(p1, 0.12) }}><Target className="w-3.5 h-3.5" style={{ color: p1 }} /></div>
                Mes objectifs
              </h3>
            </div>
            <div className="space-y-5">
              {showDegustationBar && campaign.objectif_degustations ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><UtensilsCrossed className="w-4 h-4" style={{ color: p1 }} /><span className="font-medium text-foreground">Dégustations</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p1 }}>{degustationCount} / {campaign.objectif_degustations}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((degustationCount / campaign.objectif_degustations) * 100))}%`, background: brandGrad }} /></div>
                  <p className="text-xs text-muted-foreground text-right">{Math.min(100, Math.round((degustationCount / campaign.objectif_degustations) * 100))}% atteint</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: hex(p1, 0.07) }}><UtensilsCrossed className="w-4 h-4 shrink-0" style={{ color: p1 }} /><div><p className="text-sm font-semibold text-foreground">{degustationCount} dégustation{degustationCount !== 1 ? "s" : ""}</p><p className="text-xs text-muted-foreground">Objectif libre</p></div></div>
              )}
              {showVente && campaign.objectif_ventes ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" style={{ color: p2 }} /><span className="font-medium text-foreground">Ventes</span></div>
                    <span className="font-bold tabular-nums" style={{ color: p2 }}>{venteNormalCount} / {campaign.objectif_ventes}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round((venteNormalCount / campaign.objectif_ventes) * 100))}%`, background: `linear-gradient(to right, ${p2}, ${p1})` }} /></div>
                  <p className="text-xs text-muted-foreground text-right">{Math.min(100, Math.round((venteNormalCount / campaign.objectif_ventes) * 100))}% atteint</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: hex(p2, 0.07) }}><ShoppingCart className="w-4 h-4 shrink-0" style={{ color: p2 }} /><div><p className="text-sm font-semibold text-foreground">{venteNormalCount} vente{venteNormalCount !== 1 ? "s" : ""}</p><p className="text-xs text-muted-foreground">Objectif libre</p></div></div>
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
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Campagne</Label><div className="h-10 px-3 flex items-center rounded-xl border border-input bg-muted/40 text-sm font-medium truncate">{siteInfo?.campagne_nom ?? campaign.nom}</div></div>
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Hôtesse</Label><div className="h-10 px-3 flex items-center rounded-xl border border-input bg-muted/40 text-sm font-medium truncate">{user?.name ?? ""}</div></div>
                <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Site</Label><div className="h-10 px-3 flex items-center rounded-xl border border-input bg-muted/40 text-sm font-medium truncate">{campaignSites.find(s => s.id === degForm.site)?.nom ?? siteInfo?.site_nom ?? "—"}</div></div>
              </div>

              {/* ── Stepper ── */}
              {(() => {
                const totalDegSteps = showPromos ? 3 : 2;
                const stepLabels = ["Client", "Achat", "Offre"].slice(0, totalDegSteps);
                return (
                  <div className="flex items-center gap-2 pt-1">
                    {stepLabels.map((label, i) => {
                      const n = i + 1;
                      const done = degStep > n;
                      const active = degStep === n;
                      return (
                        <div key={n} className="flex items-center gap-2 flex-1">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                              done ? "bg-emerald-500 text-white" : active ? "text-white" : "bg-slate-200 text-slate-500")}
                              style={active ? { background: p1 } : undefined}>
                              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
                            </div>
                            <span className={cn("text-xs font-semibold whitespace-nowrap", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                          </div>
                          {n < totalDegSteps && <div className="flex-1 h-px bg-slate-200" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── Étape 1 : Client ── */}
              {degStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Nom du client <span className="normal-case font-normal">(utilisé pour la roue)</span></Label><Input value={degForm.nom_client} onChange={e => setDegForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Prénom du client" className="h-10" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Tranche d'âge *</Label><Select value={degForm.tranche_age} onValueChange={v => setDegForm(f => ({ ...f, tranche_age: v as TrancheAge }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Genre *</Label><Select value={degForm.genre} onValueChange={v => setDegForm(f => ({ ...f, genre: v as Genre }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{GENRE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <Button type="button" onClick={() => setDegStep(2)} disabled={!degForm.tranche_age || !degForm.genre}
                    className="w-full h-11 text-white" style={{ background: p1 }}>
                    Suivant : Achat
                  </Button>
                </div>
              )}

              {/* ── Étape 2 : Achat ── */}
              {degStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1.5"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Produit *</Label><Select value={degForm.produit} onValueChange={v => setDegForm(f => ({ ...f, produit: v }))} disabled={!degForm.site || loadingSite}><SelectTrigger>{loadingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Sélectionner" />}</SelectTrigger><SelectContent>{(siteInfo?.produits ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent></Select></div>

                  {/* Note d'ambiance — visible si activé, quel que soit le type */}
                  {campaign?.note_ambiance_active && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Note d&apos;ambiance *</Label>
                      {(campaign.note_ambiance_max ?? 5) <= 5 ? (
                        <div className="flex justify-between gap-2">
                          {RATING_ICONS_5.map(r => (
                            <button key={r.rating} type="button" onClick={() => setDegForm(f => ({ ...f, note_ambiance: r.rating }))}
                              className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all flex-1",
                                degForm.note_ambiance === r.rating ? "border-violet-500 bg-violet-50 text-violet-600" : "border-border hover:border-violet-300")}>
                              {r.icon}<span className="text-xs font-medium">{r.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: campaign.note_ambiance_max }, (_, i) => i + 1).map(n => (
                            <button key={n} type="button" onClick={() => setDegForm(f => ({ ...f, note_ambiance: n }))}
                              className={cn("py-2.5 rounded-xl border-2 text-sm font-bold transition-all",
                                degForm.note_ambiance === n ? "border-violet-500 bg-violet-50 text-violet-600" : "border-border hover:border-violet-300")}>
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note du goût — visible si activé, quel que soit le type */}
                  {campaign?.note_gout_active && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Note du goût *</Label>
                      {(campaign.note_gout_max ?? 5) <= 5 ? (
                        <div className="flex justify-between gap-2">
                          {RATING_ICONS_5.map(r => (
                            <button key={r.rating} type="button" onClick={() => setDegForm(f => ({ ...f, note_gout: r.rating }))}
                              className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all flex-1",
                                degForm.note_gout === r.rating ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-border hover:border-indigo-300")}>
                              {r.icon}<span className="text-xs font-medium">{r.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          {Array.from({ length: campaign.note_gout_max }, (_, i) => i + 1).map(n => (
                            <button key={n} type="button" onClick={() => setDegForm(f => ({ ...f, note_gout: n }))}
                              className={cn("py-2.5 rounded-xl border-2 text-sm font-bold transition-all",
                                degForm.note_gout === n ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-border hover:border-indigo-300")}>
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Intention d'achat (uniquement si showTasting et pas de promo) */}
                  {showTasting && !showPromos && (
                    <div className="space-y-2"><Label className="text-muted-foreground text-xs uppercase tracking-wide">Intention d'achat *</Label><div className="grid grid-cols-3 gap-2">{INTENT_OPTIONS.map(o => (<button key={o.value} type="button" onClick={() => setDegForm(f => ({ ...f, intention_achat: o.value }))} className={cn("py-3 px-2 rounded-lg border-2 font-medium transition-all text-sm", degForm.intention_achat === o.value ? o.color + " border-current" : "border-border hover:border-indigo-300")}>{o.label}</button>))}</div></div>
                  )}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="h-11" onClick={() => setDegStep(1)}>Retour</Button>
                    {showPromos ? (
                      <Button type="button" onClick={() => setDegStep(3)} disabled={!degForm.produit}
                        className="flex-1 h-11 text-white" style={{ background: p1 }}>
                        Suivant : Offre
                      </Button>
                    ) : (
                      <Button type="submit" disabled={savingDeg} className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white h-11 text-base font-semibold">
                        {savingDeg ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : <><UtensilsCrossed className="w-4 h-4 mr-2" />{showWheel ? "Enregistrer & lancer la roue 🎡" : "Enregistrer la dégustation"}</>}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Étape 3 : Offre (radio, rien coché par défaut) ── */}
              {degStep === 3 && showPromos && (
                <div className="space-y-4">
                  {(() => {
                    const eligiblePromos = (campaign?.promotions ?? []).filter(p => isPromoEligibleForSite(p, degForm.site));
                    return (
                      <div className="space-y-3">
                        {eligiblePromos.length > 0 && (
                          <>
                            <div className="flex items-center gap-2"><Label className="text-sm font-semibold text-blue-600">Offre promotionnelle applicable</Label><span className="text-xs text-muted-foreground">({eligiblePromos.length} règle{eligiblePromos.length > 1 ? "s" : ""})</span></div>
                            <div className="space-y-2">
                              {eligiblePromos.map((promo) => {
                                const styles = PROMO_TYPE_STYLES[promo.type_promotion];
                                const isChecked = degForm.promotion_selectionnee === promo.id;
                                const willOpenWheel = promo.type_promotion === "TIRAGE" || promo.type_promotion === "GAGNE";
                                return (
                                  <label key={promo.id} className={cn("flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", isChecked ? `${styles.bg} ${styles.border} ${styles.text}` : "border-slate-200 bg-white hover:border-slate-300")}>
                                    <input type="radio" name="promotion_choice" className="mt-1 w-5 h-5 border-gray-300 text-blue-600 focus:ring-blue-500" checked={isChecked} onChange={() => setDegForm(f => ({ ...f, promotion_selectionnee: promo.id }))} />
                                    <div className="flex-1 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0"><span className="text-xl">{styles.icon}</span></div><div><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{promo.quantite_requise} acheté{promo.quantite_requise > 1 ? "s" : ""}</span><span className="text-xs font-medium text-slate-500">→ {styles.label}</span>{willOpenWheel && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🎡 Lance la roue</span>}</div><p className="font-semibold text-sm mt-1">{promo.recompense_description}</p></div></div>
                                    {isChecked && <CheckCircle2 className={cn("w-5 h-5 shrink-0", styles.text)} />}
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {/* Toujours disponible, même sans promo éligible : une hôtesse doit
                            pouvoir enregistrer une vente hors promo dans tous les cas (sinon
                            la vente reste invisible des rapports, cf. conditionnement plus bas). */}
                        <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 cursor-pointer">
                          <input type="radio" name="promotion_choice" className="w-5 h-5 border-gray-300" checked={degForm.promotion_selectionnee === "__NONE__"} onChange={() => setDegForm(f => ({ ...f, promotion_selectionnee: "__NONE__" }))} />
                          <span className="text-sm font-medium text-slate-700">Vente hors offre promotionnelle</span>
                        </label>
                      </div>
                    );
                  })()}

                  {/* Quantité vendue (vente hors offre promotionnelle) */}
                  {degForm.promotion_selectionnee === "__NONE__" && (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <Label className="text-sm font-semibold text-slate-600">Quantité vendue (hors promo) *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Conditionnement</Label>
                          <Select value={degForm.conditionnement} onValueChange={v => setDegForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                              <SelectItem value="PACK">En pack</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Quantité</Label>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setDegForm(f => ({ ...f, quantite: Math.max(1, f.quantite - 1) }))}
                              className="w-9 h-9 rounded-lg border-2 border-input flex items-center justify-center text-lg font-bold hover:bg-muted">−</button>
                            <Input type="number" min="1" value={degForm.quantite}
                              onChange={e => setDegForm(f => ({ ...f, quantite: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="w-16 text-center font-semibold h-9" />
                            <button type="button" onClick={() => setDegForm(f => ({ ...f, quantite: f.quantite + 1 }))}
                              className="w-9 h-9 rounded-lg border-2 border-input flex items-center justify-center text-lg font-bold hover:bg-muted">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="h-12" onClick={() => setDegStep(2)}>Retour</Button>
                    <Button type="submit" disabled={savingDeg || degForm.promotion_selectionnee === ""} className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white h-12 text-base font-semibold">
                      {savingDeg ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</> : (() => { const sel = (campaign?.promotions ?? []).find(p => p.id === degForm.promotion_selectionnee); const promoLancesRoue = sel?.type_promotion === "TIRAGE" || sel?.type_promotion === "GAGNE"; return <><UtensilsCrossed className="w-4 h-4 mr-2" />{promoLancesRoue ? "Enregistrer & lancer la roue 🎡" : "Enregistrer le client"}</>; })()}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Superviseur (autre rôle) */}
      {!isAdmin && !isHostess && !isEntreprise && (
        <div className="space-y-5">

        {/* ── Livraisons goodies (superviseur) ── */}
        {showWheel && goodies.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><Gift className="w-3.5 h-3.5 text-emerald-600" /></div>
              Goodies livrés / jour
            </h3>
            {/* Stock disponible aujourd'hui */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const todayLivraisons = livraisons.filter(l => l.date === today);
              if (todayLivraisons.length === 0) return (
                <p className="text-xs text-muted-foreground italic">Aucune livraison enregistrée pour aujourd'hui.</p>
              );
              const bysite = todayLivraisons.reduce((acc, l) => {
                if (!acc[l.site_nom]) acc[l.site_nom] = [];
                acc[l.site_nom].push(l);
                return acc;
              }, {} as Record<string, typeof livraisons>);
              return (
                <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/60 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Stock disponible aujourd'hui</p>
                  {Object.entries(bysite).map(([siteNom, items]) => (
                    <div key={siteNom} className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">{siteNom}</p>
                      {items.map(l => (
                        <div key={l.id} className="flex items-center justify-between text-xs pl-2">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            {l.goodie_nom}
                            {l.est_report && <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">↩ J-1</span>}
                          </span>
                          <span className={`font-bold ${l.restants_du_jour === 0 ? "text-rose-500" : l.restants_du_jour <= 3 ? "text-amber-600" : "text-emerald-600"}`}>
                            {l.restants_du_jour} restant{l.restants_du_jour !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Site</Label>
                  <Select value={livraisonSite} onValueChange={setLivraisonSite}>
                    <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Site" /></SelectTrigger>
                    <SelectContent>{campaignSites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Goodie</Label>
                  <Select value={livraisonForm.goodie} onValueChange={v => setLivraisonForm(f => ({ ...f, goodie: v }))}>
                    <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Goodie" /></SelectTrigger>
                    <SelectContent>{goodies.map(g => <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" className="h-8 text-xs mt-0.5" value={livraisonForm.date} onChange={e => setLivraisonForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Quantité</Label>
                  <Input type="number" min={1} className="h-8 text-xs mt-0.5" value={livraisonForm.quantite} onChange={e => setLivraisonForm(f => ({ ...f, quantite: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSubmitLivraison} disabled={savingLivraison}>
                {savingLivraison ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Enregistrer livraison
              </Button>
            </div>
            {livraisons.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
                {livraisons.map(l => (
                  <div key={l.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${l.est_report ? "bg-amber-50 border border-amber-100" : "bg-slate-50"}`}>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{l.goodie_nom}</p>
                      <p className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        {l.site_nom} · {new Date(l.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        {l.est_report && (
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">↩ report J-1</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-600 font-bold">+{l.quantite_apportee}</span>
                      {l.gains_du_jour > 0 && <span className="text-rose-500">−{l.gains_du_jour}</span>}
                      <span className="font-semibold">={l.restants_du_jour}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Stock de boissons & boissons gratuites du site (superviseur) ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center shrink-0"><Package className="w-3.5 h-3.5 text-sky-600" /></div>
            Stock de boissons & boissons gratuites (jour)
          </h3>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Site</Label>
                <Select value={donneesSiteForm.site} onValueChange={v => setDonneesSiteForm(f => ({ ...f, site: v }))}>
                  <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Site" /></SelectTrigger>
                  <SelectContent>{campaignSites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" className="h-8 text-xs mt-0.5" value={donneesSiteForm.date} onChange={e => setDonneesSiteForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Conditionnement</Label>
              <Select value={donneesSiteForm.conditionnement} onValueChange={v => setDonneesSiteForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                  <SelectItem value="PACK">En pack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Stock de boissons</Label>
                <Input type="number" min={0} className="h-8 text-xs mt-0.5" value={donneesSiteForm.stock_boissons} onChange={e => setDonneesSiteForm(f => ({ ...f, stock_boissons: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Boissons gratuites</Label>
                <Input type="number" min={0} className="h-8 text-xs mt-0.5" value={donneesSiteForm.nombre_boissons_gratuites} onChange={e => setDonneesSiteForm(f => ({ ...f, nombre_boissons_gratuites: e.target.value }))} />
              </div>
            </div>
            <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSubmitDonneesSiteJour} disabled={savingDonneesSite}>
              {savingDonneesSite ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Enregistrer
            </Button>
          </div>
          {donneesSiteJour.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-48 overflow-y-auto">
              {donneesSiteJour.slice(0, 10).map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{d.site_nom}</p>
                    <p className="text-muted-foreground">{new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{d.conditionnement_display}</span>
                    <span className="text-sky-600 font-semibold">Stock {d.stock_boissons ?? "—"}</span>
                    <span className="text-amber-600 font-semibold">Gratuites {d.nombre_boissons_gratuites ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Config rapport PDF — superviseur uniquement */}
        <ReportConfigPanel
          campaignId={campaign.id}
          onConfigChange={setReportConfig}
        />
        <RapportJournalierConfigPanel campaignId={campaign.id} />

        {/* Bouton génération rapport */}
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
          reportConfig={reportConfig ?? { ...DEFAULT_RAPPORT_CONFIG }}
        />

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
          <div className="bg-white rounded-2xl max-w-md w-full p-4 space-y-3 border border-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-between w-full"><div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /><span className="text-base font-bold text-amber-700">Roue de fortune</span></div><div className="flex items-center gap-2 px-2 py-1 rounded-full border text-xs font-semibold" style={{ background: hex(p1, 0.1), borderColor: hex(p1, 0.3), color: p1 }}>👤 {wheelClientName}</div></div>
              <div className="rounded-full p-2 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_44px_rgba(15,23,42,0.16)] border border-slate-100">
                <canvas ref={wheelCanvasRef} width={240} height={240} className="block max-w-full rounded-full" />
              </div>
              {wonPrize && (<div className="w-full rounded-2xl p-3 text-center font-bold text-base border bg-amber-50 border-amber-200 text-amber-700">🎁 {wonPrize.name}</div>)}
              {!wonPrize && getWheelPrizes().length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-slate-100">
                  {getWheelPrizes().map((prize, i) => (<div key={prize.id} className="flex items-center gap-2 text-xs text-muted-foreground"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{prize.name}</div>))}
                </div>
              )}
              {!wonPrize ? (
                <Button size="lg" className="w-full text-white" style={{ background: brandGrad }} onClick={spinWheel} disabled={wheelSpinning}>
                  {wheelSpinning ? <><RotateCcw className="w-5 h-5 mr-2 animate-spin" />En cours…</> : <><Sparkles className="w-5 h-5 mr-2" />Lancer la roue !</>}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  <Button className="w-full text-white" style={{ background: brandGrad }} onClick={() => handleConfirmWheelGain(() => setActiveWheelPromoId(null))} disabled={savingWheelGain}><Gift className="w-4 h-4 mr-2" />{savingWheelGain ? "Enregistrement..." : "Confirmer le gain"}</Button>
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => spinWheel()}><RotateCcw className="w-4 h-4 mr-2" />Relancer</Button>
                    <Button variant="outline" className="flex-1" onClick={() => { setActiveWheelPromoId(null); setWonPrize(null); setTirageGoodiesOverride(null); }}>Fermer</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB Roue à cadeaux (hôtesse, campagnes à récompense Goodies) */}
      {isHostess && showWheel && (
        <Link
          href="/dashboard/wheel"
          className="fixed bottom-20 lg:bottom-6 right-5 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${p1}, ${p2})` }}
          title="Roue à cadeaux"
        >
          <FerrisWheel className="w-6 h-6" />
        </Link>
      )}

      {/* Confirmation plein écran après enregistrement (hôtesse) */}
      {showDegConfirm && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 text-white animate-fade-up"
          style={{ background: `linear-gradient(135deg, ${p1} 0%, ${p2} 100%)` }}>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <p className="text-xl font-bold">Enregistré !</p>
        </div>
      )}

      {/* Modale roue pour les goodies */}
      {wheelOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 space-y-3 border border-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-between w-full"><div className="flex items-center gap-2"><Gift className="w-5 h-5 text-emerald-600" /><span className="text-base font-bold text-emerald-700">Roue des goodies</span></div><div className="flex items-center gap-2 px-2 py-1 rounded-full border text-xs font-semibold" style={{ background: hex(p1, 0.1), borderColor: hex(p1, 0.3), color: p1 }}>👤 {wheelClientName}</div></div>
              <div className="rounded-full p-2 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_44px_rgba(15,23,42,0.16)] border border-slate-100">
                <canvas ref={wheelCanvasRef} width={240} height={240} className="block max-w-full rounded-full" />
              </div>
              {wonPrize && (<div className="w-full rounded-2xl p-3 text-center font-bold text-base border bg-emerald-50 border-emerald-200 text-emerald-700">🎁 {wonPrize.name}</div>)}
              {!wonPrize && getWheelPrizes().length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-slate-100">
                  {getWheelPrizes().map((prize, i) => (<div key={prize.id} className="flex items-center gap-2 text-xs text-muted-foreground"><div className="w-3 h-3 rounded-full shrink-0" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />{prize.name}</div>))}
                </div>
              )}
              {!wonPrize ? (
                <Button size="lg" className="w-full text-white" style={{ background: brandGrad }} onClick={spinWheel} disabled={wheelSpinning}>
                  {wheelSpinning ? <><RotateCcw className="w-5 h-5 mr-2 animate-spin" />En cours…</> : <><Sparkles className="w-5 h-5 mr-2" />Lancer la roue !</>}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  <Button className="w-full text-white" style={{ background: brandGrad }} onClick={() => handleConfirmWheelGain(() => setWheelOpen(false))} disabled={savingWheelGain}><Gift className="w-4 h-4 mr-2" />{savingWheelGain ? "Enregistrement..." : "Confirmer le gain"}</Button>
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="flex-1" onClick={() => spinWheel()}><RotateCcw className="w-4 h-4 mr-2" />Relancer</Button>
                    <Button variant="outline" className="flex-1" onClick={() => { setWheelOpen(false); setWonPrize(null); }}>Fermer</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>

    {/* Team management modal */}
    <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader><DialogTitle className="text-base font-bold flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Gérer l'équipe de terrain</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <h4 className="text-xs font-bold uppercase text-rose-500 tracking-wider mb-2">Hôtesses disponibles</h4>
            <div className="space-y-1.5">
              {allStaff.filter(s => s.role === "Hotesse").map(s => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold">{initials(s.name)}</div><span className="text-sm font-medium">{s.name}</span></div>
                  <Checkbox checked={teamSel.hotesses_ids.includes(s.id)} onCheckedChange={() => toggleTeamMember("hotesses_ids", s.id)} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-indigo-500 tracking-wider mb-2">Superviseurs disponibles</h4>
            <div className="space-y-1.5">
              {allStaff.filter(s => s.role === "Superviseur").map(s => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">{initials(s.name)}</div><span className="text-sm font-medium">{s.name}</span></div>
                  <Checkbox checked={teamSel.superviseurs_ids.includes(s.id)} onCheckedChange={() => toggleTeamMember("superviseurs_ids", s.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={() => setTeamDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveTeam} disabled={savingTeam} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">{savingTeam ? "Enregistrement..." : "Enregistrer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
