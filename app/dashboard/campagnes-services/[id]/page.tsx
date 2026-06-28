"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  getCampagneService, createServicePromu, deleteServicePromu,
  getRecompensesService, createRecompenseService, deleteRecompenseService,
  getObjectifsCampagneService, createObjectifCampagneService, deleteObjectifCampagneService,
} from "@/lib/services/campagneServiceService";
import { getSondages } from "@/lib/services/sondageService";
import type {
  CampagneServiceDetail, ServicePromu, RecompenseService, ObjectifCampagneService, Sondage,
} from "@/lib/types/backend";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headset, Plus, Trash2, Loader2 } from "lucide-react";

export default function CampagneServiceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [campagne, setCampagne] = useState<CampagneServiceDetail | null>(null);
  const [recompenses, setRecompenses] = useState<RecompenseService[]>([]);
  const [objectifs, setObjectifs] = useState<ObjectifCampagneService[]>([]);
  const [sondages, setSondages] = useState<Sondage[]>([]);
  const [loading, setLoading] = useState(true);

  const [newService, setNewService] = useState("");
  const [newRecompense, setNewRecompense] = useState({ nom: "", quantite_totale: "" });
  const [newObjectif, setNewObjectif] = useState({ nom: "", valeur_cible: "" });
  const [savingService, setSavingService] = useState(false);
  const [savingRecompense, setSavingRecompense] = useState(false);
  const [savingObjectif, setSavingObjectif] = useState(false);

  // Services réellement disponibles pour cette campagne : ceux de
  // l'entreprise (rattachement Service -> Entreprise, comme Produit).
  const services: ServicePromu[] = campagne?.services ?? [];

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const camp = await getCampagneService(id);
      const [rec, obj, sond] = await Promise.all([
        getRecompensesService(id),
        getObjectifsCampagneService(id),
        getSondages(),
      ]);
      setCampagne(camp);
      setRecompenses(rec);
      setObjectifs(obj);
      setSondages(sond.filter(s => s.campagne_service === id));
    } catch {
      toast.error("Erreur lors du chargement de la campagne service.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.trim() || !campagne) return;
    setSavingService(true);
    try {
      await createServicePromu({ entreprise: campagne.entreprise, nom: newService.trim() });
      setNewService("");
      fetchAll();
    } catch {
      toast.error("Erreur lors de l'ajout du service.");
    } finally {
      setSavingService(false);
    }
  };

  const handleAddRecompense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecompense.nom.trim() || !newRecompense.quantite_totale) return;
    setSavingRecompense(true);
    try {
      await createRecompenseService({
        campagne_service: id,
        nom: newRecompense.nom.trim(),
        quantite_totale: parseInt(newRecompense.quantite_totale, 10) || 0,
      });
      setNewRecompense({ nom: "", quantite_totale: "" });
      fetchAll();
    } catch {
      toast.error("Erreur lors de l'ajout de la récompense.");
    } finally {
      setSavingRecompense(false);
    }
  };

  const handleAddObjectif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObjectif.nom.trim() || !newObjectif.valeur_cible) return;
    setSavingObjectif(true);
    try {
      await createObjectifCampagneService({
        campagne_service: id,
        nom: newObjectif.nom.trim(),
        valeur_cible: parseInt(newObjectif.valeur_cible, 10) || 0,
      });
      setNewObjectif({ nom: "", valeur_cible: "" });
      fetchAll();
    } catch {
      toast.error("Erreur lors de l'ajout de l'objectif.");
    } finally {
      setSavingObjectif(false);
    }
  };

  if (loading || !campagne) {
    return <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  const nbSouscriptions = sondages.filter(s => s.a_souscrit).length;
  const nbDejaPossede = sondages.filter(s => s.possede_deja).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={campagne.nom}
        description={`${campagne.entreprise_nom} — ${campagne.type_campagne_service_display}`}
        icon={<Headset className="w-5 h-5" />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sondages", value: sondages.length },
          { label: "Possédaient déjà", value: nbDejaPossede },
          { label: "Souscriptions", value: nbSouscriptions },
          { label: "Récompenses remises", value: recompenses.reduce((s, r) => s + r.quantite_distribuee, 0) },
        ].map((kpi, i) => (
          <Card key={i}><CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services de l&apos;entreprise</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Réutilisables sur toutes les campagnes de cette entreprise.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                <span>{s.nom}</span>
                <button onClick={() => deleteServicePromu(s.id).then(fetchAll)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {services.length === 0 && <p className="text-xs text-muted-foreground">Aucun service ajouté.</p>}
            <form onSubmit={handleAddService} className="flex gap-2 pt-2">
              <Input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Ex: Application MyTelecom" className="h-9" />
              <Button type="submit" size="sm" disabled={savingService}><Plus className="w-4 h-4" /></Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Récompenses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recompenses.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                <span>{r.nom}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.quantite_restante}/{r.quantite_totale}</span>
                  <button onClick={() => deleteRecompenseService(r.id).then(fetchAll)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {recompenses.length === 0 && <p className="text-xs text-muted-foreground">Aucune récompense ajoutée.</p>}
            <form onSubmit={handleAddRecompense} className="flex gap-2 pt-2">
              <Input value={newRecompense.nom} onChange={e => setNewRecompense(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Forfait 5Go" className="h-9" />
              <Input type="number" min="0" value={newRecompense.quantite_totale} onChange={e => setNewRecompense(f => ({ ...f, quantite_totale: e.target.value }))} placeholder="Stock" className="h-9 w-24" />
              <Button type="submit" size="sm" disabled={savingRecompense}><Plus className="w-4 h-4" /></Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Objectifs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {objectifs.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                <span>{o.nom}{o.site_nom ? ` (${o.site_nom})` : ""}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{o.valeur_cible}</span>
                  <button onClick={() => deleteObjectifCampagneService(o.id).then(fetchAll)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {objectifs.length === 0 && <p className="text-xs text-muted-foreground">Aucun objectif défini.</p>}
            <form onSubmit={handleAddObjectif} className="flex gap-2 pt-2">
              <Input value={newObjectif.nom} onChange={e => setNewObjectif(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Souscriptions" className="h-9" />
              <Input type="number" min="0" value={newObjectif.valeur_cible} onChange={e => setNewObjectif(f => ({ ...f, valeur_cible: e.target.value }))} placeholder="Cible" className="h-9 w-24" />
              <Button type="submit" size="sm" disabled={savingObjectif}><Plus className="w-4 h-4" /></Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sondages récents</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {sondages.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                <span className="truncate">{s.hotesse_nom} — {s.site_nom}</span>
                <span className={s.a_souscrit ? "text-emerald-600 font-medium" : s.possede_deja ? "text-slate-500" : "text-amber-600"}>
                  {s.a_souscrit ? "Souscrit" : s.possede_deja ? "Avait déjà" : "Refus"}
                </span>
              </div>
            ))}
            {sondages.length === 0 && <p className="text-xs text-muted-foreground">Aucun sondage saisi.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
