"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { getCampagnesServices, getCampagneService } from "@/lib/services/campagneServiceService";
import { getSites } from "@/lib/services/siteService";
import { getMonSiteService, createSondage, enregistrerGainRecompenseService, getSondages } from "@/lib/services/sondageService";
import type {
  CampagneServiceList, SiteList, MonSiteServiceInfo, TrancheAge, Genre, Sondage,
} from "@/lib/types/backend";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Headset, Loader2, CheckCircle2, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const AGE_OPTIONS: { value: TrancheAge; label: string }[] = [
  { value: "MOINS_18", label: "Moins de 18 ans" },
  { value: "18_25", label: "18 – 25 ans" },
  { value: "26_35", label: "26 – 35 ans" },
  { value: "36_50", label: "36 – 50 ans" },
  { value: "PLUS_50", label: "Plus de 50 ans" },
];
const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "HOMME", label: "Homme" },
  { value: "FEMME", label: "Femme" },
];

const EMPTY_FORM = {
  service: "",
  nom_client: "",
  tranche_age: "" as TrancheAge | "",
  genre: "" as Genre | "",
  possede_deja: false,
  a_souscrit: false,
  recompense: "",
};

export default function SondagesPage() {
  const { user } = useAuth();
  const [campagnesServices, setCampagnesServices] = useState<CampagneServiceList[]>([]);
  const [allSites, setAllSites] = useState<SiteList[]>([]);
  const [campagneServiceId, setCampagneServiceId] = useState("");
  const [campagneSiteIds, setCampagneSiteIds] = useState<string[]>([]);
  const [siteId, setSiteId] = useState("");
  const [hotesseId, setHotesseId] = useState("");
  const [siteInfo, setSiteInfo] = useState<MonSiteServiceInfo | null>(null);
  const [recent, setRecent] = useState<Sondage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSite, setLoadingSite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const isHostess = user?.role === "Hotesse";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [camps, sitesRes, sondagesRes] = await Promise.all([
          getCampagnesServices(),
          getSites(),
          getSondages(),
        ]);
        setCampagnesServices(camps.filter(c => c.is_active));
        setAllSites(Array.isArray(sitesRes) ? sitesRes : sitesRes.results ?? []);
        setRecent(sondagesRes.slice(0, 10));
      } catch {
        toast.error("Erreur lors du chargement des campagnes service.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCampagneChange = async (id: string) => {
    setCampagneServiceId(id);
    setSiteId("");
    setSiteInfo(null);
    setHotesseId("");
    if (!id) { setCampagneSiteIds([]); return; }
    try {
      const detail = await getCampagneService(id);
      setCampagneSiteIds(detail.sites);
    } catch {
      toast.error("Impossible de charger les sites de cette campagne.");
    }
  };

  const handleSiteChange = async (id: string) => {
    setSiteId(id);
    setSiteInfo(null);
    setHotesseId("");
    setForm({ ...EMPTY_FORM });
    if (!id || !campagneServiceId) return;
    setLoadingSite(true);
    try {
      const data = await getMonSiteService(id, campagneServiceId);
      setSiteInfo(data);
      if (data.auto_select_service && data.services.length === 1) {
        setForm(f => ({ ...f, service: data.services[0].id }));
      }
    } catch {
      toast.error("Impossible de charger les informations du site.");
    } finally {
      setLoadingSite(false);
    }
  };

  const sitesDisponibles = allSites.filter(s => campagneSiteIds.includes(s.id));
  const canSubmit = Boolean(siteId && form.service && (isHostess || hotesseId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Veuillez sélectionner une campagne, un site, un service" + (isHostess ? "" : " et une hôtesse") + ".");
      return;
    }
    setSaving(true);
    try {
      const created = await createSondage({
        campagne_service: campagneServiceId,
        site: siteId,
        service: form.service,
        nom_client: form.nom_client.trim() || undefined,
        tranche_age: form.tranche_age || undefined,
        genre: form.genre || undefined,
        possede_deja: form.possede_deja,
        a_souscrit: form.a_souscrit,
        hotesse_id: isHostess ? undefined : hotesseId,
      });

      if (form.a_souscrit && form.recompense) {
        try {
          await enregistrerGainRecompenseService({
            recompense_id: form.recompense,
            site_id: siteId,
            sondage_id: created.id,
            nom_client: form.nom_client.trim() || undefined,
            hotesse_id: isHostess ? undefined : hotesseId,
          });
          toast.success("Sondage enregistré et récompense remise !");
        } catch {
          toast.warning("Sondage enregistré, mais erreur lors de la remise de la récompense.");
        }
      } else {
        toast.success("Sondage enregistré !");
      }

      setRecent(prev => [created, ...prev]);
      setForm({ ...EMPTY_FORM });
      handleSiteChange(siteId); // rafraîchit le stock de récompenses
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (campagnesServices.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sondages" description="Saisie terrain pour les campagnes service" icon={<Headset className="w-5 h-5" />} />
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center text-muted-foreground">
          Aucune campagne service active ne vous est assignée.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sondages" description="Saisie terrain pour les campagnes service" icon={<Headset className="w-5 h-5" />} />

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campagne service *</Label>
              <Select value={campagneServiceId} onValueChange={handleCampagneChange}>
                <SelectTrigger><SelectValue placeholder="Choisir une campagne" /></SelectTrigger>
                <SelectContent>
                  {campagnesServices.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={siteId} onValueChange={handleSiteChange} disabled={!campagneServiceId}>
                <SelectTrigger><SelectValue placeholder="Choisir un site" /></SelectTrigger>
                <SelectContent>
                  {sitesDisponibles.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isHostess && (
            <div className="space-y-2">
              <Label>Hôtesse *</Label>
              <Select value={hotesseId} onValueChange={setHotesseId} disabled={!siteInfo}>
                <SelectTrigger>
                  {loadingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Choisir une hôtesse" />}
                </SelectTrigger>
                <SelectContent>
                  {(siteInfo?.hotesses_disponibles ?? []).map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {siteInfo && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Service concerné *</Label>
                  <Select value={form.service} onValueChange={v => setForm(f => ({ ...f, service: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {siteInfo.services.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nom du client</Label>
                  <Input value={form.nom_client} onChange={e => setForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Optionnel" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tranche d&apos;âge</Label>
                  <Select value={form.tranche_age} onValueChange={v => setForm(f => ({ ...f, tranche_age: v as TrancheAge }))}>
                    <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                    <SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={form.genre} onValueChange={v => setForm(f => ({ ...f, genre: v as Genre }))}>
                    <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                    <SelectContent>{GENRE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Le client possède-t-il déjà le service ?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setForm(f => ({ ...f, possede_deja: true, a_souscrit: false }))}
                    className={cn("py-3 rounded-xl border-2 font-medium transition-all",
                      form.possede_deja ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:border-emerald-300")}>
                    Oui, déjà
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, possede_deja: false }))}
                    className={cn("py-3 rounded-xl border-2 font-medium transition-all",
                      !form.possede_deja ? "border-slate-400 bg-slate-50" : "border-border hover:border-slate-300")}>
                    Non
                  </button>
                </div>
              </div>

              {!form.possede_deja && (
                <div className="space-y-2">
                  <Label>A-t-il souscrit suite à l&apos;échange ?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setForm(f => ({ ...f, a_souscrit: false }))}
                      className={cn("py-3 rounded-xl border-2 font-medium transition-all",
                        !form.a_souscrit ? "border-slate-400 bg-slate-50" : "border-border hover:border-slate-300")}>
                      Non
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, a_souscrit: true }))}
                      className={cn("py-3 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2",
                        form.a_souscrit ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:border-emerald-400")}>
                      <CheckCircle2 className="w-4 h-4" />Oui, souscrit !
                    </button>
                  </div>
                </div>
              )}

              {form.a_souscrit && siteInfo.recompenses_disponibles.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" />Récompense à remettre</Label>
                  <Select value={form.recompense} onValueChange={v => setForm(f => ({ ...f, recompense: v }))}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      {siteInfo.recompenses_disponibles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.nom} ({r.quantite_restante} restant{r.quantite_restante > 1 ? "s" : ""})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full h-12" disabled={saving || !canSubmit}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enregistrer le sondage"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold mb-3">Derniers sondages saisis</p>
            <div className="space-y-2">
              {recent.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                  <span className="truncate">{s.service_nom} — {s.site_nom}</span>
                  <span className={s.a_souscrit ? "text-emerald-600 font-medium" : s.possede_deja ? "text-slate-500" : "text-amber-600"}>
                    {s.a_souscrit ? "Souscrit" : s.possede_deja ? "Avait déjà" : "Refus"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
