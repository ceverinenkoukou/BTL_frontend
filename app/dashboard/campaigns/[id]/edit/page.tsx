"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { invalidateCache } from "@/lib/api";
import type { CampagneDetail, TypeCampagne, TypeRecompense, JourAnimation, SiteList } from "@/lib/types/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, UtensilsCrossed, ShoppingCart, Target, X, Gift, Tag, Clock, Trash2, Plus, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const TYPE_CAMPAGNE_COLORS: Record<TypeCampagne, string> = {
  DEGUSTATION:       "#0d9488",
  VENTE:             "#059669",
  DEGUSTATION_VENTE: "#7c3aed",
};
const TYPE_RECOMPENSE_COLORS: Record<TypeRecompense, string> = {
  AUCUNE:     "#64748b",
  GOODIES:    "#f97316",
  PROMOTIONS: "#3b82f6",
};

const getShowTasting = (t: TypeCampagne) => t !== "VENTE";

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [campaign, setCampaign] = useState<CampagneDetail | null>(null);

  // Planning
  const [joursAnimation, setJoursAnimation] = useState<JourAnimation[]>([]);
  const [campaignSites, setCampaignSites] = useState<SiteList[]>([]);
  const [planForm, setPlanForm] = useState({ date: "", heure_ouverture: "08:00", heure_fermeture: "18:00", site: "" });
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const fetchPlanning = async () => {
    try {
      const res = await api.get<JourAnimation[]>(`/jours-animation/?campagne=${id}`);
      setJoursAnimation(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  };

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
      setPlanError(d?.date?.[0] || d?.heure_fermeture?.[0] || d?.non_field_errors?.[0] || d?.detail || "Erreur lors de l'ajout.");
    } finally { setSavingPlan(false); }
  };

  const handleDeleteJour = async (jourId: string) => {
    try {
      await api.delete(`/jours-animation/${jourId}/`);
      fetchPlanning();
    } catch { toast.error("Impossible de supprimer ce jour."); }
  };

  const [form, setForm] = useState({
    nom:                    "",
    description:            "",
    date_debut:             "",
    date_fin:               "",
    type_campagne:          "DEGUSTATION_VENTE" as TypeCampagne,
    type_recompense:        "AUCUNE" as TypeRecompense,
    note_gout_active:       false,
    note_gout_max:          5 as 5 | 10,
    note_ambiance_active:   false,
    note_ambiance_max:      5 as 5 | 10,
    objectif_degustations:  "",
    objectif_ventes:        "",
    objectif_gratuites:     "",
    objectif_goodies:       "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [campRes, sitesRes] = await Promise.all([
          api.get<CampagneDetail>(`/campagnes/${id}/`),
          api.get<SiteList[]>(`/sites/?campagne=${id}`).catch(() => ({ data: [] })),
        ]);
        const data = campRes.data;
        const sData = Array.isArray(sitesRes.data) ? sitesRes.data : [];
        setCampaign(data);
        setCampaignSites(sData.filter((s: SiteList) => s.campagne === id));
        setForm({
          nom:                   data.nom,
          description:           data.description ?? "",
          date_debut:            data.date_debut,
          date_fin:              data.date_fin,
          type_campagne:         data.type_campagne,
          type_recompense:       data.type_recompense,
          note_gout_active:      data.note_gout_active,
          note_gout_max:         data.note_gout_max,
          note_ambiance_active:  data.note_ambiance_active,
          note_ambiance_max:     data.note_ambiance_max,
          objectif_degustations: data.objectif_degustations?.toString() ?? "",
          objectif_ventes:       data.objectif_ventes?.toString() ?? "",
          objectif_gratuites:    data.objectif_gratuites?.toString() ?? "",
          objectif_goodies:      data.objectif_goodies?.toString() ?? "",
        });
        fetchPlanning();
      } catch {
        toast.error("Impossible de charger la campagne.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.date_debut || !form.date_fin) {
      toast.error("Nom, date de début et date de fin sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/campagnes/${id}/`, {
        nom:                   form.nom.trim(),
        description:           form.description.trim() || null,
        date_debut:            form.date_debut,
        date_fin:              form.date_fin,
        type_campagne:         form.type_campagne,
        type_recompense:       form.type_recompense,
        note_gout_active:      form.note_gout_active,
        note_gout_max:         form.note_gout_active ? form.note_gout_max : 5,
        note_ambiance_active:  form.note_ambiance_active,
        note_ambiance_max:     form.note_ambiance_active ? form.note_ambiance_max : 5,
        objectif_degustations: (getShowTasting(form.type_campagne) && form.objectif_degustations)
          ? parseInt(form.objectif_degustations) : null,
        objectif_ventes:       (form.type_campagne !== "DEGUSTATION" && form.objectif_ventes)
          ? parseInt(form.objectif_ventes) : null,
        objectif_gratuites:    form.objectif_gratuites ? parseInt(form.objectif_gratuites) : null,
        objectif_goodies:      (form.type_recompense === "GOODIES" && form.objectif_goodies)
          ? parseInt(form.objectif_goodies) : null,
      });
      invalidateCache("/campagnes");
      invalidateCache("/degustations/mon-site");
      toast.success("Campagne mise à jour !");
      router.push(`/dashboard/campaigns/${id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Campagne introuvable.</p>
        <Link href="/dashboard/campaigns" className="text-indigo-600 underline mt-2 inline-block">Retour aux campagnes</Link>
      </div>
    );
  }

  const showTasting = getShowTasting(form.type_campagne);
  const showVente   = form.type_campagne !== "DEGUSTATION";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">

      {/* Header */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link href="/dashboard/campaigns">Campagnes</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link href={`/dashboard/campaigns/${id}`}>{campaign.nom}</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Modifier</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/campaigns/${id}`}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Modifier la campagne</h1>
          <p className="text-sm text-muted-foreground">{campaign.nom}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Nom */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informations générales</p>
          <div className="space-y-1.5">
            <Label>Nom de la campagne *</Label>
            <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Campagne été 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description de la campagne…" rows={3} className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date de début *</Label>
              <Input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin *</Label>
              <Input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Type campagne */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type de campagne</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "DEGUSTATION",       label: "Dégustation",   icon: <UtensilsCrossed className="w-4 h-4" /> },
              { v: "VENTE",             label: "Vente",         icon: <ShoppingCart    className="w-4 h-4" /> },
              { v: "DEGUSTATION_VENTE", label: "Dég. + Vente",  icon: <Target          className="w-4 h-4" /> },
            ] as { v: TypeCampagne; label: string; icon: React.ReactNode }[]).map(o => (
              <button key={o.v} type="button"
                onClick={() => setForm(f => ({ ...f, type_campagne: o.v }))}
                className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium",
                  form.type_campagne === o.v
                    ? "border-current bg-current/5"
                    : "border-slate-200 hover:border-slate-300 text-slate-500")}
                style={form.type_campagne === o.v ? { color: TYPE_CAMPAGNE_COLORS[o.v], borderColor: TYPE_CAMPAGNE_COLORS[o.v] } : {}}>
                {o.icon}
                <span className="text-xs leading-tight text-center">{o.label}</span>
              </button>
            ))}
          </div>

          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récompenses</Label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "AUCUNE",     label: "Aucune",     icon: <X    className="w-4 h-4" /> },
              { v: "GOODIES",    label: "Goodies 🎡", icon: <Gift className="w-4 h-4" /> },
              { v: "PROMOTIONS", label: "Promotions", icon: <Tag  className="w-4 h-4" /> },
            ] as { v: TypeRecompense; label: string; icon: React.ReactNode }[]).map(o => (
              <button key={o.v} type="button"
                onClick={() => setForm(f => ({ ...f, type_recompense: o.v }))}
                className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium",
                  form.type_recompense === o.v
                    ? "border-current bg-current/5"
                    : "border-slate-200 hover:border-slate-300 text-slate-500")}
                style={form.type_recompense === o.v ? { color: TYPE_RECOMPENSE_COLORS[o.v], borderColor: TYPE_RECOMPENSE_COLORS[o.v] } : {}}>
                {o.icon}
                <span className="text-xs leading-tight text-center">{o.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Note du goût */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note du goût</p>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setForm(f => ({ ...f, note_gout_active: !f.note_gout_active }))}>
              <span className="text-sm text-foreground">Activer la saisie de la note du goût</span>
              <div
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  form.note_gout_active ? "bg-indigo-500" : "bg-slate-300")}>
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  form.note_gout_active ? "translate-x-6" : "translate-x-1")} />
              </div>
            </div>
            {form.note_gout_active && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Échelle de notation</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([5, 10] as const).map(v => (
                    <button key={v} type="button"
                      onClick={() => setForm(f => ({ ...f, note_gout_max: v }))}
                      className={cn("py-3 rounded-xl border-2 text-sm font-medium transition-all",
                        form.note_gout_max === v
                          ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 hover:border-indigo-300 text-slate-500")}>
                      1 à {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t border-slate-200 pt-1" />
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setForm(f => ({ ...f, note_ambiance_active: !f.note_ambiance_active }))}>
              <span className="text-sm text-foreground">Activer la saisie de la note d&apos;ambiance</span>
              <div
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  form.note_ambiance_active ? "bg-violet-500" : "bg-slate-300")}>
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  form.note_ambiance_active ? "translate-x-6" : "translate-x-1")} />
              </div>
            </div>
            {form.note_ambiance_active && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Échelle de notation</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([5, 10] as const).map(v => (
                    <button key={v} type="button"
                      onClick={() => setForm(f => ({ ...f, note_ambiance_max: v }))}
                      className={cn("py-3 rounded-xl border-2 text-sm font-medium transition-all",
                        form.note_ambiance_max === v
                          ? "border-violet-500 bg-violet-50 text-violet-600"
                          : "border-slate-200 hover:border-violet-300 text-slate-500")}>
                      1 à {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Objectifs */}
        {(showTasting || showVente) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objectifs</p>
            <div className="grid grid-cols-2 gap-4">
              {showTasting && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dégustations (quantité)</Label>
                  <Input type="number" min="0" value={form.objectif_degustations}
                    onChange={e => setForm(f => ({ ...f, objectif_degustations: e.target.value }))}
                    placeholder="Ex: 500" />
                </div>
              )}
              {showVente && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ventes (quantité)</Label>
                  <Input type="number" min="0" value={form.objectif_ventes}
                    onChange={e => setForm(f => ({ ...f, objectif_ventes: e.target.value }))}
                    placeholder="Ex: 100" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Boissons gratuites (quantité)</Label>
                <Input type="number" min="0" value={form.objectif_gratuites}
                  onChange={e => setForm(f => ({ ...f, objectif_gratuites: e.target.value }))}
                  placeholder="Ex: 200" />
              </div>
              {form.type_recompense === "GOODIES" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Goodies (quantité)</Label>
                  <Input type="number" min="0" value={form.objectif_goodies}
                    onChange={e => setForm(f => ({ ...f, objectif_goodies: e.target.value }))}
                    placeholder="Ex: 50" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Link href={`/dashboard/campaigns/${id}`} className="flex-1">
            <Button type="button" variant="outline" className="w-full rounded-xl h-11">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={saving} className="flex-1 rounded-xl h-11">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </form>

      {/* Planning — jours animés (hors formulaire, CRUD direct) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0"><Clock className="w-3.5 h-3.5 text-indigo-600" /></div>
          Planning — jours animés ({joursAnimation.length})
        </h3>

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
                <button onClick={() => handleDeleteJour(j.id)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-2">Aucun jour animé défini</p>
        )}

        <div className="pt-3 border-t border-slate-100 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ajouter un jour</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input type="date" value={planForm.date}
                min={campaign?.date_debut} max={campaign?.date_fin}
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
      </div>
    </div>
  );
}
