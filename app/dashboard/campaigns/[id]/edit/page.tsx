"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { invalidateCache } from "@/lib/api";
import type { CampagneDetail, TypeCampagne, TypeRecompense } from "@/lib/types/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, UtensilsCrossed, ShoppingCart, Target, X, Gift, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

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
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<CampagneDetail>(`/campagnes/${id}/`);
        setCampaign(data);
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
        });
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
    </div>
  );
}
