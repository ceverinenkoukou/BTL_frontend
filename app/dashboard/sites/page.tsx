"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, CreatePromotionPayload, DonneesSiteJour, Entreprise, Goodie, JourAnimation, LivraisonGoodiesJour, Produit, Promotion, RemoteUser, SiteList, TeamMember, TypeConditionnement, TypePromotion } from "@/lib/types/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { useUrlState } from "@/lib/hooks/useUrlState";
import {
  Beer,
  Building2,
  Calendar,
  Clock,
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Store,
  Target,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

function unwrapList<T>(data: T[] | { results?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

type SiteForm = {
  nom: string;
  ville: string;
  emplacement_precis: string;
};

const emptySiteForm: SiteForm = {
  nom: "",
  ville: "Libreville",
  emplacement_precis: "",
};

type CreateSiteForm = {
  nom: string;
  ville: string;
  emplacement_precis: string;
  campagne: string;
};

const emptyCreateForm: CreateSiteForm = {
  nom: "",
  ville: "Libreville",
  emplacement_precis: "",
  campagne: "",
};

type PromoForm = {
  type_promotion: TypePromotion;
  conditionnement: TypeConditionnement;
  quantite_requise: string;
  quantite_offerte: string;
  recompense_description: string;
  produit_cible: string;
  goodies: string[];
};

const emptyPromoForm: PromoForm = {
  type_promotion: "OFFERT",
  conditionnement: "UNITE",
  quantite_requise: "3",
  quantite_offerte: "1",
  recompense_description: "",
  produit_cible: "",
  goodies: [],
};

type EditPromoForm = PromoForm & { id: string };

type HotesseForm = {
  email: string;
  name: string;
};

const emptyHotesseForm: HotesseForm = { email: "", name: "" };

type SuperviseurForm = {
  email: string;
  name: string;
};

const emptySuperviseurForm: SuperviseurForm = { email: "", name: "" };

function SitesPageContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const isSuperviseur = user?.role === "Superviseur";

  const [sites, setSites] = useState<SiteList[]>([]);
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState<PromoForm>(emptyPromoForm);
  const [editingPromo, setEditingPromo] = useState<EditPromoForm | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useUrlState("entreprise", "all");
  const [filterCampaign, setFilterCampaign] = useUrlState("campagne", "all");
  const [editingSite, setEditingSite] = useState<SiteList | null>(null);
  const [offersSite, setOffersSite] = useState<SiteList | null>(null);
  const [siteForm, setSiteForm] = useState<SiteForm>(emptySiteForm);
  const [campagneProduits, setCampagneProduits] = useState<Produit[]>([]);
  const [campagneGoodies, setCampagneGoodies] = useState<Goodie[]>([]);

  // --- Équipe (superviseurs + hôtesses) ---
  const [hotelSite, setHotelSite] = useState<SiteList | null>(null);
  const [siteDetail, setSiteDetail] = useState<{ superviseurs: TeamMember[]; hotesses: TeamMember[] } | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [allHotesses, setAllHotesses] = useState<TeamMember[]>([]);
  const [showHotesseForm, setShowHotesseForm] = useState(false);
  const [hotesseForm, setHotesseForm] = useState<HotesseForm>(emptyHotesseForm);
  const [allSuperviseurs, setAllSuperviseurs] = useState<TeamMember[]>([]);
  const [showSuperviseurForm, setShowSuperviseurForm] = useState(false);
  const [superviseurForm, setSuperviseurForm] = useState<SuperviseurForm>(emptySuperviseurForm);
  const [savingTeam, setSavingTeam] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSiteForm>(emptyCreateForm);
  const [savingCreate, setSavingCreate] = useState(false);

  // --- Planning (jours animés) par site ---
  const [planningSite, setPlanningSite] = useState<SiteList | null>(null);
  const [siteJours, setSiteJours] = useState<JourAnimation[]>([]);
  const [sitePlanForm, setSitePlanForm] = useState({ date: "", heure_ouverture: "08:00", heure_fermeture: "18:00" });
  const [savingSitePlan, setSavingSitePlan] = useState(false);
  const [sitePlanError, setSitePlanError] = useState("");

  // --- Goodies livrés & stock de boissons par site (admin + superviseur) ---
  const [stockSite, setStockSite] = useState<SiteList | null>(null);
  const [stockGoodies, setStockGoodies] = useState<Goodie[]>([]);
  const [stockLivraisons, setStockLivraisons] = useState<LivraisonGoodiesJour[]>([]);
  const [stockDonnees, setStockDonnees] = useState<DonneesSiteJour[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockLivraisonForm, setStockLivraisonForm] = useState({ goodie: "", date: new Date().toISOString().slice(0, 10), quantite: 1 });
  const [savingStockLivraison, setSavingStockLivraison] = useState(false);
  const [stockDonneesForm, setStockDonneesForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    conditionnement: "UNITE" as TypeConditionnement,
    stock_boissons: "", nombre_boissons_gratuites: "",
  });
  const [savingStockDonnees, setSavingStockDonnees] = useState(false);

  const openPlanningDialog = async (site: SiteList) => {
    setPlanningSite(site);
    setSiteJours([]);
    setSitePlanError("");
    setSitePlanForm({ date: "", heure_ouverture: "08:00", heure_fermeture: "18:00" });
    try {
      const res = await api.get<JourAnimation[]>(`/jours-animation/?site=${site.id}`);
      setSiteJours(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  };

  const handleAddSiteJour = async () => {
    if (!planningSite) return;
    if (!sitePlanForm.date) { setSitePlanError("La date est requise."); return; }
    setSavingSitePlan(true); setSitePlanError("");
    try {
      await api.post("/jours-animation/", {
        campagne: planningSite.campagne,
        site: planningSite.id,
        date: sitePlanForm.date,
        heure_ouverture: sitePlanForm.heure_ouverture,
        heure_fermeture: sitePlanForm.heure_fermeture,
      });
      setSitePlanForm({ date: "", heure_ouverture: "08:00", heure_fermeture: "18:00" });
      const res = await api.get<JourAnimation[]>(`/jours-animation/?site=${planningSite.id}`);
      setSiteJours(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      const d = e?.response?.data;
      setSitePlanError(d?.date?.[0] || d?.heure_fermeture?.[0] || d?.non_field_errors?.[0] || d?.detail || "Erreur lors de l'ajout.");
    } finally { setSavingSitePlan(false); }
  };

  const handleDeleteSiteJour = async (jourId: string) => {
    if (!planningSite) return;
    try {
      await api.delete(`/jours-animation/${jourId}/`);
      const res = await api.get<JourAnimation[]>(`/jours-animation/?site=${planningSite.id}`);
      setSiteJours(Array.isArray(res.data) ? res.data : []);
    } catch { toast.error("Impossible de supprimer ce jour."); }
  };

  // --- Goodies livrés & stock de boissons par site (admin + superviseur) ---
  const openStockDialog = async (site: SiteList) => {
    setStockSite(site);
    setStockGoodies([]);
    setStockLivraisons([]);
    setStockDonnees([]);
    setStockLivraisonForm({ goodie: "", date: new Date().toISOString().slice(0, 10), quantite: 1 });
    setStockDonneesForm({ date: new Date().toISOString().slice(0, 10), conditionnement: "UNITE", stock_boissons: "", nombre_boissons_gratuites: "" });
    setLoadingStock(true);
    try {
      const [goodiesRes, livrRes, dsjRes] = await Promise.all([
        api.get(`/goodies/?campagne=${site.campagne}`),
        api.get(`/livraisons-goodies/?site=${site.id}`),
        api.get(`/donnees-site-jour/?site=${site.id}`),
      ]);
      setStockGoodies(unwrapList<Goodie>(goodiesRes.data));
      setStockLivraisons(unwrapList<LivraisonGoodiesJour>(livrRes.data));
      setStockDonnees(unwrapList<DonneesSiteJour>(dsjRes.data));
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoadingStock(false);
    }
  };

  const handleSubmitStockLivraison = async () => {
    if (!stockSite || !stockLivraisonForm.goodie || !stockLivraisonForm.date) {
      toast.error("Remplissez tous les champs."); return;
    }
    setSavingStockLivraison(true);
    try {
      const res = await api.post<LivraisonGoodiesJour>("/livraisons-goodies/", {
        site: stockSite.id,
        goodie: stockLivraisonForm.goodie,
        date: stockLivraisonForm.date,
        quantite_apportee: stockLivraisonForm.quantite,
      });
      setStockLivraisons(prev => {
        const idx = prev.findIndex(l => l.goodie === res.data.goodie && l.date === res.data.date);
        if (idx >= 0) { const n = [...prev]; n[idx] = res.data; return n; }
        return [res.data, ...prev];
      });
      toast.success("Livraison enregistrée !");
      setStockLivraisonForm(f => ({ ...f, goodie: "", quantite: 1 }));
    } catch { toast.error("Erreur lors de l'enregistrement."); }
    finally { setSavingStockLivraison(false); }
  };

  const handleSubmitStockDonnees = async () => {
    if (!stockSite || !stockDonneesForm.date) {
      toast.error("Sélectionnez une date."); return;
    }
    setSavingStockDonnees(true);
    try {
      const res = await api.post<DonneesSiteJour>("/donnees-site-jour/", {
        site: stockSite.id,
        date: stockDonneesForm.date,
        conditionnement: stockDonneesForm.conditionnement,
        stock_boissons: stockDonneesForm.stock_boissons === "" ? null : Number(stockDonneesForm.stock_boissons),
        nombre_boissons_gratuites: stockDonneesForm.nombre_boissons_gratuites === "" ? null : Number(stockDonneesForm.nombre_boissons_gratuites),
      });
      setStockDonnees(prev => {
        const idx = prev.findIndex(d => d.date === res.data.date);
        if (idx >= 0) { const n = [...prev]; n[idx] = res.data; return n; }
        return [res.data, ...prev];
      });
      toast.success("Données enregistrées !");
    } catch { toast.error("Erreur lors de l'enregistrement."); }
    finally { setSavingStockDonnees(false); }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesRes, campaignsRes, entreprisesRes] = await Promise.all([
        api.get("/sites/"),
        api.get("/campagnes/"),
        api.get("/entreprises/"),
      ]);

      setSites(unwrapList<SiteList>(sitesRes.data));
      setCampaigns(unwrapList<CampagneList>(campaignsRes.data));
      setEntreprises(unwrapList<Entreprise>(entreprisesRes.data));
    } catch {
      toast.error("Erreur lors du chargement des sites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const campaignById = useMemo(
    () => new Map(campaigns.map(campaign => [campaign.id, campaign])),
    [campaigns],
  );

  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      const campaign = campaignById.get(site.campagne);
      const matchCompany = filterCompany === "all" || campaign?.entreprise === filterCompany;
      const matchCampaign = filterCampaign === "all" || site.campagne === filterCampaign;
      const searchable = [
        site.nom,
        site.ville,
        site.emplacement_precis ?? "",
        site.campagne_nom,
        site.entreprise_nom,
      ].join(" ").toLowerCase();
      const matchSearch = !searchQuery || searchable.includes(searchQuery.toLowerCase());
      return matchCompany && matchCampaign && matchSearch;
    });
  }, [campaignById, filterCampaign, filterCompany, searchQuery, sites]);

  const groupedSites = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; sites: SiteList[] }>();

    filteredSites.forEach(site => {
      const key = `${site.nom.trim().toLowerCase()}|${site.ville.trim().toLowerCase()}|${(site.emplacement_precis ?? "").trim().toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: site.nom,
          sites: [],
        });
      }
      groups.get(key)!.sites.push(site);
    });

    return [...groups.values()];
  }, [filteredSites]);

  const openCreateDialog = () => {
    setCreateForm({
      ...emptyCreateForm,
      campagne: filterCampaign !== "all" ? filterCampaign : "",
    });
    setShowCreateDialog(true);
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.nom.trim() || !createForm.campagne) return;
    setSavingCreate(true);
    try {
      const { data } = await api.post<{ id: string; nom: string; ville: string; emplacement_precis: string | null; campagne: string; created_at: string }>("/sites/", {
        nom: createForm.nom.trim(),
        ville: createForm.ville.trim() || "Libreville",
        emplacement_precis: createForm.emplacement_precis.trim() || null,
        campagne: createForm.campagne,
      });
      toast.success(`Site "${data.nom}" créé avec succès.`);
      setShowCreateDialog(false);
      setCreateForm(emptyCreateForm);
      await fetchAll();
      const campaign = campaigns.find(c => c.id === createForm.campagne);
      if (campaign?.type_recompense === "PROMOTIONS") {
        const entreprise = entreprises.find(e => e.id === campaign.entreprise);
        const newSite: SiteList = {
          id: data.id,
          nom: data.nom,
          ville: data.ville,
          emplacement_precis: data.emplacement_precis,
          campagne: data.campagne,
          campagne_nom: campaign.nom,
          entreprise_nom: entreprise?.nom_commercial ?? "",
          nb_hotesses: 0,
          nb_superviseurs: 0,
          created_at: data.created_at,
        };
        openOffersDialog(newSite);
      }
    } catch {
      toast.error("Erreur lors de la création du site.");
    } finally {
      setSavingCreate(false);
    }
  };

  const openEditDialog = (site: SiteList) => {
    setEditingSite(site);
    setSiteForm({
      nom: site.nom,
      ville: site.ville,
      emplacement_precis: site.emplacement_precis ?? "",
    });
  };

  const handleUpdateSite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSite) return;

    setSaving(true);
    try {
      await api.patch(`/sites/${editingSite.id}/`, {
        nom: siteForm.nom.trim(),
        ville: siteForm.ville.trim() || "Libreville",
        emplacement_precis: siteForm.emplacement_precis.trim() || null,
        campagne: editingSite.campagne,
      });

      toast.success("Site mis à jour.");
      setEditingSite(null);
      setSiteForm(emptySiteForm);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la mise à jour du site.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSite = async (site: SiteList) => {
    if (!confirm(`Supprimer le site "${site.nom}" de la campagne "${site.campagne_nom}" ?`)) return;

    try {
      await api.delete(`/sites/${site.id}/`);
      toast.success("Site supprimé.");
      fetchAll();
    } catch {
      toast.error("Erreur lors de la suppression du site.");
    }
  };

  const openOffersDialog = async (site: SiteList) => {
    setOffersSite(site);
    setPromotions([]);
    setShowPromoForm(false);
    setPromoForm(emptyPromoForm);
    setCampagneProduits([]);
    setCampagneGoodies([]);
    setLoadingOffers(true);

    try {
      const campagne = campaigns.find(c => c.id === site.campagne);
      const entrepriseId = campagne?.entreprise;
      const [promoRes, produitsRes, goodiesRes] = await Promise.all([
        api.get(`/promotions/?campagne=${site.campagne}`),
        entrepriseId ? api.get(`/entreprises/${entrepriseId}/`) : Promise.resolve({ data: { produits: [] } }),
        api.get(`/goodies/?campagne=${site.campagne}`),
      ]);
      setPromotions(unwrapList<Promotion>(promoRes.data));
      setCampagneProduits(produitsRes.data.produits ?? []);
      setCampagneGoodies(unwrapList<Goodie>(goodiesRes.data));
    } catch {
      toast.error("Erreur lors du chargement des offres.");
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleDeletePromotion = async (promoId: string) => {
    if (!confirm("Supprimer cette offre promotionnelle ?")) return;
    setSaving(true);
    try {
      await api.delete(`/promotions/${promoId}/`);
      setPromotions(current => current.filter(p => p.id !== promoId));
      toast.success("Offre supprimée.");
    } catch {
      toast.error("Erreur lors de la suppression de l'offre.");
    } finally {
      setSaving(false);
    }
  };

  const openEditPromo = (promotion: Promotion) => {
    setEditingPromo({
      id: promotion.id,
      type_promotion: promotion.type_promotion,
      conditionnement: promotion.conditionnement ?? "UNITE",
      quantite_requise: String(promotion.quantite_requise),
      quantite_offerte: String(promotion.quantite_offerte ?? 1),
      recompense_description: promotion.recompense_description,
      produit_cible: promotion.produit_cible ?? "",
      goodies: promotion.goodies ?? [],
    });
  };

  const handleUpdatePromotion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPromo) return;
    const qty = parseInt(editingPromo.quantite_requise, 10);
    const qtyOfferte = parseInt(editingPromo.quantite_offerte, 10);
    if (!qty || qty < 1 || !qtyOfferte || qtyOfferte < 1 || !editingPromo.recompense_description.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.patch<Promotion>(`/promotions/${editingPromo.id}/`, {
        type_promotion: editingPromo.type_promotion,
        conditionnement: editingPromo.conditionnement,
        quantite_requise: qty,
        quantite_offerte: qtyOfferte,
        recompense_description: editingPromo.recompense_description.trim(),
        produit_cible: editingPromo.produit_cible || null,
        goodies: editingPromo.type_promotion === "TIRAGE" ? editingPromo.goodies : [],
      });
      setPromotions(current => current.map(p => (p.id === data.id ? data : p)));
      setEditingPromo(null);
      toast.success("Offre mise à jour.");
    } catch {
      toast.error("Erreur lors de la mise à jour de l'offre.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePromotion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!offersSite) return;
    const qty = parseInt(promoForm.quantite_requise, 10);
    const qtyOfferte = parseInt(promoForm.quantite_offerte, 10);
    if (!qty || qty < 1 || !qtyOfferte || qtyOfferte < 1 || !promoForm.recompense_description.trim()) return;
    setSaving(true);
    try {
      const payload: CreatePromotionPayload = {
        campagne: offersSite.campagne,
        sites: [offersSite.id],
        type_promotion: promoForm.type_promotion,
        conditionnement: promoForm.conditionnement,
        quantite_requise: qty,
        quantite_offerte: qtyOfferte,
        recompense_description: promoForm.recompense_description.trim(),
        produit_cible: promoForm.produit_cible || null,
        goodies: promoForm.type_promotion === "TIRAGE" ? promoForm.goodies : [],
        is_active: true,
      };
      const { data } = await api.post<Promotion>("/promotions/", payload);
      setPromotions(current => [...current, data]);
      setShowPromoForm(false);
      setPromoForm(emptyPromoForm);
      toast.success("Offre créée et ciblée sur " + offersSite.nom);
    } catch {
      toast.error("Erreur lors de la création de l'offre.");
    } finally {
      setSaving(false);
    }
  };

  const updatePromotionSites = async (promotion: Promotion, nextSiteIds: string[]) => {
    setSaving(true);
    try {
      const { data } = await api.patch<Promotion>(`/promotions/${promotion.id}/`, {
        sites: nextSiteIds,
      });

      setPromotions(current =>
        current.map(item => (item.id === promotion.id ? data : item)),
      );
      toast.success(nextSiteIds.length ? "Ciblage de l'offre mis à jour." : "Offre rendue globale.");
    } catch {
      toast.error("Erreur lors de la mise à jour de l'offre.");
    } finally {
      setSaving(false);
    }
  };

  const campaignSites = offersSite
    ? sites.filter(site => site.campagne === offersSite.campagne)
    : [];

  // --- Équipe handlers (superviseurs + hôtesses) ---
  const openHotessesDialog = async (site: SiteList) => {
    setHotelSite(site);
    setSiteDetail(null);
    setAllHotesses([]);
    setAllSuperviseurs([]);
    setShowHotesseForm(false);
    setHotesseForm(emptyHotesseForm);
    setShowSuperviseurForm(false);
    setSuperviseurForm(emptySuperviseurForm);
    setLoadingTeam(true);
    try {
      const [detailRes, usersRes] = await Promise.all([
        api.get(`/sites/${site.id}/`),
        api.get("/users/terrain-staff/"),
      ]);
      setSiteDetail({ superviseurs: detailRes.data.superviseurs ?? [], hotesses: detailRes.data.hotesses ?? [] });
      const allStaff = unwrapList<TeamMember>(usersRes.data);
      setAllHotesses(allStaff.filter(u => u.role === "Hotesse"));
      setAllSuperviseurs(allStaff.filter(u => u.role === "Superviseur"));
    } catch {
      toast.error("Erreur lors du chargement de l'équipe.");
    } finally {
      setLoadingTeam(false);
    }
  };

  const assignHotesses = async (hotessesIds: string[]) => {
    if (!hotelSite || !siteDetail) return;
    setSavingTeam(true);
    try {
      await api.post(`/sites/${hotelSite.id}/manage-team/`, {
        superviseurs_ids: siteDetail.superviseurs.map(s => s.id),
        hotesses_ids: hotessesIds,
        notify: true,
      });
      setSiteDetail(prev => prev ? {
        ...prev,
        hotesses: allHotesses.filter(h => hotessesIds.includes(h.id)),
      } : prev);
      fetchAll();
      toast.success("Hôtesses mises à jour.");
    } catch {
      toast.error("Erreur lors de l'assignation.");
    } finally {
      setSavingTeam(false);
    }
  };

  const toggleHotesse = (hotesseId: string) => {
    if (!siteDetail) return;
    const current = siteDetail.hotesses.map(h => h.id);
    const next = current.includes(hotesseId)
      ? current.filter(id => id !== hotesseId)
      : [...current, hotesseId];
    assignHotesses(next);
  };

  const handleCreateHotesse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hotesseForm.email.trim() || !hotesseForm.name.trim()) return;
    setSavingTeam(true);
    try {
      const { data: newUser } = await api.post<RemoteUser & { role_display: string }>("/users/", {
        email: hotesseForm.email.trim(),
        name: hotesseForm.name.trim(),
        role: "Hotesse",
      });
      const newMember: TeamMember = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, role_display: newUser.role_display ?? "Hôtesse" };
      setAllHotesses(prev => [...prev, newMember]);
      setShowHotesseForm(false);
      setHotesseForm(emptyHotesseForm);
      toast.success(`Hôtesse ${newUser.name} créée. Elle sera notifiée par email.`);
      if (siteDetail) {
        const currentIds = siteDetail.hotesses.map(h => h.id);
        await assignHotesses([...currentIds, newUser.id]);
      }
    } catch {
      toast.error("Erreur lors de la création de l'hôtesse.");
    } finally {
      setSavingTeam(false);
    }
  };

  const assignSuperviseurs = async (superviseursIds: string[]) => {
    if (!hotelSite || !siteDetail) return;
    setSavingTeam(true);
    try {
      await api.post(`/sites/${hotelSite.id}/manage-team/`, {
        superviseurs_ids: superviseursIds,
        hotesses_ids: siteDetail.hotesses.map(h => h.id),
        notify: true,
      });
      setSiteDetail(prev => prev ? {
        ...prev,
        superviseurs: allSuperviseurs.filter(s => superviseursIds.includes(s.id)),
      } : prev);
      fetchAll();
      toast.success("Superviseurs mis à jour.");
    } catch {
      toast.error("Erreur lors de l'assignation.");
    } finally {
      setSavingTeam(false);
    }
  };

  const toggleSuperviseur = (superviseurId: string) => {
    if (!siteDetail) return;
    const current = siteDetail.superviseurs.map(s => s.id);
    const next = current.includes(superviseurId)
      ? current.filter(id => id !== superviseurId)
      : [...current, superviseurId];
    assignSuperviseurs(next);
  };

  const handleCreateSuperviseur = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!superviseurForm.email.trim() || !superviseurForm.name.trim()) return;
    setSavingTeam(true);
    try {
      const { data: newUser } = await api.post<RemoteUser & { role_display: string }>("/users/", {
        email: superviseurForm.email.trim(),
        name: superviseurForm.name.trim(),
        role: "Superviseur",
      });
      const newMember: TeamMember = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, role_display: newUser.role_display ?? "Superviseur" };
      setAllSuperviseurs(prev => [...prev, newMember]);
      setShowSuperviseurForm(false);
      setSuperviseurForm(emptySuperviseurForm);
      toast.success(`Superviseur ${newUser.name} créé. Il sera notifié par email.`);
      if (siteDetail) {
        const currentIds = siteDetail.superviseurs.map(s => s.id);
        await assignSuperviseurs([...currentIds, newUser.id]);
      }
    } catch {
      toast.error("Erreur lors de la création du superviseur.");
    } finally {
      setSavingTeam(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des sites"
        description="Modifier les sites des campagnes et cibler les offres par site."
        icon={<MapPin className="w-5 h-5" />}
        ctaSlot={
          isAdmin ? (
            <Button
              onClick={openCreateDialog}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau site
            </Button>
          ) : undefined
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 max-w-md">
        {[
          { label: "sites", value: sites.length },
          { label: "lieux", value: groupedSites.length },
          { label: "campagnes", value: campaigns.length },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 text-center">
            <p className="text-lg font-black text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher site, ville, campagne..."
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={filterCompany} onValueChange={value => {
          setFilterCompany(value);
          setFilterCampaign("all");
        }}>
          <SelectTrigger className="h-10 w-56">
            <SelectValue placeholder="Toutes entreprises" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes entreprises</SelectItem>
            {entreprises.map(entreprise => (
              <SelectItem key={entreprise.id} value={entreprise.id}>
                {entreprise.nom_commercial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="h-10 w-56">
            <SelectValue placeholder="Toutes campagnes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes campagnes</SelectItem>
            {campaigns
              .filter(campaign => filterCompany === "all" || campaign.entreprise === filterCompany)
              .map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.nom}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : groupedSites.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
          <Store className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucun site trouvé</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSites.map(group => (
            <div key={group.key} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h2 className="font-bold truncate">{group.label}</h2>
                    <Badge variant="outline">{group.sites.length} campagne{group.sites.length > 1 ? "s" : ""}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {group.sites[0]?.ville}
                    {group.sites[0]?.emplacement_precis ? ` - ${group.sites[0].emplacement_precis}` : ""}
                  </p>
                </div>
              </div>

              <div className="divide-y">
                {group.sites.map(site => {
                  const campaign = campaignById.get(site.campagne);
                  return (
                    <div key={site.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <Target className="w-3 h-3 mr-1" />
                            {site.campagne_nom}
                          </Badge>
                          <Badge variant="outline">
                            <Building2 className="w-3 h-3 mr-1" />
                            {site.entreprise_nom}
                          </Badge>
                          {campaign && (
                            <Badge variant="outline">
                              {campaign.type_recompense_display}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {site.nb_superviseurs} superviseur{site.nb_superviseurs > 1 ? "s" : ""} - {site.nb_hotesses} hôtesse{site.nb_hotesses > 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(isAdmin || isSuperviseur) && (
                          <Button variant="outline" size="sm" onClick={() => openStockDialog(site)} className="gap-2">
                            <Beer className="w-4 h-4" />
                            Goodies & stock
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openPlanningDialog(site)} className="gap-2">
                              <Clock className="w-4 h-4" />
                              Planning
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openOffersDialog(site)} className="gap-2">
                              <SlidersHorizontal className="w-4 h-4" />
                              Offres
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openHotessesDialog(site)} className="gap-2">
                              <Users className="w-4 h-4" />
                              Équipe
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(site)} className="gap-2">
                              <Edit2 className="w-4 h-4" />
                              Modifier
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleDeleteSite(site)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={open => { if (!open) { setShowCreateDialog(false); setCreateForm(emptyCreateForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau site</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSite} className="space-y-4">
            <div className="space-y-2">
              <Label>Campagne *</Label>
              <Select value={createForm.campagne} onValueChange={v => setCreateForm(f => ({ ...f, campagne: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une campagne" /></SelectTrigger>
                <SelectContent>
                  {campaigns
                    .filter(c => filterCompany === "all" || c.entreprise === filterCompany)
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nom du site *</Label>
              <Input
                placeholder="Ex: Carrefour Owendo, Stand Marché du Mont-Bouët"
                value={createForm.nom}
                onChange={e => setCreateForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={createForm.ville}
                  onChange={e => setCreateForm(f => ({ ...f, ville: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Emplacement précis <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Input
                  placeholder="Allée 3, Entrée principale…"
                  value={createForm.emplacement_precis}
                  onChange={e => setCreateForm(f => ({ ...f, emplacement_precis: e.target.value }))}
                />
              </div>
            </div>
            {createForm.campagne && campaigns.find(c => c.id === createForm.campagne)?.type_recompense === "PROMOTIONS" && (
              <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <span className="text-base leading-none mt-0.5">🎁</span>
                <span>Cette campagne utilise des <strong>offres promotionnelles</strong> — vous pourrez les configurer pour ce site juste après la création.</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); setCreateForm(emptyCreateForm); }}>Annuler</Button>
              <Button type="submit" disabled={savingCreate || !createForm.nom.trim() || !createForm.campagne}>
                {savingCreate && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Créer le site
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSite} onOpenChange={open => !open && setEditingSite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le site</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSite} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={siteForm.nom} onChange={event => setSiteForm(form => ({ ...form, nom: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input value={siteForm.ville} onChange={event => setSiteForm(form => ({ ...form, ville: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Emplacement précis</Label>
              <Input value={siteForm.emplacement_precis} onChange={event => setSiteForm(form => ({ ...form, emplacement_precis: event.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingSite(null)}>Annuler</Button>
              <Button type="submit" disabled={saving || !siteForm.nom.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockSite} onOpenChange={open => !open && setStockSite(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beer className="w-4 h-4 text-sky-600" />
              Goodies & stock — {stockSite?.nom}
            </DialogTitle>
          </DialogHeader>
          {stockSite && (
            loadingStock ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Goodies livrés / jour */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Goodies livrés / jour</p>
                  {stockGoodies.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucun goodie disponible pour cette campagne.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Goodie</Label>
                          <Select value={stockLivraisonForm.goodie} onValueChange={v => setStockLivraisonForm(f => ({ ...f, goodie: v }))}>
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Goodie" /></SelectTrigger>
                            <SelectContent>{stockGoodies.map(g => <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Date</Label>
                          <Input type="date" className="h-8 text-xs mt-0.5" value={stockLivraisonForm.date} onChange={e => setStockLivraisonForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Quantité apportée</Label>
                        <Input type="number" min={1} className="h-8 text-xs mt-0.5" value={stockLivraisonForm.quantite} onChange={e => setStockLivraisonForm(f => ({ ...f, quantite: parseInt(e.target.value) || 1 }))} />
                      </div>
                      <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSubmitStockLivraison} disabled={savingStockLivraison}>
                        {savingStockLivraison ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Enregistrer livraison
                      </Button>
                    </>
                  )}
                  {stockLivraisons.length > 0 && (
                    <div className="space-y-1.5 pt-1 max-h-32 overflow-y-auto">
                      {stockLivraisons.slice(0, 10).map(l => (
                        <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{l.goodie_nom}</p>
                            <p className="text-muted-foreground">{new Date(l.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
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

                {/* Stock de boissons & boissons gratuites */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock de boissons & boissons gratuites</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input type="date" className="h-8 text-xs mt-0.5" value={stockDonneesForm.date} onChange={e => setStockDonneesForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Conditionnement</Label>
                      <Select value={stockDonneesForm.conditionnement} onValueChange={v => setStockDonneesForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                          <SelectItem value="PACK">En pack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Stock de boissons</Label>
                      <Input type="number" min={0} className="h-8 text-xs mt-0.5" value={stockDonneesForm.stock_boissons} onChange={e => setStockDonneesForm(f => ({ ...f, stock_boissons: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Boissons gratuites</Label>
                      <Input type="number" min={0} className="h-8 text-xs mt-0.5" value={stockDonneesForm.nombre_boissons_gratuites} onChange={e => setStockDonneesForm(f => ({ ...f, nombre_boissons_gratuites: e.target.value }))} />
                    </div>
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleSubmitStockDonnees} disabled={savingStockDonnees}>
                    {savingStockDonnees ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Enregistrer
                  </Button>
                  {stockDonnees.length > 0 && (
                    <div className="space-y-1.5 pt-1 max-h-32 overflow-y-auto">
                      {stockDonnees.slice(0, 10).map(d => (
                        <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
                          <p className="text-muted-foreground">{new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
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
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!offersSite} onOpenChange={open => !open && setOffersSite(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Offres ciblées par site</DialogTitle>
          </DialogHeader>

          {offersSite && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="font-semibold">{offersSite.nom}</p>
                <p className="text-sm text-muted-foreground">
                  Campagne: {offersSite.campagne_nom} - Entreprise: {offersSite.entreprise_nom}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Offres de la campagne</p>
                <Button
                  type="button" size="sm"
                  variant={showPromoForm ? "outline" : "default"}
                  onClick={() => { setShowPromoForm(v => !v); setPromoForm(emptyPromoForm); }}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Nouvelle offre pour ce site
                </Button>
              </div>

              {showPromoForm && (
                <form onSubmit={handleCreatePromotion} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-800">
                    Offre ciblée uniquement sur <span className="font-bold">{offersSite.nom}</span>
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type d'offre</Label>
                      <Select
                        value={promoForm.type_promotion}
                        onValueChange={v => setPromoForm(f => ({ ...f, type_promotion: v as TypePromotion }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OFFERT">Produit offert</SelectItem>
                          <SelectItem value="GAGNE">À gagner / Bon cadeau</SelectItem>
                          <SelectItem value="TIRAGE">Tirage à la roue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Conditionnement</Label>
                      <Select
                        value={promoForm.conditionnement}
                        onValueChange={v => setPromoForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                          <SelectItem value="PACK">En pack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Produit ciblé <span className="text-muted-foreground">(optionnel)</span></Label>
                      <Select
                        value={promoForm.produit_cible || "__none__"}
                        onValueChange={v => setPromoForm(f => ({ ...f, produit_cible: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Tous les produits" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Tous les produits</SelectItem>
                          {campagneProduits.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description de la récompense</Label>
                    <Input
                      placeholder="Ex : 1 bière offerte, bon cadeau…"
                      className="h-9"
                      value={promoForm.recompense_description}
                      onChange={e => setPromoForm(f => ({ ...f, recompense_description: e.target.value }))}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Qté requise (achat client)</Label>
                      <Input
                        type="number" min={1} className="h-9"
                        value={promoForm.quantite_requise}
                        onChange={e => setPromoForm(f => ({ ...f, quantite_requise: e.target.value }))}
                      />
                    </div>
                    {promoForm.type_promotion !== "TIRAGE" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Qté offerte (Vol. offert dans le journal)</Label>
                        <Input
                          type="number" min={1} className="h-9"
                          value={promoForm.quantite_offerte}
                          onChange={e => setPromoForm(f => ({ ...f, quantite_offerte: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                  {promoForm.type_promotion === "TIRAGE" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Goodies sur la roue <span className="text-muted-foreground">(optionnel)</span></Label>
                      {campagneGoodies.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun goodie disponible pour cette campagne.</p>
                      ) : (
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {campagneGoodies.map(g => (
                            <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={promoForm.goodies.includes(g.id)}
                                onCheckedChange={checked =>
                                  setPromoForm(f => ({
                                    ...f,
                                    goodies: checked
                                      ? [...f.goodies, g.id]
                                      : f.goodies.filter(id => id !== g.id),
                                  }))
                                }
                              />
                              {g.nom}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => { setShowPromoForm(false); setPromoForm(emptyPromoForm); }}
                    >Annuler</Button>
                    <Button type="submit" size="sm" disabled={saving || !promoForm.recompense_description.trim()}>
                      {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Créer l'offre
                    </Button>
                  </div>
                </form>
              )}

              {loadingOffers ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : promotions.length === 0 ? (
                <div className="rounded-xl border py-10 text-center text-muted-foreground">
                  Aucune offre promotionnelle sur cette campagne.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                  {promotions.map(promotion => {
                    const isGlobal = promotion.sites.length === 0;
                    const isEditing = editingPromo?.id === promotion.id;
                    return (
                      <div key={promotion.id} className="rounded-xl border p-4 space-y-3">
                        {isEditing ? (
                          <form onSubmit={handleUpdatePromotion} className="space-y-3">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Type d'offre</Label>
                                <Select
                                  value={editingPromo.type_promotion}
                                  onValueChange={v => setEditingPromo(f => f ? { ...f, type_promotion: v as TypePromotion } : f)}
                                >
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="OFFERT">Produit offert</SelectItem>
                                    <SelectItem value="GAGNE">À gagner / Bon cadeau</SelectItem>
                                    <SelectItem value="TIRAGE">Tirage à la roue</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Conditionnement</Label>
                                <Select
                                  value={editingPromo.conditionnement}
                                  onValueChange={v => setEditingPromo(f => f ? { ...f, conditionnement: v as TypeConditionnement } : f)}
                                >
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                                    <SelectItem value="PACK">En pack</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Produit ciblé <span className="text-muted-foreground">(optionnel)</span></Label>
                                <Select
                                  value={editingPromo.produit_cible || "__none__"}
                                  onValueChange={v => setEditingPromo(f => f ? { ...f, produit_cible: v === "__none__" ? "" : v } : f)}
                                >
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Tous les produits" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Tous les produits</SelectItem>
                                    {campagneProduits.map(p => (
                                      <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Description de la récompense</Label>
                              <Input
                                className="h-9"
                                value={editingPromo.recompense_description}
                                onChange={e => setEditingPromo(f => f ? { ...f, recompense_description: e.target.value } : f)}
                              />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Qté requise</Label>
                                <Input
                                  type="number" min={1} className="h-9"
                                  value={editingPromo.quantite_requise}
                                  onChange={e => setEditingPromo(f => f ? { ...f, quantite_requise: e.target.value } : f)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Qté offerte</Label>
                                <Input
                                  type="number" min={1} className="h-9"
                                  value={editingPromo.quantite_offerte}
                                  onChange={e => setEditingPromo(f => f ? { ...f, quantite_offerte: e.target.value } : f)}
                                />
                              </div>
                            </div>
                            {editingPromo.type_promotion === "TIRAGE" && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Goodies sur la roue <span className="text-muted-foreground">(optionnel)</span></Label>
                                {campagneGoodies.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">Aucun goodie disponible pour cette campagne.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {campagneGoodies.map(g => (
                                      <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <Checkbox
                                          checked={editingPromo.goodies.includes(g.id)}
                                          onCheckedChange={checked =>
                                            setEditingPromo(f => f ? ({
                                              ...f,
                                              goodies: checked
                                                ? [...f.goodies, g.id]
                                                : f.goodies.filter(id => id !== g.id),
                                            }) : f)
                                          }
                                        />
                                        {g.nom}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingPromo(null)}>Annuler</Button>
                              <Button type="submit" size="sm" disabled={saving || !editingPromo.recompense_description.trim()}>
                                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                Enregistrer
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">
                                  Achat&nbsp;<span className="text-blue-700 font-bold">{promotion.quantite_requise}</span>&nbsp;<span className="text-xs font-normal text-muted-foreground">({promotion.conditionnement_display ?? (promotion.conditionnement === "PACK" ? "Pack" : "Unité")})</span>&nbsp;→&nbsp;Offert&nbsp;<span className="text-emerald-700 font-bold">{promotion.quantite_offerte ?? 1}</span>&nbsp;—&nbsp;{promotion.recompense_description}
                                </p>
                                {promotion.produit_cible_nom && (
                                  <Badge variant="outline" className="text-xs">{promotion.produit_cible_nom}</Badge>
                                )}
                                <Badge variant={promotion.is_active ? "default" : "outline"}>
                                  {promotion.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {isGlobal && <Badge variant="outline">Tous les sites</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                  {promotion.type_promotion_display}
                                  {promotion.type_promotion === "TIRAGE" && promotion.goodies_details.length > 0 && (
                                    <span className="ml-2 text-purple-600 font-medium">
                                      — Roue : {promotion.goodies_details.map(g => g.nom).join(", ")}
                                    </span>
                                  )}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button" variant="ghost" size="icon"
                                onClick={() => openEditPromo(promotion)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button" variant="ghost" size="icon"
                                disabled={saving}
                                onClick={() => handleDeletePromotion(promotion.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                              {isGlobal ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={saving}
                                  onClick={() => updatePromotionSites(promotion, [offersSite.id])}
                                >
                                  Cibler ce site
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={saving}
                                  onClick={() => updatePromotionSites(promotion, [])}
                                >
                                  Rendre globale
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {!isEditing && (
                          <>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {campaignSites.map(site => {
                                const checked = isGlobal || promotion.sites.includes(site.id);
                                return (
                                  <label
                                    key={site.id}
                                    className={cn(
                                      "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                                      checked ? "bg-emerald-50 border-emerald-200" : "bg-background",
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={saving || isGlobal}
                                      onCheckedChange={value => {
                                        const current = isGlobal ? [] : promotion.sites;
                                        const next = value
                                          ? Array.from(new Set([...current, site.id]))
                                          : current.filter(id => id !== site.id);
                                        updatePromotionSites(promotion, next);
                                      }}
                                    />
                                    <span className="min-w-0">
                                      <span className="font-medium block truncate">{site.nom}</span>
                                      <span className="text-xs text-muted-foreground">{site.ville}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Aucun site coché = offre globale sur toute la campagne.
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ---- Dialog Hôtesses ---- */}
      {/* ---- Dialog Planning site ---- */}
      <Dialog open={!!planningSite} onOpenChange={open => !open && setPlanningSite(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Planning — {planningSite?.nom}
            </DialogTitle>
          </DialogHeader>
          {planningSite && (() => {
            const camp = campaigns.find(c => c.id === planningSite.campagne);
            return (
              <div className="space-y-4">
                {/* List */}
                {siteJours.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {siteJours.map(j => (
                      <div key={j.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-xs font-semibold text-foreground">
                            {new Date(j.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                          <span className="text-xs text-muted-foreground">{j.heure_ouverture.slice(0, 5)}–{j.heure_fermeture.slice(0, 5)}</span>
                        </div>
                        <button onClick={() => handleDeleteSiteJour(j.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Aucun jour animé défini pour ce site</p>
                )}

                {/* Add form */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ajouter un jour</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input type="date" value={sitePlanForm.date}
                        min={camp?.date_debut} max={camp?.date_fin}
                        onChange={e => setSitePlanForm(f => ({ ...f, date: e.target.value }))}
                        className="h-8 text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ouverture</Label>
                      <Input type="time" value={sitePlanForm.heure_ouverture}
                        onChange={e => setSitePlanForm(f => ({ ...f, heure_ouverture: e.target.value }))}
                        className="h-8 text-xs mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fermeture</Label>
                      <Input type="time" value={sitePlanForm.heure_fermeture}
                        onChange={e => setSitePlanForm(f => ({ ...f, heure_fermeture: e.target.value }))}
                        className="h-8 text-xs mt-0.5" />
                    </div>
                  </div>
                  {sitePlanError && <p className="text-xs text-rose-500">{sitePlanError}</p>}
                  <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleAddSiteJour} disabled={savingSitePlan}>
                    {savingSitePlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Ajouter
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!hotelSite} onOpenChange={open => !open && setHotelSite(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gérer l&apos;équipe — {hotelSite?.nom}</DialogTitle>
          </DialogHeader>

          {hotelSite && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">
                  Campagne&nbsp;: <span className="font-medium text-foreground">{hotelSite.campagne_nom}</span>
                  &nbsp;—&nbsp;Entreprise&nbsp;: <span className="font-medium text-foreground">{hotelSite.entreprise_nom}</span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Superviseurs du site</p>
                <Button
                  type="button" size="sm"
                  variant={showSuperviseurForm ? "outline" : "default"}
                  onClick={() => { setShowSuperviseurForm(v => !v); setSuperviseurForm(emptySuperviseurForm); }}
                  className="gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  Nouveau superviseur
                </Button>
              </div>

              {showSuperviseurForm && (
                <form onSubmit={handleCreateSuperviseur} className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-800">Créer et affecter un superviseur</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom complet</Label>
                      <Input
                        placeholder="Nom Prénom"
                        className="h-9"
                        value={superviseurForm.name}
                        onChange={e => setSuperviseurForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        placeholder="superviseur@email.com"
                        className="h-9"
                        value={superviseurForm.email}
                        onChange={e => setSuperviseurForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => { setShowSuperviseurForm(false); setSuperviseurForm(emptySuperviseurForm); }}
                    >Annuler</Button>
                    <Button type="submit" size="sm" disabled={savingTeam || !superviseurForm.name.trim() || !superviseurForm.email.trim()}>
                      {savingTeam && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Créer et affecter
                    </Button>
                  </div>
                </form>
              )}

              {loadingTeam ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[30vh] overflow-auto pr-1">
                  {allSuperviseurs.length === 0 ? (
                    <div className="rounded-xl border py-8 text-center text-muted-foreground text-sm">
                      Aucun superviseur enregistré.
                    </div>
                  ) : (
                    allSuperviseurs.map(superviseur => {
                      const assigned = siteDetail?.superviseurs.some(s => s.id === superviseur.id) ?? false;
                      return (
                        <label
                          key={superviseur.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer",
                            assigned ? "bg-blue-50 border-blue-300" : "bg-background hover:bg-muted/40",
                          )}
                        >
                          <Checkbox
                            checked={assigned}
                            disabled={savingTeam}
                            onCheckedChange={() => toggleSuperviseur(superviseur.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{superviseur.name}</p>
                            <p className="text-xs text-muted-foreground">{superviseur.email}</p>
                          </div>
                          {assigned && (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">Affecté</Badge>
                          )}
                          {savingTeam && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Les superviseurs cochés sont directement affectés à ce site. Un email de notification leur sera envoyé si nouvellement ajoutés.
              </p>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <p className="text-sm font-medium text-muted-foreground">Hôtesses disponibles</p>
                <Button
                  type="button" size="sm"
                  variant={showHotesseForm ? "outline" : "default"}
                  onClick={() => { setShowHotesseForm(v => !v); setHotesseForm(emptyHotesseForm); }}
                  className="gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  Nouvelle hôtesse
                </Button>
              </div>

              {showHotesseForm && (
                <form onSubmit={handleCreateHotesse} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-800">Créer et affecter une hôtesse</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom complet</Label>
                      <Input
                        placeholder="Nom Prénom"
                        className="h-9"
                        value={hotesseForm.name}
                        onChange={e => setHotesseForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        placeholder="hotesse@email.com"
                        className="h-9"
                        value={hotesseForm.email}
                        onChange={e => setHotesseForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost"
                      onClick={() => { setShowHotesseForm(false); setHotesseForm(emptyHotesseForm); }}
                    >Annuler</Button>
                    <Button type="submit" size="sm" disabled={savingTeam || !hotesseForm.name.trim() || !hotesseForm.email.trim()}>
                      {savingTeam && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Créer et affecter
                    </Button>
                  </div>
                </form>
              )}

              {loadingTeam ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[30vh] overflow-auto pr-1">
                  {allHotesses.length === 0 ? (
                    <div className="rounded-xl border py-8 text-center text-muted-foreground text-sm">
                      Aucune hôtesse enregistrée.
                    </div>
                  ) : (
                    allHotesses.map(hotesse => {
                      const assigned = siteDetail?.hotesses.some(h => h.id === hotesse.id) ?? false;
                      return (
                        <label
                          key={hotesse.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer",
                            assigned ? "bg-emerald-50 border-emerald-300" : "bg-background hover:bg-muted/40",
                          )}
                        >
                          <Checkbox
                            checked={assigned}
                            disabled={savingTeam}
                            onCheckedChange={() => toggleHotesse(hotesse.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{hotesse.name}</p>
                            <p className="text-xs text-muted-foreground">{hotesse.email}</p>
                          </div>
                          {assigned && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Affectée</Badge>
                          )}
                          {savingTeam && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Les hôtesses cochées sont directement affectées à ce site. Un email de notification leur sera envoyé si elles sont nouvellement ajoutées.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={null}>
      <SitesPageContent />
    </Suspense>
  );
}
