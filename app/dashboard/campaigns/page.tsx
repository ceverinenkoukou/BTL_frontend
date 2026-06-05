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

const STATUS_CFG: Record<string, { label: string; badge: string; strip: string }> = {
  brouillon:  { label: "Brouillon",  badge: "bg-slate-100 text-slate-600 border border-slate-200",       strip: "from-slate-400 to-slate-300" },
  planifiee:  { label: "Planifiée",  badge: "bg-blue-100 text-blue-700 border border-blue-200",          strip: "from-blue-500 to-cyan-400" },
  active:     { label: "Active",     badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", strip: "from-emerald-500 to-teal-400" },
  terminee:   { label: "Terminée",   badge: "bg-violet-100 text-violet-700 border border-violet-200",   strip: "from-violet-500 to-purple-400" },
  annulee:    { label: "Annulée",    badge: "bg-red-100 text-red-700 border border-red-200",             strip: "from-red-500 to-rose-400" },
};

const DEFAULT_STATUS_CFG = { label: "—", badge: "bg-slate-100 text-slate-500 border border-slate-200", strip: "from-slate-300 to-slate-200" };

type SiteEntry = { nom: string; ville: string; emplacement_precis: string; superviseurs_ids: string[]; hotesses_ids: string[] };
const EMPTY_SITE: SiteEntry = { nom: "", ville: "Libreville", emplacement_precis: "", superviseurs_ids: [], hotesses_ids: [] };
const EMPTY_FORM = { nom: "", description: "", entreprise: "", date_debut: "", date_fin: "", type_campagne: "DEGUSTATION_VENTE" as TypeCampagne, type_recompense: "AUCUNE" as TypeRecompense, objectif_degustations: "", objectif_ventes: "", sites: [{ ...EMPTY_SITE }] as SiteEntry[] };

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

      setCampaigns(prev => [created, ...prev]);
      invalidateCache("/campagnes");
      invalidateCache("/sites");
      toast.success(`Campagne créée${validSites.length ? ` avec ${validSites.length} site(s)` : ""}.`);
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
        <div className="space-y-4">
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
          {/* Type de campagne */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type de campagne *</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "DEGUSTATION",       label: "Dégustation",        icon: <UtensilsCrossed className="w-4 h-4" />, color: "#006776" },
                { v: "VENTE",             label: "Vente",              icon: <ShoppingCart    className="w-4 h-4" />, color: "#10b981" },
                { v: "DEGUSTATION_VENTE", label: "Dég. + Vente",       icon: <Target          className="w-4 h-4" />, color: "#7c3aed" },
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

          {/* Type de récompense */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récompenses</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "AUCUNE",     label: "Aucune",     icon: <X    className="w-4 h-4" />, color: "#94a3b8" },
                { v: "GOODIES",    label: "Goodies 🎡", icon: <Gift className="w-4 h-4" />, color: "#f59e0b" },
                { v: "PROMOTIONS", label: "Promotions", icon: <Tag  className="w-4 h-4" />, color: "#3b82f6" },
              ] as { v: TypeRecompense; label: string; icon: React.ReactNode; color: string }[]).map(o => (
                <button key={o.v} type="button"
                  onClick={() => setForm(f => ({ ...f, type_recompense: o.v }))}
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

          {/* Objectifs (conditionnels selon type) */}
          {form.type_campagne !== "VENTE" && form.type_campagne !== "DEGUSTATION" && (
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
          <div className="flex justify-end pt-2">
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
              <DialogContent className="max-w-2xl">
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
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Campagnes</h1>
            <p className="text-muted-foreground mt-1">Vos campagnes marketing terrain</p>
          </div>
        </div>
      )}

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

                  {/* Type badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {campaign.type_campagne === "DEGUSTATION" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        <UtensilsCrossed className="w-3 h-3" />Dégustation
                      </span>
                    )}
                    {campaign.type_campagne === "VENTE" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShoppingCart className="w-3 h-3" />Vente
                      </span>
                    )}
                    {campaign.type_campagne === "DEGUSTATION_VENTE" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                        <Target className="w-3 h-3" />Dég. + Vente
                      </span>
                    )}
                    {campaign.type_recompense === "GOODIES" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Gift className="w-3 h-3" />Goodies 🎡
                      </span>
                    )}
                    {campaign.type_recompense === "PROMOTIONS" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
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
