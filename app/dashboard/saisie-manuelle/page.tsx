"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type {
  SiteList, MonSiteInfo, TrancheAge, IntentionAchat, TypeConditionnement, Genre,
  CreateDegustationPayload, Degustation,
} from "@/lib/types/backend";
import { enregistrerGainPromotion } from "@/lib/services/promotionService";
import { enregistrerGainGoodie } from "@/lib/services/goodie-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClipboardEdit, UtensilsCrossed, Gift, Ticket, Loader2, CheckCircle2 } from "lucide-react";
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

const INTENT_OPTIONS: { value: IntentionAchat; label: string; color: string }[] = [
  { value: "FAIBLE", label: "Faible", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "MOYENNE", label: "Moyenne", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "ELEVEE", label: "Élevée", color: "bg-green-100 text-green-700 border-green-200" },
];

const EMPTY_DEG_FORM = {
  produit: "",
  tranche_age: "" as TrancheAge | "",
  genre: "" as Genre | "",
  note_gout: 0,
  note_ambiance: 0,
  intention_achat: "" as IntentionAchat | "",
  a_achete: false,
  conditionnement: "UNITE" as TypeConditionnement,
  quantite: 1,
  nom_client: "",
  promotion_selectionnee: "",
};

const EMPTY_GOODIE_FORM = { goodie: "", quantite_produit: 1, nom_client: "" };

const EMPTY_PROMO_FORM = { promotion: "", produit: "", nom_client: "", tranche_age: "" as TrancheAge | "" };

function errMsg(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback;
}

function SaisieManuelleContent() {
  const { user } = useAuth();
  const [sites, setSites] = useState<SiteList[]>([]);
  const [siteId, setSiteId] = useState("");
  const [siteInfo, setSiteInfo] = useState<MonSiteInfo | null>(null);
  const [hotesseId, setHotesseId] = useState("");
  const [loadingSite, setLoadingSite] = useState(false);

  const [degForm, setDegForm] = useState({ ...EMPTY_DEG_FORM });
  const [savingDeg, setSavingDeg] = useState(false);

  const [goodieForm, setGoodieForm] = useState({ ...EMPTY_GOODIE_FORM });
  const [savingGoodie, setSavingGoodie] = useState(false);

  const [promoForm, setPromoForm] = useState({ ...EMPTY_PROMO_FORM });
  const [savingPromo, setSavingPromo] = useState(false);

  useEffect(() => {
    api.get<SiteList[]>("/sites/").then(({ data }) => {
      setSites(Array.isArray(data) ? data : ((data as { results?: SiteList[] }).results ?? []));
    }).catch(() => toast.error("Impossible de charger les sites."));
  }, []);

  const loadSiteInfo = async (id: string) => {
    setLoadingSite(true);
    try {
      const { data } = await api.get<MonSiteInfo>(`/degustations/mon-site/?site_id=${id}`);
      setSiteInfo(data);
      return data;
    } catch {
      toast.error("Impossible de charger les informations du site.");
      setSiteInfo(null);
      return null;
    } finally {
      setLoadingSite(false);
    }
  };

  const handleSiteChange = async (id: string) => {
    setSiteId(id);
    setHotesseId("");
    setSiteInfo(null);
    setDegForm({ ...EMPTY_DEG_FORM });
    setGoodieForm({ ...EMPTY_GOODIE_FORM });
    setPromoForm({ ...EMPTY_PROMO_FORM });
    if (!id) return;
    const data = await loadSiteInfo(id);
    if (data?.auto_select_produit && data.produits.length === 1) {
      setDegForm(f => ({ ...f, produit: data.produits[0].id }));
    }
  };

  const canSubmit = Boolean(siteId && hotesseId);

  const submitDegustation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) { toast.error("Sélectionnez un site et une hôtesse."); return; }
    const needsNote = siteInfo?.note_gout_active;
    const needsAmbiance = siteInfo?.note_ambiance_active;
    if (!degForm.produit || !degForm.tranche_age || !degForm.genre || !degForm.intention_achat
      || (needsNote && !degForm.note_gout) || (needsAmbiance && !degForm.note_ambiance)) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSavingDeg(true);
    try {
      const hasPromotion = degForm.a_achete && Boolean(degForm.promotion_selectionnee);
      const payload: CreateDegustationPayload = {
        site: siteId,
        produit: degForm.produit,
        tranche_age: degForm.tranche_age as TrancheAge,
        genre: degForm.genre as Genre,
        ...(siteInfo?.note_gout_active ? { note_gout: degForm.note_gout || null } : {}),
        ...(siteInfo?.note_ambiance_active ? { note_ambiance: degForm.note_ambiance || null } : {}),
        intention_achat: degForm.intention_achat as IntentionAchat,
        a_achete: degForm.a_achete,
        nom_client: degForm.nom_client.trim() || undefined,
        promotion_appliquee: hasPromotion,
        hotesse_id: hotesseId,
        ...(degForm.a_achete && !hasPromotion && {
          conditionnement: degForm.conditionnement,
          quantite: degForm.quantite,
        }),
      };
      const { data: created } = await api.post<Degustation>("/degustations/", payload);

      if (degForm.a_achete && degForm.promotion_selectionnee) {
        try {
          const gainResult = await enregistrerGainPromotion(degForm.promotion_selectionnee, {
            site_id: siteId,
            produit_id: degForm.produit,
            nom_client: degForm.nom_client.trim() || undefined,
            tranche_age: degForm.tranche_age || undefined,
            degustation_id: created.id,
            hotesse_id: hotesseId,
          });
          toast.success(`🎉 ${gainResult.recompense} enregistré !`);
        } catch (promoErr: unknown) {
          toast.warning(errMsg(promoErr, "Erreur lors de l'enregistrement de la promotion."));
        }
      }

      toast.success("Dégustation enregistrée pour le compte de l'hôtesse.");
      setDegForm({ ...EMPTY_DEG_FORM });
    } catch (err: unknown) {
      toast.error(errMsg(err, "Erreur lors de l'enregistrement."));
    } finally {
      setSavingDeg(false);
    }
  };

  const submitGoodie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) { toast.error("Sélectionnez un site et une hôtesse."); return; }
    if (!goodieForm.goodie) { toast.error("Choisissez un goodie."); return; }
    setSavingGoodie(true);
    try {
      const result = await enregistrerGainGoodie({
        goodie_id: goodieForm.goodie,
        site_id: siteId,
        nom_client: goodieForm.nom_client.trim() || undefined,
        quantite_produit: goodieForm.quantite_produit,
        hotesse_id: hotesseId,
      });
      toast.success(result.detail);
      setGoodieForm({ ...EMPTY_GOODIE_FORM });
      loadSiteInfo(siteId); // rafraîchit le stock restant
    } catch (err: unknown) {
      toast.error(errMsg(err, "Erreur lors de l'enregistrement du goodie."));
    } finally {
      setSavingGoodie(false);
    }
  };

  const submitPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) { toast.error("Sélectionnez un site et une hôtesse."); return; }
    if (!promoForm.promotion) { toast.error("Choisissez une offre."); return; }
    setSavingPromo(true);
    try {
      const result = await enregistrerGainPromotion(promoForm.promotion, {
        site_id: siteId,
        produit_id: promoForm.produit || undefined,
        nom_client: promoForm.nom_client.trim() || undefined,
        tranche_age: promoForm.tranche_age || undefined,
        hotesse_id: hotesseId,
      });
      toast.success(`🎉 ${result.recompense} enregistré !`);
      setPromoForm({ ...EMPTY_PROMO_FORM });
    } catch (err: unknown) {
      toast.error(errMsg(err, "Erreur lors de l'enregistrement de l'offre."));
    } finally {
      setSavingPromo(false);
    }
  };

  if (user && !["Administrateur", "Superviseur"].includes(user.role)) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Accès réservé aux administrateurs et superviseurs.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saisie manuelle"
        description="Enregistrer une dégustation, un goodie ou une offre promo pour le compte d'une hôtesse"
        icon={<ClipboardEdit className="w-5 h-5" />}
      />

      <Card>
        <CardContent className="p-5 space-y-1">
          <p className="text-sm text-muted-foreground mb-3">
            Choisissez le site puis l&apos;hôtesse pour le compte de qui la saisie est faite.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site *</Label>
              <Select value={siteId} onValueChange={handleSiteChange}>
                <SelectTrigger><SelectValue placeholder="Choisir un site" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hôtesse *</Label>
              <Select value={hotesseId} onValueChange={setHotesseId} disabled={!siteInfo}>
                <SelectTrigger>
                  {loadingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Choisir une hôtesse" />}
                </SelectTrigger>
                <SelectContent>
                  {(siteInfo?.hotesses_disponibles ?? []).map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {siteInfo && siteInfo.hotesses_disponibles.length === 0 && (
                <p className="text-xs text-amber-600">Aucune hôtesse assignée à ce site.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!canSubmit ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-muted-foreground">
          Sélectionnez un site puis une hôtesse pour commencer la saisie.
        </div>
      ) : (
        <>
          {/* ── Dégustation / vente ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4" />Dégustation / vente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitDegustation} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Produit *</Label>
                    <Select value={degForm.produit} onValueChange={v => setDegForm(f => ({ ...f, produit: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {(siteInfo?.produits ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du client</Label>
                    <Input value={degForm.nom_client} onChange={e => setDegForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Optionnel" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tranche d&apos;âge *</Label>
                    <Select value={degForm.tranche_age} onValueChange={v => setDegForm(f => ({ ...f, tranche_age: v as TrancheAge }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Genre *</Label>
                    <Select value={degForm.genre} onValueChange={v => setDegForm(f => ({ ...f, genre: v as Genre }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>{GENRE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {siteInfo?.note_gout_active && (
                    <div className="space-y-2">
                      <Label>Note du goût *</Label>
                      <Select value={degForm.note_gout ? String(degForm.note_gout) : ""} onValueChange={v => setDegForm(f => ({ ...f, note_gout: Number(v) }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: siteInfo.note_gout_max ?? 5 }, (_, i) => i + 1).map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {siteInfo?.note_ambiance_active && (
                    <div className="space-y-2">
                      <Label>Note d&apos;ambiance *</Label>
                      <Select value={degForm.note_ambiance ? String(degForm.note_ambiance) : ""} onValueChange={v => setDegForm(f => ({ ...f, note_ambiance: Number(v) }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: siteInfo.note_ambiance_max ?? 5 }, (_, i) => i + 1).map(n => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Intention d&apos;achat *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {INTENT_OPTIONS.map(o => (
                      <button key={o.value} type="button" onClick={() => setDegForm(f => ({ ...f, intention_achat: o.value }))}
                        className={cn("py-2.5 px-3 rounded-lg border-2 font-medium transition-all text-sm",
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
                      className={cn("py-3 rounded-xl border-2 font-medium transition-all",
                        !degForm.a_achete ? "border-slate-400 bg-slate-50" : "border-border hover:border-slate-300")}>
                      Non
                    </button>
                    <button type="button" onClick={() => setDegForm(f => ({ ...f, a_achete: true }))}
                      className={cn("py-3 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2",
                        degForm.a_achete ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:border-emerald-400")}>
                      <CheckCircle2 className="w-4 h-4" />Oui, acheté
                    </button>
                  </div>
                </div>

                {degForm.a_achete && (
                  <div className="space-y-3">
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
                        <Input type="number" min="1" value={degForm.quantite}
                          onChange={e => setDegForm(f => ({ ...f, quantite: Math.max(1, parseInt(e.target.value) || 1) }))} />
                      </div>
                    </div>

                    {siteInfo?.promotions && siteInfo.promotions.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-blue-600">Offre promotionnelle appliquée (optionnel)</Label>
                        <Select value={degForm.promotion_selectionnee} onValueChange={v => setDegForm(f => ({ ...f, promotion_selectionnee: v }))}>
                          <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                          <SelectContent>
                            {siteInfo.promotions.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.quantite_requise} acheté{p.quantite_requise > 1 ? "s" : ""} → {p.recompense_description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" disabled={savingDeg} className="w-full">
                  {savingDeg ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer la dégustation"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── Goodie gagné ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="w-4 h-4" />Goodie gagné
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitGoodie} className="space-y-4">
                <div className="space-y-2">
                  <Label>Goodie *</Label>
                  <Select value={goodieForm.goodie} onValueChange={v => setGoodieForm(f => ({ ...f, goodie: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir un goodie" /></SelectTrigger>
                    <SelectContent>
                      {(siteInfo?.goodies_disponibles ?? []).map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nom} ({g.quantite_restante} restant{g.quantite_restante > 1 ? "s" : ""})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantité produit associé</Label>
                    <Input type="number" min="1" value={goodieForm.quantite_produit}
                      onChange={e => setGoodieForm(f => ({ ...f, quantite_produit: Math.max(1, parseInt(e.target.value) || 1) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du client</Label>
                    <Input value={goodieForm.nom_client} onChange={e => setGoodieForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Optionnel" />
                  </div>
                </div>
                <Button type="submit" disabled={savingGoodie} className="w-full">
                  {savingGoodie ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer le goodie"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* ── Offre promo appliquée sans dégustation (achat groupé) ── */}
          {siteInfo?.promotions && siteInfo.promotions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Ticket className="w-4 h-4" />Offre promo appliquée (sans dégustation)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitPromo} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Offre *</Label>
                    <Select value={promoForm.promotion} onValueChange={v => setPromoForm(f => ({ ...f, promotion: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choisir une offre" /></SelectTrigger>
                      <SelectContent>
                        {siteInfo.promotions.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.quantite_requise} acheté{p.quantite_requise > 1 ? "s" : ""} → {p.recompense_description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Produit acheté</Label>
                      <Select value={promoForm.produit} onValueChange={v => setPromoForm(f => ({ ...f, produit: v }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {(siteInfo.produits ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nom du client</Label>
                      <Input value={promoForm.nom_client} onChange={e => setPromoForm(f => ({ ...f, nom_client: e.target.value }))} placeholder="Optionnel" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tranche d&apos;âge</Label>
                    <Select value={promoForm.tranche_age} onValueChange={v => setPromoForm(f => ({ ...f, tranche_age: v as TrancheAge }))}>
                      <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                      <SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={savingPromo} className="w-full">
                    {savingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer l'offre"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function SaisieManuellePage() {
  return (
    <Suspense fallback={null}>
      <SaisieManuelleContent />
    </Suspense>
  );
}
