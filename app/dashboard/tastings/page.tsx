"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type {
  Degustation, CreateDegustationPayload, SiteList, MonSiteInfo,
  TrancheAge, IntentionAchat, TypeConditionnement, TypePromotion,
} from "@/lib/types/backend";
import { enregistrerGainPromotion } from "@/lib/services/promotionService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, UtensilsCrossed, Loader2, CheckCircle2,
  Frown, Meh, Smile, Laugh, Heart,
  Download, Search, Calendar, UserRound, Package, TrendingUp, X, MapPin,
  Gift, Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AGE_OPTIONS: { value: TrancheAge; label: string }[] = [
  { value: "MOINS_18", label: "-18 ans" },
  { value: "18_25", label: "18-25 ans" },
  { value: "26_35", label: "26-35 ans" },
  { value: "36_50", label: "36-50 ans" },
  { value: "PLUS_50", label: "Plus de 50 ans" },
];

const INTENTION_OPTIONS: { value: IntentionAchat; label: string }[] = [
  { value: "CERTAINEMENT_PAS", label: "Certainement pas" },
  { value: "PROBABLEMENT_PAS", label: "Probablement pas" },
  { value: "NE_SAIT_PAS", label: "Ne sait pas" },
  { value: "PROBABLEMENT_OUI", label: "Probablement oui" },
  { value: "CERTAINEMENT_OUI", label: "Certainement oui" },
];

export default function TastingsPage() {
  const { user } = useAuth();
  const [tastings, setTastings] = useState<Degustation[]>([]);
  const [filtered, setFiltered] = useState<Degustation[]>([]);
  const [siteInfo, setSiteInfo] = useState<MonSiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTasting, setSelectedTasting] = useState<Degustation | null>(null);

  // Form state
  const [open, setOpen] = useState(false);
  const [trancheAge, setTrancheAge] = useState<TrancheAge | "">("");
  const [noteGout, setNoteGout] = useState<number | null>(null);
  const [intentionAchat, setIntentionAchat] = useState<IntentionAchat | "">("");
  const [aAchete, setAAchete] = useState(false);
  const [quantiteAchetee, setQuantiteAchetee] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tastingsRes, siteRes] = await Promise.all([
        api.get<Degustation[]>("/degustations/ma-liste/"),
        api.get<MonSiteInfo>("/sites/mon-site/"),
      ]);
      setTastings(tastingsRes.data);
      setFiltered(tastingsRes.data);
      setSiteInfo(siteRes.data);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFiltered(tastings);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const f = tastings.filter(
      (t) =>
        t.produit_nom.toLowerCase().includes(lower) ||
        t.hotesse_nom.toLowerCase().includes(lower) ||
        t.site_nom.toLowerCase().includes(lower)
    );
    setFiltered(f);
  }, [searchTerm, tastings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trancheAge || noteGout === null || !intentionAchat || !siteInfo?.affectation_actuelle) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      setSubmitLoading(true);
      const payload: CreateDegustationPayload = {
        affectation_id: siteInfo.affectation_actuelle.id,
        tranche_age: trancheAge,
        note_gout: noteGout,
        intention_achat: intentionAchat,
        a_achete: aAchete,
        vente: aAchete ? { quantite: quantiteAchetee } : undefined,
      };

      const res = await api.post<Degustation>("/degustations/", payload);
      toast.success("Dégustation enregistrée avec succès");
      
      // Gestion de la loterie / promotion si achat effectué
      if (aAchete && res.data.vente?.id) {
        try {
          const promoRes = await enregistrerGainPromotion(res.data.vente.id);
          if (promoRes.success && promoRes.message) {
            toast.success(promoRes.message, { duration: 5000 });
          }
        } catch (promoErr) {
          console.error("Erreur promotion:", promoErr);
        }
      }

      // Reset form
      setTrancheAge("");
      setNoteGout(null);
      setIntentionAchat("");
      setAAchete(false);
      setQuantiteAchetee(1);
      setOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Nouvelle logique de génération du Rapport avec Quantités & Goodies
  const downloadCSV = () => {
    const headers = [
      "ID", 
      "Campagne", 
      "Site", 
      "Produit", 
      "Hôtesse", 
      "Tranche d'âge", 
      "Note goût", 
      "Intention achat", 
      "Achat réalisé", 
      "Quantité Dégustée",      // Quantité requise par l'offre promotionnelle
      "Quantité Produit Acheté",// Quantité achetée au panier
      "Quantité Offerte",       // +1 si GAGNE ou extrait de la description si OFFERT
      "Goodies Gagnés",         // Nom + Qté du lot OU "Rien gagné"
      "Date"
    ];

    const rows = filtered.map(t => {
      let quantiteDegustee = 1; 
      let quantiteProduitAchete = 0;
      let quantiteOfferte = 0;
      let goodiesGagnes = "Aucun";

      if (t.a_achete) {
        quantiteProduitAchete = t.vente?.quantite || 1;

        // Recherche de la règle promotionnelle associée basée sur la quantité
        const promoAppliquee = siteInfo?.promotions?.find(p => p.quantite_requise === quantiteProduitAchete);

        if (promoAppliquee) {
          // La quantité dégustée s'aligne sur la quantité définie par l'offre
          quantiteDegustee = promoAppliquee.quantite_requise;

          if (promoAppliquee.type_promotion === "OFFERT") {
            const match = promoAppliquee.recompense_description.match(/\d+/);
            quantiteOfferte = match ? parseInt(match[0], 10) : 1;
            goodiesGagnes = "Hors mécanisme tirage";
          } 
          else if (promoAppliquee.type_promotion === "GAGNE") {
            // Règle spécifique : 1 produit offert systématique + participation au tirage
            quantiteOfferte = 1;
            
            // On vérifie si un lot physique / goodies a été lié et validé à la vente
            const lotGagne = t.vente?.recompense_description || (t as any).recompense_gagnee;
            const quantiteLot = (t.vente as any)?.quantite_recompense || 1;

            if (lotGagne) {
              goodiesGagnes = `${lotGagne} (Qté: ${quantiteLot})`;
            } else {
              goodiesGagnes = "Rien gagné au tirage";
            }
          }
        } else {
          quantiteDegustee = quantiteProduitAchete;
        }
      }

      return [
        t.id, 
        t.campagne_nom, 
        t.site_nom, 
        t.produit_nom, 
        t.hotesse_nom,
        t.tranche_age_display, 
        t.note_gout,
        t.intention_achat_display, 
        t.a_achete ? "Oui" : "Non",
        quantiteDegustee,
        quantiteProduitAchete,
        quantiteOfferte,
        goodiesGagnes,
        new Date(t.created_at).toLocaleDateString("fr-FR"),
      ];
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; 
    a.download = `rapport_degustations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); 
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} ligne(s) exportée(s) avec succès`);
  };

  const campTastings = selectedTasting
    ? tastings.filter((t) => t.campagne_nom === selectedTasting.campagne_nom)
    : [];
  const avgRating = campTastings.length
    ? (campTastings.reduce((acc, t) => acc + t.note_gout, 0) / campTastings.length).toFixed(1)
    : "0";
  const convRate = campTastings.length
    ? Math.round((campTastings.filter((t) => t.a_achete).length / campTastings.length) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-2">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 block">
              <UtensilsCrossed className="w-5 h-5" />
            </span>
            Suivi des Dégustations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {siteInfo?.affectation_actuelle
              ? `Session active : ${siteInfo.affectation_actuelle.campagne_nom} au site ${siteInfo.affectation_actuelle.site_nom}`
              : "Aucune animation active sur votre site actuellement"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <Button
            variant="outline"
            onClick={downloadCSV}
            disabled={filtered.length === 0}
            className="rounded-xl border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </Button>

          {siteInfo?.affectation_actuelle && (
            <Button
              onClick={() => setOpen(true)}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-md shadow-indigo-100 gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Saisie
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Middle Column: List and Filters */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Rechercher par produit, hôtesse ou site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-slate-200 shadow-sm focus-visible:ring-indigo-500 bg-white"
            />
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center gap-3 shadow-sm">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">Chargement des dégustations...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-700">Aucune dégustation trouvée</p>
              <p className="text-sm text-slate-400 mt-0.5">Modifiez vos critères de recherche ou ajoutez une saisie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTasting(t)}
                  className={cn(
                    "bg-white border rounded-xl p-4 transition-all duration-200 cursor-pointer text-left relative overflow-hidden group shadow-sm hover:shadow-md",
                    selectedTasting?.id === t.id
                      ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10"
                      : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 mb-1.5">
                        {t.produit_nom}
                      </span>
                      <h3 className="font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
                        Saisie #{t.id.slice(0, 8)}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm",
                          t.a_achete
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-slate-50 text-slate-500 border border-slate-100"
                        )}
                      >
                        {t.a_achete ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Achat ({t.vente?.quantite || 1})
                          </>
                        ) : (
                          "Pas d'achat"
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                    <p className="flex items-center gap-1.5 text-slate-600">
                      <UserRound className="w-3.5 h-3.5 text-slate-400" />
                      Hôtesse : <span className="font-semibold text-slate-700">{t.hotesse_nom}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {t.site_nom}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(t.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md font-semibold">
                      {t.tranche_age_display}
                    </span>
                    <div className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      <span>⭐</span>
                      <span>{t.note_gout}/5</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Detailed View / Sidebar */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5 sticky top-6">
          {selectedTasting ? (
            <>
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase mb-0.5">
                    Détails de l'avis
                  </div>
                  <h2 className="text-lg font-black text-slate-900">Saisie #{selectedTasting.id.slice(0, 8)}</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600"
                  onClick={() => setSelectedTasting(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50/60 rounded-xl p-3.5 border border-slate-100/80 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Hôtesse :</span>
                    <span className="font-bold text-slate-800">{selectedTasting.hotesse_nom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Site :</span>
                    <span className="font-bold text-slate-800">{selectedTasting.site_nom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Produit :</span>
                    <span className="font-bold text-slate-800 bg-white px-2 py-0.5 border border-slate-100 rounded-md text-xs">
                      {selectedTasting.produit_nom}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Date & Heure :</span>
                    <span className="font-medium text-slate-700">
                      {new Date(selectedTasting.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Critères d'évaluation
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white border border-slate-100 rounded-xl p-3 text-center">
                      <div className="text-xs font-medium text-slate-400 mb-1">Note Goût</div>
                      <div className="text-xl font-black text-amber-600 flex items-center justify-center gap-1">
                        ⭐ {selectedTasting.note_gout}<span className="text-xs text-slate-300 font-normal">/5</span>
                      </div>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-3 text-center flex flex-col justify-center">
                      <div className="text-xs font-medium text-slate-400 mb-0.5">Tranche d'âge</div>
                      <div className="text-xs font-bold text-slate-700">{selectedTasting.tranche_age_display}</div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-xl p-3.5">
                    <div className="text-xs font-medium text-slate-400 mb-1.5">Intention d'achat</div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-700">
                        {selectedTasting.intention_achat_display}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Impact Commercial
                  </Label>
                  <div
                    className={cn(
                      "rounded-xl border p-4 flex items-center justify-between",
                      selectedTasting.a_achete
                        ? "bg-emerald-50/40 border-emerald-100 text-emerald-800"
                        : "bg-slate-50 text-slate-500 border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm",
                          selectedTasting.a_achete ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                        )}
                      >
                        {selectedTasting.a_achete ? "🛒" : "❌"}
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          {selectedTasting.a_achete ? "Achat Conclu" : "Pas d'achat"}
                        </p>
                        <p className="text-xs opacity-80">
                          {selectedTasting.a_achete ? "Transformation réussie" : "Dégustation seule"}
                        </p>
                      </div>
                    </div>
                    {selectedTasting.a_achete && (
                      <div className="text-right">
                        <span className="text-xs font-medium opacity-70 block">Quantité</span>
                        <span className="text-base font-black">{selectedTasting.vendu_quantite || 1}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-400" />
                  Stats · {selectedTasting.campagne_nom}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: campTastings.length, label: "Dégustations", icon: "🍷", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
                    { value: avgRating, label: "Note moyenne", icon: "⭐", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
                    { value: `${convRate}%`, label: "Conversion", icon: "📈", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                  ].map((s, i) => (
                    <div key={i} className={cn("rounded-xl border p-3 text-center", s.bg, s.border)}>
                      <div className="text-xl mb-0.5">{s.icon}</div>
                      <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5 leading-none">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <div className="text-3xl mb-2">📊</div>
              <p className="text-sm font-semibold text-slate-600">Aucune sélection</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                Cliquez sur une dégustation dans la liste pour afficher ses indicateurs clés.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Entry Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-slate-100 gap-0">
          <DialogHeader className="p-6 bg-slate-50/50 border-b border-slate-100 text-left">
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 block">
                <UtensilsCrossed className="w-4 h-4" />
              </span>
              Ajouter une dégustation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Remplissez le profil et l'avis du consommateur en direct.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Tranche d'âge */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                Tranche d'âge <span className="text-rose-500">*</span>
              </Label>
              <Select value={trancheAge} onValueChange={(v) => setTrancheAge(v as TrancheAge)}>
                <SelectTrigger className="rounded-xl border-slate-200 h-11 shadow-sm focus:ring-indigo-500">
                  <SelectValue placeholder="Sélectionner l'âge du client" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {AGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="rounded-lg">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note goût */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 tracking-wide uppercase block">
                Appréciation du goût <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { value: 1, label: "Détesté", icon: <Frown className="w-5 h-5 text-rose-500" /> },
                  { value: 2, label: "Pas bon", icon: <Meh className="w-5 h-5 text-orange-400" /> },
                  { value: 3, label: "Neutre", icon: <Smile className="w-5 h-5 text-amber-400" /> },
                  { value: 4, label: "Bon", icon: <Laugh className="w-5 h-5 text-emerald-500" /> },
                  { value: 5, label: "Excellent", icon: <Heart className="w-5 h-5 text-pink-500" fill="currentColor" /> },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setNoteGout(item.value)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-200 gap-1.5 group/btn",
                      noteGout === item.value
                        ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500 font-bold"
                        : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 text-slate-400"
                    )}
                  >
                    <div className={cn("transition-transform duration-200 group-hover/btn:scale-110", noteGout === item.value ? "scale-110" : "opacity-75")}>
                      {item.icon}
                    </div>
                    <span className={cn("text-[9px] font-medium tracking-tight", noteGout === item.value ? "text-indigo-600" : "text-slate-500")}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Intention d'achat */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                Intention d'achat <span className="text-rose-500">*</span>
              </Label>
              <Select value={intentionAchat} onValueChange={(v) => setIntentionAchat(v as IntentionAchat)}>
                <SelectTrigger className="rounded-xl border-slate-200 h-11 shadow-sm focus:ring-indigo-500">
                  <SelectValue placeholder="Le client achèterait-il ce produit ?" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {INTENTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="rounded-lg">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Achat & Panier */}
            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                  <Label htmlFor="a_achete" className="text-xs font-bold text-slate-800 uppercase tracking-wide cursor-pointer">
                    Achat immédiat réalisé
                  </Label>
                  <p className="text-[10px] text-slate-400">Cochez si le client passe directement en caisse</p>
                </div>
                <input
                  id="a_achete"
                  type="checkbox"
                  checked={aAchete}
                  onChange={(e) => setAAchete(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
              </div>

              {aAchete && (
                <div className="grid grid-cols-2 gap-4 bg-indigo-50/20 border border-indigo-100/50 p-3.5 rounded-xl animate-in fade-in-50 slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                      Quantité achetée
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={quantiteAchetee}
                      onChange={(e) => setQuantiteAchetee(Math.max(1, parseInt(e.target.value) || 1))}
                      className="rounded-lg bg-white border-slate-200 h-9 text-slate-800 font-bold focus-visible:ring-indigo-500"
                    />
                  </div>

                  {/* Indicateur d'offres dynamiques en direct */}
                  <div className="flex flex-col justify-center text-left">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                      Mécanisme Offre
                    </span>
                    {siteInfo?.promotions?.find(p => p.quantite_requise === quantiteAchetee) ? (
                      <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 mt-1">
                        <Gift className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        {siteInfo.promotions.find(p => p.quantite_requise === quantiteAchetee)?.type_promotion === "GAGNE" 
                          ? "1 Offert + Loterie 🎰" 
                          : "Produits offerts 🎁"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium mt-1 italic">
                        Aucun palier atteint
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="rounded-xl text-slate-500 hover:bg-slate-50 font-semibold"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitLoading}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-md shadow-indigo-100 min-w-[120px]"
              >
                {submitLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}