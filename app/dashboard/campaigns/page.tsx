"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type {
  CampagneList, CreateCampagnePayload,
  Entreprise, TeamMember, TypeCampagne, TypeRecompense,
} from "@/lib/types/backend";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Calendar, Target, MoreVertical, Eye, Trash2,
  Loader2, Building2, Sparkles, Users, ChevronRight, ChevronLeft,
  X, Check, UtensilsCrossed, ShoppingCart, Gift, Tag,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {cn} from "@/lib/utils";

// Fonction utilitaire pour les couleurs (cohérent avec [id]/page.tsx)
function hex(color: string, alpha: number) {
  const c = (color || "#006776").replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// Helpers pour déterminer l'affichage selon le type (cohérent avec [id]/page.tsx)
const getShowTasting = (typeCampagne: TypeCampagne) => typeCampagne !== "VENTE";
const getShowVente = (typeCampagne: TypeCampagne) => typeCampagne !== "DEGUSTATION";
const getShowWheel = (typeRecompense: TypeRecompense) => typeRecompense === "GOODIES";
const getShowPromos = (typeRecompense: TypeRecompense) => typeRecompense === "PROMOTIONS";

// Configuration des couleurs pour types de campagne (cohérent avec [id]/page.tsx)
const TYPE_CAMPAGNE_COLORS: Record<TypeCampagne, string> = {
  DEGUSTATION: "#0d9488",      // teal-600
  VENTE: "#059669",            // emerald-600
  DEGUSTATION_VENTE: "#7c3aed", // violet-600
};

const TYPE_RECOMPENSE_COLORS: Record<TypeRecompense, string> = {
  AUCUNE: "#64748b",   // slate-500
  GOODIES: "#f97316",  // orange-500
  PROMOTIONS: "#3b82f6", // blue-500
};

// Couleurs pour les types de promotion (cohérent avec [id]/page.tsx)
const PROMO_TYPE_COLORS: Record<TypePromoRule, { bg: string; border: string; text: string; dot: string; label: string }> = {
  OFFERT: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Produit offert",
  },
  GAGNE: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "À gagner (tirage)",
  },
};

const STATUS_CFG: Record<string, { label: string; badge: string; strip: string }> = {
  brouillon:  { label: "Brouillon",  badge: "bg-slate-100 text-slate-600 border border-slate-200",       strip: "from-slate-400 to-slate-300" },
  planifiee:  { label: "Planifiée",  badge: "bg-blue-100 text-blue-700 border border-blue-200",          strip: "from-blue-500 to-cyan-400" },
  active:     { label: "Active",     badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", strip: "from-emerald-500 to-teal-400" },
  terminee:   { label: "Terminée",   badge: "bg-violet-100 text-violet-700 border border-violet-200",   strip: "from-violet-500 to-purple-400" },
  annulee:    { label: "Annulée",    badge: "bg-red-100 text-red-700 border border-red-200",             strip: "from-red-500 to-rose-400" },
};

const DEFAULT_STATUS_CFG = { label: "—", badge: "bg-slate-100 text-slate-500 border border-slate-200", strip: "from-slate-300 to-slate-200" };

type SiteEntry  = { nom: string; ville: string; emplacement_precis: string; superviseurs_ids: string[]; hotesses_ids: string[] };
type TypePromoRule = "OFFERT" | "GAGNE";
type ReglePromo = { quantite_requise: string; recompense_description: string; type_promotion: TypePromoRule };

const EMPTY_SITE:  SiteEntry  = { nom: "", ville: "Libreville", emplacement_precis: "", superviseurs_ids: [], hotesses_ids: [] };
const EMPTY_REGLE: ReglePromo = { quantite_requise: "", recompense_description: "", type_promotion: "OFFERT" };
const EMPTY_FORM = { nom: "", description: "", entreprise: "", date_debut: "", date_fin: "", type_campagne: "DEGUSTATION_VENTE" as TypeCampagne, type_recompense: "AUCUNE" as TypeRecompense, note_gout_active: false, note_gout_max: 5 as 5 | 10, note_ambiance_active: false, note_ambiance_max: 5 as 5 | 10, objectif_degustations: "", objectif_ventes: "", regles_promotions: [] as ReglePromo[], sites: [{ ...EMPTY_SITE }] as SiteEntry[] };

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [staff, setStaff] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ ...EMPTY_FORM, sites: [{ ...EMPTY_SITE }] as SiteEntry[] });

  const isAdmin = user?.role === "Administrateur";
  const canManage = user?.role && ["Administrateur", "Superviseur"].includes(user.role);

  const hotesses = staff.filter(m => m.role === "Hotesse");
  const superviseurs = staff.filter(m => m.role === "Superviseur");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, entRes] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        isAdmin ? api.get<Entreprise[]>("/entreprises/") : Promise.resolve({ data: [] as Entreprise[] }),
      ]);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []));
      setEntreprises(Array.isArray(entRes.data) ? entRes.data : ((entRes.data as { results?: Entreprise[] }).results ?? []));
      if (isAdmin) {
        const staffRes = await api.get<TeamMember[]>("/users/terrain-staff/");
        setStaff(staffRes.data);
      }
    } catch {
      toast.error("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: CreateCampagnePayload = {
        nom: form.nom.trim(),
        entreprise: form.entreprise,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        description: form.description.trim() || undefined,
        type_campagne: form.type_campagne,
        type_recompense: form.type_recompense,
        note_gout_active: form.note_gout_active,
        note_gout_max: form.note_gout_active ? form.note_gout_max : undefined,
        note_ambiance_active: form.note_ambiance_active,
        note_ambiance_max: form.note_ambiance_active ? form.note_ambiance_max : undefined,
        objectif_degustations: (form.type_campagne !== "VENTE" && form.objectif_degustations) ? parseInt(form.objectif_degustations) : null,
        objectif_ventes: (form.type_campagne !== "DEGUSTATION" && form.objectif_ventes) ? parseInt(form.objectif_ventes) : null,
      };
      const { data: created } = await api.post<CampagneList>("/campagnes/", payload);

      const validSites = form.sites.filter(s => s.nom.trim());
      await Promise.all(validSites.map(async (site) => {
        const { data: createdSite } = await api.post<{ id: string }>("/sites/", {
          nom: site.nom.trim(),
          ville: site.ville.trim() || "Libreville",
          emplacement_precis: site.emplacement_precis.trim() || undefined,
          campagne: created.id,
        });
        if (site.superviseurs_ids.length || site.hotesses_ids.length) {
          await api.post(`/sites/${createdSite.id}/manage-team/`, {
            superviseurs_ids: site.superviseurs_ids,
            hotesses_ids: site.hotesses_ids,
            notify: true,
          });
        }
      }));

      // Créer les règles promotionnelles si le type de récompense est PROMOTIONS
      if (form.type_recompense === "PROMOTIONS") {
        const reglesValides = form.regles_promotions.filter(
          r => r.quantite_requise && r.recompense_description.trim()
        );
        if (reglesValides.length > 0) {
          await Promise.all(reglesValides.map(r =>
            api.post("/promotions/", {
              campagne: created.id,
              type_promotion: r.type_promotion,
              quantite_requise: parseInt(r.quantite_requise),
              recompense_description: r.recompense_description.trim(),
              is_active: true,
            })
          ));
        }
      }

      setCampaigns(prev => [created, ...prev]);
      invalidateCache("/campagnes");
      invalidateCache("/sites");
      const promoCount = form.type_recompense === "PROMOTIONS"
        ? form.regles_promotions.filter(r => r.quantite_requise && r.recompense_description.trim()).length
        : 0;
      const parts = [
        validSites.length   ? `${validSites.length} site(s)` : null,
        promoCount > 0      ? `${promoCount} règle(s) promo` : null,
      ].filter(Boolean).join(", ");
      toast.success(`Campagne créée${parts ? ` avec ${parts}` : ""}.`);
      setDialogOpen(false);
      resetForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    try {
      await api.delete(`/campagnes/${id}/`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      invalidateCache("/campagnes");
      toast.success("Campagne supprimée.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const filtered = campaigns.filter(c =>
    c.nom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statCounts = {
    total:    campaigns.length,
    active:   campaigns.filter(c => c.date_debut <= new Date().toISOString().slice(0,10) && c.date_fin >= new Date().toISOString().slice(0,10)).length,
    upcoming: campaigns.filter(c => c.date_debut > new Date().toISOString().slice(0,10)).length,
    done:     campaigns.filter(c => c.date_fin < new Date().toISOString().slice(0,10)).length,
  };

  const resetForm = () => {
    setStep(1);
    setForm({ ...EMPTY_FORM, sites: [{ ...EMPTY_SITE }] });
  };

  const handleStep1Next = () => {
    if (!form.nom.trim() || !form.entreprise || !form.date_debut || !form.date_fin) {
      toast.error("Nom, entreprise et dates sont requis.");
      return;
    }
    if (form.date_fin < form.date_debut) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }
    setStep(2);
  };

  const addSite = () => setForm(f => ({ ...f, sites: [...f.sites, { ...EMPTY_SITE }] }));
  const removeSite = (idx: number) => setForm(f => ({ ...f, sites: f.sites.filter((_, i) => i !== idx) }));
  const updateSite = (idx: number, patch: Partial<SiteEntry>) =>
    setForm(f => ({ ...f, sites: f.sites.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  const toggleTeam = (siteIdx: number, role: "superviseurs_ids" | "hotesses_ids", id: string) =>
    setForm(f => ({
      ...f,
      sites: f.sites.map((s, i) => {
        if (i !== siteIdx) return s;
        const arr = s[role];
        return { ...s, [role]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
      }),
    }));

  const addRegle    = () => setForm(f => ({ ...f, regles_promotions: [...f.regles_promotions, { ...EMPTY_REGLE }] }));
  const removeRegle = (idx: number) => setForm(f => ({ ...f, regles_promotions: f.regles_promotions.filter((_, i) => i !== idx) }));
  const updateRegle = (idx: number, patch: Partial<ReglePromo>) =>
    setForm(f => ({ ...f, regles_promotions: f.regles_promotions.map((r, i) => i === idx ? { ...r, ...patch } : r) }));

  const campaignFormContent = (
    <div className="mt-2">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors", step === 1 ? "bg-[#006776] text-white" : "bg-emerald-500 text-white")}>
            {step === 1 ? "1" : <Check className="w-3.5 h-3.5" />}
          </div>
          <span className={cn("text-sm font-semibold", step === 1 ? "text-foreground" : "text-muted-foreground")}>Informations</span>
        </div>
        <div className="flex-1 h-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", step === 2 ? "bg-[#006776] text-white" : "bg-slate-200 text-slate-500")}>2</div>
          <span className={cn("text-sm font-semibold", step === 2 ? "text-foreground" : "text-muted-foreground")}>Sites &amp; Équipe</span>
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-0">
          <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1 pb-1">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom *</Label>
              <input className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Tournée Libreville Sud" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entreprise *</Label>
              <Select value={form.entreprise} onValueChange={v => setForm(f => ({ ...f, entreprise: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{entreprises.map(e => <SelectItem key={e.id} value={e.id}>{e.nom_commercial}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="rounded-xl resize-none" placeholder="Contexte, produits ciblés..." />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date de début *</Label>
              <input type="date" className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date de fin *</Label>
              <input type="date" className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
            </div>
          </div>
          {/* Type de campagne - couleurs cohérentes avec [id]/page.tsx */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type de campagne *</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "DEGUSTATION",       label: "Dégustation",        icon: <UtensilsCrossed className="w-4 h-4" />, color: TYPE_CAMPAGNE_COLORS.DEGUSTATION },
                { v: "VENTE",             label: "Vente",              icon: <ShoppingCart    className="w-4 h-4" />, color: TYPE_CAMPAGNE_COLORS.VENTE },
                { v: "DEGUSTATION_VENTE", label: "Dég. + Vente",       icon: <Target          className="w-4 h-4" />, color: TYPE_CAMPAGNE_COLORS.DEGUSTATION_VENTE },
              ] as { v: TypeCampagne; label: string; icon: React.ReactNode; color: string }[]).map(o => (
                <button key={o.v} type="button"
                  onClick={() => setForm(f => ({ ...f, type_campagne: o.v }))}
                  className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium",
                    form.type_campagne === o.v
                      ? "border-current bg-current/5"
                      : "border-slate-200 hover:border-slate-300 text-slate-500")}
                  style={form.type_campagne === o.v ? { color: o.color, borderColor: o.color } : {}}>
                  {o.icon}
                  <span className="text-xs leading-tight text-center">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Type de récompense - couleurs cohérentes avec [id]/page.tsx */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récompenses</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "AUCUNE",     label: "Aucune",     icon: <X    className="w-4 h-4" />, color: TYPE_RECOMPENSE_COLORS.AUCUNE },
                { v: "GOODIES",    label: "Goodies 🎡", icon: <Gift className="w-4 h-4" />, color: TYPE_RECOMPENSE_COLORS.GOODIES },
                { v: "PROMOTIONS", label: "Promotions", icon: <Tag  className="w-4 h-4" />, color: TYPE_RECOMPENSE_COLORS.PROMOTIONS },
              ] as { v: TypeRecompense; label: string; icon: React.ReactNode; color: string }[]).map(o => (
                <button key={o.v} type="button"
                  onClick={() => setForm(f => ({ ...f, type_recompense: o.v, regles_promotions: o.v !== "PROMOTIONS" ? [] : f.regles_promotions }))}
                  className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium",
                    form.type_recompense === o.v
                      ? "border-current bg-current/5"
                      : "border-slate-200 hover:border-slate-300 text-slate-500")}
                  style={form.type_recompense === o.v ? { color: o.color, borderColor: o.color } : {}}>
                  {o.icon}
                  <span className="text-xs leading-tight text-center">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Objectifs (conditionnels selon type) - utilisation des helpers cohérents */}
          {getShowTasting(form.type_campagne) && getShowVente(form.type_campagne) && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objectifs de la campagne</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dégustations (quantité)</Label>
                  <input type="number" min="0" className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 text-sm shadow-sm" value={form.objectif_degustations} onChange={e => setForm(f => ({ ...f, objectif_degustations: e.target.value }))} placeholder="Ex: 500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ventes (quantité)</Label>
                  <input type="number" min="0" className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 text-sm shadow-sm" value={form.objectif_ventes} onChange={e => setForm(f => ({ ...f, objectif_ventes: e.target.value }))} placeholder="Ex: 100" />
                </div>
              </div>
            </div>
          )}
          {form.type_campagne === "DEGUSTATION" && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Objectif dégustations</p>
              <input type="number" min="0" className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 text-sm shadow-sm" value={form.objectif_degustations} onChange={e => setForm(f => ({ ...f, objectif_degustations: e.target.value }))} placeholder="Ex: 500" />
            </div>
          )}
          {form.type_campagne === "VENTE" && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Objectif ventes</p>
              <input type="number" min="0" className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 text-sm shadow-sm" value={form.objectif_ventes} onChange={e => setForm(f => ({ ...f, objectif_ventes: e.target.value }))} placeholder="Ex: 100" />
            </div>
          )}

          {/* ── Notes configurable (goût + ambiance) ── */}
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note du goût</p>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setForm(f => ({ ...f, note_gout_active: !f.note_gout_active }))}>
                <span className="text-sm text-foreground">Activer la saisie de la note du goût</span>
                <div className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", form.note_gout_active ? "bg-indigo-500" : "bg-slate-300")}>
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.note_gout_active ? "translate-x-6" : "translate-x-1")} />
                </div>
              </div>
              {form.note_gout_active && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Échelle de notation</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([5, 10] as const).map(v => (
                      <button key={v} type="button"
                        onClick={() => setForm(f => ({ ...f, note_gout_max: v }))}
                        className={cn("py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                          form.note_gout_max === v ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-slate-200 hover:border-indigo-300 text-slate-500")}>
                        1 à {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note d&apos;ambiance</p>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setForm(f => ({ ...f, note_ambiance_active: !f.note_ambiance_active }))}>
                <span className="text-sm text-foreground">Activer la saisie de la note d&apos;ambiance</span>
                <div className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", form.note_ambiance_active ? "bg-violet-500" : "bg-slate-300")}>
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", form.note_ambiance_active ? "translate-x-6" : "translate-x-1")} />
                </div>
              </div>
              {form.note_ambiance_active && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Échelle de notation</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([5, 10] as const).map(v => (
                      <button key={v} type="button"
                        onClick={() => setForm(f => ({ ...f, note_ambiance_max: v }))}
                        className={cn("py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                          form.note_ambiance_max === v ? "border-violet-500 bg-violet-50 text-violet-600" : "border-slate-200 hover:border-violet-300 text-slate-500")}>
                        1 à {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* ── Règles promotionnelles (affiché uniquement si PROMOTIONS) ── */}
          {getShowPromos(form.type_recompense) && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3"
              style={{ background: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.06), borderColor: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.2) }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 flex items-center gap-1.5"
                  style={{ color: TYPE_RECOMPENSE_COLORS.PROMOTIONS }}>
                  <Tag className="w-3.5 h-3.5" /> Offres promotionnelles
                </p>
                {form.regles_promotions.length === 0 && (
                  <span className="text-xs text-blue-400 italic" style={{ color: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.6) }}>Aucune offre configurée</span>
                )}
              </div>

              {form.regles_promotions.length === 0 && (
                <div className="text-xs rounded-lg p-3"
                  style={{ background: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.08), color: TYPE_RECOMPENSE_COLORS.PROMOTIONS }}>
                  <p className="font-medium mb-1">Exemple pour la campagne 33 Export :</p>
                  <ul className="list-disc list-inside space-y-0.5" style={{ color: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.7) }}>
                    <li>Offre 1 : 3 canettes achetées = 1 offerte (type "Produit offert")</li>
                    <li>Offre 2 : 6 canettes achetées = 1 offerte + tirage (type "À gagner")</li>
                  </ul>
                </div>
              )}

              {form.regles_promotions.map((regle, idx) => {
                const promoStyle = PROMO_TYPE_COLORS[regle.type_promotion];
                return (
                <div key={idx} className={`bg-white rounded-xl border ${promoStyle.border} shadow-sm p-3 space-y-3`}>
                  {/* Header with type selector */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${promoStyle.text}`}>Offre {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={regle.type_promotion}
                        onValueChange={(v: TypePromoRule) => updateRegle(idx, { type_promotion: v })}
                      >
                        <SelectTrigger className={`h-7 w-36 text-xs rounded-lg ${promoStyle.border}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OFFERT">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${PROMO_TYPE_COLORS.OFFERT.dot}`} />
                              {PROMO_TYPE_COLORS.OFFERT.label}
                            </span>
                          </SelectItem>
                          <SelectItem value="GAGNE">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${PROMO_TYPE_COLORS.GAGNE.dot}`} />
                              {PROMO_TYPE_COLORS.GAGNE.label}
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeRegle(idx)}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                        title="Supprimer cette offre"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Rule configuration */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <Label className="text-[10px] uppercase text-muted-foreground">Quantité requise</Label>
                      <input
                        type="number" min="1"
                        className="flex h-8 w-full rounded-lg border border-input bg-slate-50 px-2 text-sm text-center font-semibold shadow-sm"
                        placeholder="3"
                        value={regle.quantite_requise}
                        onChange={e => updateRegle(idx, { quantite_requise: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 text-center text-xs text-muted-foreground">→</div>
                    <div className="col-span-8">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        {regle.type_promotion === "OFFERT" ? "Produit(s) offert(s)" : "Récompense / Gain"}
                      </Label>
                      <input
                        className="flex h-8 w-full rounded-lg border border-input bg-slate-50 px-3 text-sm shadow-sm"
                        placeholder={regle.type_promotion === "OFFERT" ? "Ex: 1 canette offerte" : "Ex: 1 canette + tirage goodie"}
                        value={regle.recompense_description}
                        onChange={e => updateRegle(idx, { recompense_description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Type indicator */}
                  <div className="flex items-center gap-2 text-xs">
                    {regle.type_promotion === "OFFERT" ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Le client reçoit immédiatement la récompense
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Le client participe au tirage pour gagner un goodie + 1 produit
                      </span>
                    )}
                  </div>
                </div>
              );
              })}

              <button
                type="button"
                onClick={addRegle}
                className="flex items-center gap-2 text-sm font-semibold w-full justify-center rounded-xl border-2 border-dashed py-2.5 transition-all"
                style={{ color: TYPE_RECOMPENSE_COLORS.PROMOTIONS, borderColor: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.3) }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = TYPE_RECOMPENSE_COLORS.PROMOTIONS; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.3); }}
              >
                <Plus className="w-4 h-4" /> Ajouter une offre
              </button>

              {form.regles_promotions.length > 0 && (
                <p className="text-xs text-center" style={{ color: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.7) }}>
                  <span style={{ color: PROMO_TYPE_COLORS.OFFERT.text }}>
                    {form.regles_promotions.filter(r => r.type_promotion === "OFFERT").length} offre(s) directe(s)
                  </span>
                  {" • "}
                  <span style={{ color: PROMO_TYPE_COLORS.GAGNE.text }}>
                    {form.regles_promotions.filter(r => r.type_promotion === "GAGNE").length} tirage(s)
                  </span>
                </p>
              )}
            </div>
          )}

          </div>{/* end scrollable */}
          <div className="flex justify-end pt-3 border-t border-slate-100 mt-3">
            <Button type="button" onClick={handleStep1Next} className="rounded-xl bg-[#006776] hover:bg-[#00566a] text-white">
              Suivant : Sites <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit}>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {form.sites.map((site, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#006776]">Site {idx + 1}</span>
                  {form.sites.length > 1 && (
                    <button type="button" onClick={() => removeSite(idx)} className="text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nom du site *</Label>
                    <input className="flex h-8 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm" placeholder="Ex: Carrefour Centre" value={site.nom} onChange={e => updateSite(idx, { nom: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ville</Label>
                    <input className="flex h-8 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm" placeholder="Libreville" value={site.ville} onChange={e => updateSite(idx, { ville: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Emplacement précis (optionnel)</Label>
                  <input className="flex h-8 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm" placeholder="Ex: Allée centrale, stand 3" value={site.emplacement_precis} onChange={e => updateSite(idx, { emplacement_precis: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Superviseurs <span className="text-[#006776]">({site.superviseurs_ids.length})</span></Label>
                    <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg bg-white border border-input p-2">
                      {superviseurs.length === 0
                        ? <p className="text-xs text-muted-foreground p-1">Aucun superviseur</p>
                        : superviseurs.map(s => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                            <Checkbox checked={site.superviseurs_ids.includes(s.id)} onCheckedChange={() => toggleTeam(idx, "superviseurs_ids", s.id)} className="data-[state=checked]:bg-[#006776] data-[state=checked]:border-[#006776]" />
                            <span className="text-xs truncate">{s.name}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Hôtesses <span className="text-[#006776]">({site.hotesses_ids.length})</span></Label>
                    <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg bg-white border border-input p-2">
                      {hotesses.length === 0
                        ? <p className="text-xs text-muted-foreground p-1">Aucune hôtesse</p>
                        : hotesses.map(h => (
                          <label key={h.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                            <Checkbox checked={site.hotesses_ids.includes(h.id)} onCheckedChange={() => toggleTeam(idx, "hotesses_ids", h.id)} className="data-[state=checked]:bg-[#006776] data-[state=checked]:border-[#006776]" />
                            <span className="text-xs truncate">{h.name}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSite} className="flex items-center gap-2 text-sm text-[#006776] hover:text-[#00566a] font-semibold mt-3 w-full justify-center rounded-xl border-2 border-dashed border-[#006776]/30 hover:border-[#006776]/60 py-2.5 transition-all">
            <Plus className="w-4 h-4" />Ajouter un site
          </button>
          <div className="flex justify-between pt-4 border-t border-slate-100 mt-3">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" />Retour</Button>
            <Button type="submit" disabled={saving} className="rounded-xl bg-[#006776] hover:bg-[#00566a] text-white">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</> : "Créer la campagne"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Hero banner ── */}
      {isAdmin ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-600 to-violet-500 p-6 md:p-8 text-white shadow-2xl shadow-indigo-200">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-yellow-200" />
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Administration</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Campagnes marketing</h1>
              <p className="text-white/70 mt-1 text-sm">Gérez et suivez toutes vos campagnes terrain</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm w-fit shrink-0">
                  <Plus className="w-4 h-4 mr-2" />Nouvelle campagne
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Nouvelle campagne</DialogTitle>
                </DialogHeader>
                {campaignFormContent}
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative z-10 grid grid-cols-4 gap-3 mt-6">
            {[
              { label: "Total",      value: statCounts.total, },
              { label: "En cours",   value: statCounts.active, },
              { label: "À venir",    value: statCounts.upcoming, },
              { label: "Terminées",  value: statCounts.done, },
            ].map((s, i) => (
              <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
                {/* <div className="text-xs mb-0.5">{s.icon}</div> */}
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-white/65">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (() => {
        const brandCamp = campaigns[0];
        const primary   = brandCamp?.couleur_primaire   ?? "#006776";
        const secondary = brandCamp?.couleur_secondaire ?? "#00899b";
        const logo      = brandCamp?.logo_url ?? null;
        const entNom    = brandCamp?.entreprise_nom ?? "";
        return (
          <div
            className="relative overflow-hidden rounded-2xl text-white shadow-xl"
            style={{
              background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
              boxShadow: `0 12px 40px -8px ${hex(primary, 0.4)}`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.13),transparent_60%)]" />
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 p-6 md:p-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 backdrop-blur-sm overflow-hidden">
                  {logo
                    ? <img src={logo} alt={entNom} className="w-full h-full object-contain p-1" />
                    : <span className="text-sm font-bold text-white">{initials(entNom || "??")}</span>
                  }
                </div>
                <div>
                  <p className="text-white/65 text-xs font-medium uppercase tracking-wider mb-0.5">{entNom}</p>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Campagnes marketing</h1>
                  <p className="text-white/70 mt-1 text-sm">Gérez et suivez vos campagnes terrain</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-1 sm:gap-2 shrink-0">
                {[
                  { label: "En cours",  value: statCounts.active },
                  { label: "À venir",   value: statCounts.upcoming },
                  { label: "Terminées", value: statCounts.done },
                ].map((s, i) => (
                  <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20 text-center sm:flex sm:items-center sm:gap-3 sm:text-left">
                    <span className="text-xl font-bold sm:text-lg">{s.value}</span>
                    <span className="text-xs text-white/65 block sm:inline">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          className="flex h-9 w-full rounded-xl border border-input bg-white px-3 py-1 pl-9 text-sm shadow-sm"
          placeholder="Rechercher une campagne..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden shadow-md animate-pulse">
              <div className="h-2 bg-slate-200" />
              <div className="p-5 space-y-3 bg-white">
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-16 bg-slate-50 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Aucune campagne</h3>
          <p className="text-muted-foreground text-sm">{isAdmin ? "Créez votre première campagne ci-dessus." : "Vous n'avez encore aucune campagne assignée."}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(campaign => {
            const today = new Date().toISOString().slice(0, 10);
            const statusKey = campaign.date_debut <= today && campaign.date_fin >= today
              ? "active"
              : campaign.date_fin < today ? "terminee" : "planifiee";
            const cfg = STATUS_CFG[statusKey] ?? DEFAULT_STATUS_CFG;

            const p1 = campaign.couleur_primaire  || "#006776";
            const p2 = campaign.couleur_secondaire || "#00899b";

            return (
              <div key={campaign.id} className="group relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden border border-slate-100">
                {/* Brand color strip */}
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(to right, ${p1}, ${p2})` }} />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-foreground leading-tight truncate">{campaign.nom}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        {campaign.logo_url
                          ? <img src={campaign.logo_url} alt="" className="w-4 h-4 object-contain rounded shrink-0" />
                          : <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: p1 }} />}
                        <span className="truncate">{campaign.entreprise_nom}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: p1 }} />
                    <span>{new Date(campaign.date_debut).toLocaleDateString("fr-FR")} → {new Date(campaign.date_fin).toLocaleDateString("fr-FR")}</span>
                  </div>

                  {/* Type badges - cohérent avec [id]/page.tsx */}
                  <div className="flex flex-wrap gap-1.5">
                    {getShowTasting(campaign.type_campagne) && !getShowVente(campaign.type_campagne) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200"
                        style={{ background: hex(TYPE_CAMPAGNE_COLORS.DEGUSTATION, 0.08), color: TYPE_CAMPAGNE_COLORS.DEGUSTATION, borderColor: hex(TYPE_CAMPAGNE_COLORS.DEGUSTATION, 0.2) }}>
                        <UtensilsCrossed className="w-3 h-3" />Dégustation
                      </span>
                    )}
                    {!getShowTasting(campaign.type_campagne) && getShowVente(campaign.type_campagne) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                        style={{ background: hex(TYPE_CAMPAGNE_COLORS.VENTE, 0.08), color: TYPE_CAMPAGNE_COLORS.VENTE, borderColor: hex(TYPE_CAMPAGNE_COLORS.VENTE, 0.2) }}>
                        <ShoppingCart className="w-3 h-3" />Vente
                      </span>
                    )}
                    {getShowTasting(campaign.type_campagne) && getShowVente(campaign.type_campagne) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200"
                        style={{ background: hex(TYPE_CAMPAGNE_COLORS.DEGUSTATION_VENTE, 0.08), color: TYPE_CAMPAGNE_COLORS.DEGUSTATION_VENTE, borderColor: hex(TYPE_CAMPAGNE_COLORS.DEGUSTATION_VENTE, 0.2) }}>
                        <Target className="w-3 h-3" />Dég. + Vente
                      </span>
                    )}
                    {getShowWheel(campaign.type_recompense) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                        style={{ background: hex(TYPE_RECOMPENSE_COLORS.GOODIES, 0.08), color: TYPE_RECOMPENSE_COLORS.GOODIES, borderColor: hex(TYPE_RECOMPENSE_COLORS.GOODIES, 0.2) }}>
                        <Gift className="w-3 h-3" />Goodies 🎡
                      </span>
                    )}
                    {getShowPromos(campaign.type_recompense) && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                        style={{ background: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.08), color: TYPE_RECOMPENSE_COLORS.PROMOTIONS, borderColor: hex(TYPE_RECOMPENSE_COLORS.PROMOTIONS, 0.2) }}>
                        <Tag className="w-3 h-3" />Promotions
                      </span>
                    )}
                  </div>

                  {/* Mini KPI chips — tinted with brand colors */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Sites",        value: campaign.nb_sites        },
                      { label: "Superviseurs", value: campaign.nb_superviseurs },
                      { label: "Hôtesses",     value: campaign.nb_hotesses     },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-2 text-center" style={{ background: `${p1}18`, color: p1 }}>
                        <div className="text-base font-bold">{s.value}</div>
                        <div className="text-xs opacity-70">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button size="sm" variant="outline" asChild
                      style={{ borderColor: `${p1}60`, color: p1 }}
                      className="hover:opacity-80">
                      <Link href={`/dashboard/campaigns/${campaign.id}`}>
                        <Eye className="w-3.5 h-3.5 mr-1.5" />Voir détails
                      </Link>
                    </Button>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/campaigns/${campaign.id}`}>
                              <Users className="w-4 h-4 mr-2" />Gérer l&apos;équipe
                            </Link>
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(campaign.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}