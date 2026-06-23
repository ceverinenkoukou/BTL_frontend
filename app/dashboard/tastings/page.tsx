"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type {
  Degustation, CreateDegustationPayload, SiteList, MonSiteInfo,
  TrancheAge, IntentionAchat, TypeConditionnement, TypePromotion, Genre,
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
  { value: "MOINS_18", label: "Moins de 18 ans" },
  { value: "18_25",    label: "18 – 25 ans" },
  { value: "26_35",    label: "26 – 35 ans" },
  { value: "36_50",    label: "36 – 50 ans" },
  { value: "PLUS_50",  label: "Plus de 50 ans" },
];

const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "HOMME", label: "Homme" },
  { value: "FEMME", label: "Femme" },
];

const INTENT_OPTIONS: { value: IntentionAchat; label: string; color: string }[] = [
  { value: "FAIBLE",  label: "Faible",  color: "bg-red-100 text-red-700 border-red-200" },
  { value: "MOYENNE", label: "Moyenne", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "ELEVEE",  label: "Élevée",  color: "bg-green-100 text-green-700 border-green-200" },
];

const RATING_ICONS_5: { rating: number; icon: React.ReactNode; label: string }[] = [
  { rating: 1, icon: <Frown className="w-8 h-8" />,  label: "Mauvais"  },
  { rating: 2, icon: <Meh className="w-8 h-8" />,    label: "Bof"      },
  { rating: 3, icon: <Smile className="w-8 h-8" />,  label: "Correct"  },
  { rating: 4, icon: <Laugh className="w-8 h-8" />,  label: "Bon"      },
  { rating: 5, icon: <Heart className="w-8 h-8" />,  label: "Excellent" },
];

const EMPTY_FORM = {
  site: "",
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
  promotion_selectionnee: "" as string | "",
};

// Couleurs pour les types de promotion
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

export default function TastingsPage() {
  const { user } = useAuth();
  const [tastings, setTastings] = useState<Degustation[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [siteInfo, setSiteInfo] = useState<MonSiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSite, setLoadingSite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTasting, setSelectedTasting] = useState<Degustation | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const activeSiteRef = useRef<string>("");

  const isHostess = user?.role === "Hotesse";
  const isAdmin = user?.role === "Administrateur";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tastRes, siteRes] = await Promise.all([
        api.get<Degustation[]>("/degustations/"),
        api.get<SiteList[]>("/sites/"),
      ]);
      setTastings(Array.isArray(tastRes.data) ? tastRes.data : ((tastRes.data as { results?: Degustation[] }).results ?? []));
      setSites(Array.isArray(siteRes.data) ? siteRes.data : ((siteRes.data as { results?: SiteList[] }).results ?? []));
    } catch {
      toast.error("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    setForm(f => ({ ...f, site: siteId, produit: "" }));
    setSiteInfo(null);
    if (!siteId) return;
    setLoadingSite(true);
    try {
      const { data } = await api.get<MonSiteInfo>(`/degustations/mon-site/?site_id=${siteId}`);
      setSiteInfo(data);
      if (data.auto_select_produit && data.produits.length === 1) {
        setForm(f => ({ ...f, produit: data.produits[0].id }));
      }
    } catch {
      toast.error("Impossible de charger les informations du site.");
    } finally {
      setLoadingSite(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const needsNote     = siteInfo?.note_gout_active;
  const needsAmbiance = siteInfo?.note_ambiance_active;
  if (!form.site || !form.produit || !form.tranche_age || !form.genre || (needsNote && !form.note_gout) || (needsAmbiance && !form.note_ambiance) || !form.intention_achat) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSaving(true);
    try {
      const hasPromotion = form.a_achete && Boolean(form.promotion_selectionnee);
      const payload: CreateDegustationPayload = {
        site: form.site,
        produit: form.produit,
        tranche_age: form.tranche_age as TrancheAge,
        genre: form.genre as Genre,
        ...(siteInfo?.note_gout_active     ? { note_gout:     form.note_gout     || null } : {}),
        ...(siteInfo?.note_ambiance_active ? { note_ambiance: form.note_ambiance || null } : {}),
        intention_achat: form.intention_achat as IntentionAchat,
        a_achete: form.a_achete,
        nom_client: form.nom_client.trim() || undefined,
        ...(form.a_achete && !hasPromotion && {
          conditionnement: form.conditionnement,
          quantite: form.quantite,
        }),
      };
      const { data: created } = await api.post<Degustation>("/degustations/", payload);

      // Si une promotion a été sélectionnée, enregistrer le gain
      if (form.a_achete && form.promotion_selectionnee && siteInfo) {
        try {
          const gainResult = await enregistrerGainPromotion(form.promotion_selectionnee, {
            site_id: form.site,
            produit_id: form.produit,
            nom_client: form.nom_client.trim() || undefined,
            tranche_age: form.tranche_age || undefined,
          });
          toast.success(`🎉 ${gainResult.recompense} enregistré !`);
        } catch (promoErr: unknown) {
          const promoMsg = (promoErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.warning(promoMsg ?? "Erreur lors de l'enregistrement de la promotion.");
        }
      }

      setTastings(prev => [created, ...prev]);
      toast.success("Dégustation enregistrée !");
      setDialogOpen(false);
      setForm(f => ({ ...EMPTY_FORM, site: f.site }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = tastings.filter(t => {
    const q = searchQuery.toLowerCase();
    return !q || t.produit_nom.toLowerCase().includes(q) || t.campagne_nom.toLowerCase().includes(q) || t.site_nom.toLowerCase().includes(q);
  });

  const stats = {
    total: tastings.length,
    purchased: tastings.filter(t => t.a_achete).length,
    conversionRate: tastings.length > 0
      ? Math.round((tastings.filter(t => t.a_achete).length / tastings.length) * 100)
      : 0,
    avgRating: (() => {
      const rated = tastings.filter(t => t.note_gout !== null);
      return rated.length > 0
        ? (rated.reduce((s, t) => s + (t.note_gout ?? 0), 0) / rated.length).toFixed(1)
        : "—";
    })(),
  };

  const downloadCSV = () => {
    const headers = ["ID", "Campagne", "Site", "Produit", "Hôtesse", "Tranche d'âge", "Note goût", "Intention achat", "Achat réalisé", "Date"];
    const rows = filtered.map(t => [
      t.id, t.campagne_nom, t.site_nom, t.produit_nom, t.hotesse_nom,
      t.tranche_age_display, t.note_gout,
      t.intention_achat_display, t.a_achete ? "Oui" : "Non",
      new Date(t.created_at).toLocaleDateString("fr-FR"),
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `degustations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${filtered.length} dégustation(s) exportée(s)`);
  };

  return (
    <div className="space-y-6">

      {/* ── Hero banner ── */}
      {isAdmin ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-600 to-violet-500 text-white shadow-2xl shadow-indigo-200">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-28 -bottom-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                    <UtensilsCrossed className="w-4.5 h-4.5" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dégustations</h1>
                </div>
                <p className="text-white/65 text-sm ml-12">Suivi en temps réel de toutes les dégustations</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={downloadCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-sm font-semibold transition-colors backdrop-blur-sm">
                  <Download className="w-4 h-4" /><span className="hidden sm:inline">Exporter CSV</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Dégustations", value: stats.total,               sub: "enregistrées", icon: "🍷" },
                { label: "Achats",       value: stats.purchased,           sub: "réalisés",     icon: "🛒" },
                { label: "Conversion",   value: `${stats.conversionRate}%`,sub: "taux",         icon: "📈" },
                { label: "Note moyenne", value: stats.avgRating,           sub: "/ 5",          icon: "⭐" },
              ].map((s, i) => (
                <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                  <div className="text-base mb-1">{s.icon}</div>
                  <div className="text-xl font-bold leading-none">
                    {s.value}<span className="text-xs font-normal text-white/55 ml-1">{s.sub}</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dégustations</h1>
            <p className="text-muted-foreground mt-1">
              {isHostess ? "Enregistrez vos dégustations" : "Suivi des dégustations de vos campagnes"}
            </p>
          </div>
          {isHostess && (
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />Nouvelle dégustation
            </Button>
          )}
        </div>
      )}

      {/* Non-admin stats row */}
      {!isAdmin && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: stats.total,               label: "Dégustations", color: "text-indigo-600" },
            { value: stats.purchased,           label: "Achats",       color: "text-emerald-600" },
            { value: `${stats.conversionRate}%`,label: "Conversion",   color: "text-violet-600" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher produit, site, campagne…" className="pl-9 rounded-xl border-slate-200"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {isHostess && (
          <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Nouvelle
          </Button>
        )}
        {isAdmin && (
          <button onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold transition-colors">
            <Download className="w-4 h-4" />CSV ({filtered.length})
          </button>
        )}
      </div>

      {/* ── Tastings grid ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            {isHostess ? "Mes dégustations" : "Toutes les dégustations"}
          </h3>
          <span className="text-xs text-muted-foreground bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
            {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-slate-50 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <UtensilsCrossed className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Aucun résultat</p>
            <p className="text-xs text-muted-foreground">
              {isHostess ? "Commencez par enregistrer une dégustation" : "Aucune dégustation ne correspond à votre recherche"}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(t => {
              const intent = INTENT_OPTIONS.find(i => i.value === t.intention_achat);
              const rating = RATING_ICONS_5.find(r => r.rating === t.note_gout);
              const stripColor = t.intention_achat === "ELEVEE" ? "bg-emerald-400"
                : t.intention_achat === "MOYENNE" ? "bg-amber-400" : "bg-rose-400";
              return (
                <button key={t.id} type="button" onClick={() => setSelectedTasting(t)}
                  className="relative text-left rounded-2xl border border-slate-100 bg-white hover:shadow-md hover:border-indigo-200 transition-all group overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripColor}`} />
                  <div className="pl-4 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0 group-hover:bg-indigo-100 transition-colors">
                          {rating?.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{t.produit_nom}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.campagne_nom}</p>
                        </div>
                      </div>
                      {t.a_achete && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold shrink-0">
                          Achat ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{t.site_nom}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-400 text-xs">
                        {t.note_gout !== null ? "⭐".repeat(Math.min(t.note_gout, 5)) : null}
                        <span className="text-muted-foreground ml-1">{t.note_gout !== null ? rating?.label : "—"}</span>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", intent?.color)}>
                        {intent?.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New tasting form dialog (hôtesse only) ── */}
      {isHostess && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enregistrer une dégustation</DialogTitle>
              <DialogDescription>Saisissez les informations de la dégustation</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Site *</Label>
                  <Select value={form.site} onValueChange={handleSiteChange}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produit *</Label>
                  <Select value={form.produit}
                    onValueChange={v => setForm(f => ({ ...f, produit: v }))}
                    disabled={!form.site || loadingSite}>
                    <SelectTrigger>
                      {loadingSite ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue placeholder="Sélectionner" />}
                    </SelectTrigger>
                    <SelectContent>
                      {(siteInfo?.produits ?? []).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tranche d&apos;âge *</Label>
                  <Select value={form.tranche_age} onValueChange={v => setForm(f => ({ ...f, tranche_age: v as TrancheAge }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Genre *</Label>
                  <Select value={form.genre} onValueChange={v => setForm(f => ({ ...f, genre: v as Genre }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{GENRE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {siteInfo?.note_ambiance_active && (
                <div className="space-y-3">
                  <Label>Note d&apos;ambiance *</Label>
                  {(siteInfo.note_ambiance_max ?? 5) <= 5 ? (
                    <div className="flex justify-between gap-2">
                      {RATING_ICONS_5.map(r => (
                        <button key={r.rating} type="button" onClick={() => setForm(f => ({ ...f, note_ambiance: r.rating }))}
                          className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all flex-1",
                            form.note_ambiance === r.rating ? "border-violet-500 bg-violet-50 text-violet-600" : "border-border hover:border-violet-300")}>
                          {r.icon}<span className="text-xs font-medium">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: siteInfo.note_ambiance_max }, (_, i) => i + 1).map(n => (
                        <button key={n} type="button" onClick={() => setForm(f => ({ ...f, note_ambiance: n }))}
                          className={cn("py-3 rounded-xl border-2 text-sm font-bold transition-all",
                            form.note_ambiance === n ? "border-violet-500 bg-violet-50 text-violet-600" : "border-border hover:border-violet-300")}>
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {siteInfo?.note_gout_active && (
                <div className="space-y-3">
                  <Label>Note du goût *</Label>
                  {(siteInfo.note_gout_max ?? 5) <= 5 ? (
                    <div className="flex justify-between gap-2">
                      {RATING_ICONS_5.map(r => (
                        <button key={r.rating} type="button" onClick={() => setForm(f => ({ ...f, note_gout: r.rating }))}
                          className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all flex-1",
                            form.note_gout === r.rating ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-border hover:border-indigo-300")}>
                          {r.icon}<span className="text-xs font-medium">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: siteInfo.note_gout_max }, (_, i) => i + 1).map(n => (
                        <button key={n} type="button" onClick={() => setForm(f => ({ ...f, note_gout: n }))}
                          className={cn("py-3 rounded-xl border-2 text-sm font-bold transition-all",
                            form.note_gout === n ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-border hover:border-indigo-300")}>
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Label>Intention d&apos;achat *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {INTENT_OPTIONS.map(o => (
                    <button key={o.value} type="button" onClick={() => setForm(f => ({ ...f, intention_achat: o.value }))}
                      className={cn("py-3 px-4 rounded-lg border-2 font-medium transition-all text-sm",
                        form.intention_achat === o.value ? o.color + " border-current" : "border-border hover:border-indigo-300")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Le client a-t-il acheté ?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setForm(f => ({ ...f, a_achete: false }))}
                    className={cn("py-4 rounded-xl border-2 font-medium transition-all",
                      !form.a_achete ? "border-slate-400 bg-slate-50" : "border-border hover:border-slate-300")}>
                    Non
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, a_achete: true }))}
                    className={cn("py-4 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2",
                      form.a_achete ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border hover:border-emerald-400")}>
                    <CheckCircle2 className="w-5 h-5" />Oui, acheté !
                  </button>
                </div>
              </div>

              {form.a_achete && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Conditionnement *</Label>
                      <Select value={form.conditionnement} onValueChange={v => setForm(f => ({ ...f, conditionnement: v as TypeConditionnement }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNITE">À l&apos;unité</SelectItem>
                          <SelectItem value="PACK">En pack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité *</Label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setForm(f => ({ ...f, quantite: Math.max(1, f.quantite - 1) }))}
                          className="w-9 h-9 rounded-lg border-2 border-input flex items-center justify-center text-lg font-bold hover:bg-muted">−</button>
                        <Input type="number" min="1" value={form.quantite}
                          onChange={e => setForm(f => ({ ...f, quantite: Math.max(1, parseInt(e.target.value) || 1) }))}
                          className="w-16 text-center font-semibold h-9" />
                        <button type="button" onClick={() => setForm(f => ({ ...f, quantite: f.quantite + 1 }))}
                          className="w-9 h-9 rounded-lg border-2 border-input flex items-center justify-center text-lg font-bold hover:bg-muted">+</button>
                      </div>
                    </div>
                  </div>

                  {/* ── Promotions configurées par l'admin ── */}
                  {siteInfo?.promotions && siteInfo.promotions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-blue-600">
                          Offres promotionnelles de la campagne
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          ({siteInfo.promotions.length} règle{siteInfo.promotions.length > 1 ? "s" : ""})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sélectionnez l&apos;offre correspondant à l&apos;achat du client :
                      </p>

                      <div className="space-y-2">
                        {siteInfo.promotions.map((promo) => {
                          const styles = PROMO_TYPE_STYLES[promo.type_promotion];
                          const isSelected = form.promotion_selectionnee === promo.id;

                          return (
                            <button
                              key={promo.id}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, promotion_selectionnee: promo.id }))}
                              className={cn(
                                "w-full text-left rounded-xl border-2 p-3 transition-all",
                                isSelected
                                  ? `${styles.bg} ${styles.border} ${styles.text}`
                                  : "border-slate-200 hover:border-slate-300 bg-white"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                  isSelected ? "bg-white/60" : "bg-slate-100"
                                )}>
                                  <span className="text-xl">{styles.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-xs font-bold px-2 py-0.5 rounded-full",
                                      isSelected ? "bg-white/60" : "bg-slate-100 text-slate-600"
                                    )}>
                                      {promo.quantite_requise} acheté{promo.quantite_requise > 1 ? "s" : ""}
                                    </span>
                                    <span className={cn(
                                      "text-xs font-medium",
                                      isSelected ? styles.text : "text-slate-500"
                                    )}>
                                      → {styles.label}
                                    </span>
                                  </div>
                                  <p className={cn(
                                    "font-semibold text-sm mt-1",
                                    isSelected ? styles.text : "text-foreground"
                                  )}>
                                    {promo.recompense_description}
                                  </p>
                                </div>
                                {isSelected && (
                                  <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                                    styles.text.replace("text-", "bg-").replace("700", "100")
                                  )}>
                                    <CheckCircle2 className={cn("w-4 h-4", styles.text)} />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Option "Aucune promotion" */}
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, promotion_selectionnee: "" }))}
                        className={cn(
                          "w-full text-left rounded-xl border-2 p-3 transition-all",
                          form.promotion_selectionnee === ""
                            ? "border-slate-400 bg-slate-50 text-slate-700"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            form.promotion_selectionnee === "" ? "bg-slate-200" : "bg-slate-100"
                          )}>
                            <span className="text-xl">🚫</span>
                          </div>
                          <span className="font-medium text-sm">Aucune promotion applicable</span>
                          {form.promotion_selectionnee === "" && (
                            <CheckCircle2 className="w-5 h-5 text-slate-500 ml-auto" />
                          )}
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Nom du client (optionnel)</Label>
                <Input value={form.nom_client} onChange={e => setForm(f => ({ ...f, nom_client: e.target.value }))}
                  placeholder="Prénom ou initiales…" />
              </div>

              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700" disabled={saving}>
                {saving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Enregistrement…</> : <><CheckCircle2 className="w-5 h-5 mr-2" />Enregistrer la dégustation</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Tasting detail dialog ── */}
      {selectedTasting && (() => {
        const campTastings = tastings.filter(t => t.campagne_nom === selectedTasting.campagne_nom);
        const avgRating = campTastings.length > 0
          ? (campTastings.filter(t => t.note_gout !== null).reduce((s, t) => s + (t.note_gout ?? 0), 0) / campTastings.filter(t => t.note_gout !== null).length).toFixed(1)
          : "—";
        const convRate = campTastings.length > 0
          ? Math.round((campTastings.filter(t => t.a_achete).length / campTastings.length) * 100)
          : 0;
        const rating = RATING_ICONS_5.find(r => r.rating === selectedTasting.note_gout);
        const intent = INTENT_OPTIONS.find(i => i.value === selectedTasting.intention_achat);
        const intentSteps = [
          { value: "FAIBLE",  label: "Faible",  dotColor: "bg-rose-400",    textColor: "text-rose-600"    },
          { value: "MOYENNE", label: "Moyenne", dotColor: "bg-amber-400",   textColor: "text-amber-600"   },
          { value: "ELEVEE",  label: "Élevée",  dotColor: "bg-emerald-400", textColor: "text-emerald-700" },
        ];
        const activeIntentIdx = intentSteps.findIndex(s => s.value === selectedTasting.intention_achat);

        return (
          <Dialog open={!!selectedTasting} onOpenChange={open => { if (!open) setSelectedTasting(null); }}>
            <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl gap-0">
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-600 to-violet-500 text-white px-6 pt-6 pb-5">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.12),transparent_60%)]" />
                <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
                <button onClick={() => setSelectedTasting(null)}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors z-10">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-16 h-16 bg-white/20 border border-white/30 rounded-2xl flex items-center justify-center text-4xl shrink-0 shadow-lg">
                    {rating?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/55 font-medium uppercase tracking-widest mb-0.5">Dégustation</p>
                    <h2 className="text-lg font-bold leading-tight truncate">{selectedTasting.produit_nom}</h2>
                    <p className="text-sm text-white/70 truncate">{selectedTasting.campagne_nom}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-white/55 text-xs">
                      <MapPin className="w-3 h-3" />{selectedTasting.site_nom}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-white/55 text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(selectedTasting.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      <span className="opacity-50">·</span>
                      {new Date(selectedTasting.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className="relative z-10 flex items-center gap-2 mt-4">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all",
                        i <= selectedTasting.note_gout ? "bg-white text-amber-500 shadow-sm" : "bg-white/20 text-white/40")}>★</div>
                    ))}
                  </div>
                  <span className="text-white/70 text-xs font-medium">{rating?.label} ({selectedTasting.note_gout}/5)</span>
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <UserRound className="w-3.5 h-3.5 text-indigo-400" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Profil dégustateur</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-sm font-medium">
                      🎂 {selectedTasting.tranche_age_display}
                    </span>
                    {selectedTasting.nom_client && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium">
                        👤 {selectedTasting.nom_client}
                      </span>
                    )}
                    {!isHostess && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-slate-700 text-sm font-medium">
                        💃 {selectedTasting.hotesse_nom}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Intention d&apos;achat</p>
                  </div>
                  <div className="relative flex items-center gap-0">
                    {intentSteps.map((step, idx) => {
                      const isActive = idx === activeIntentIdx;
                      const isPast = idx < activeIntentIdx;
                      return (
                        <div key={step.value} className="flex-1 flex flex-col items-center relative">
                          {idx < intentSteps.length - 1 && (
                            <div className={cn("absolute top-[13px] left-1/2 w-full h-0.5 z-0",
                              idx < activeIntentIdx ? "bg-emerald-300" : "bg-slate-200")} />
                          )}
                          <div className={cn("relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all",
                            isActive ? `${step.dotColor} border-transparent text-white shadow-md scale-110`
                              : isPast ? "bg-emerald-400 border-emerald-400 text-white"
                              : "bg-white border-slate-200 text-slate-300")}>
                            {isPast ? "✓" : isActive ? "●" : "○"}
                          </div>
                          <p className={cn("text-xs mt-1.5 font-semibold",
                            isActive ? step.textColor : isPast ? "text-emerald-600" : "text-slate-400")}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedTasting.a_achete ? (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white p-4 shadow-md shadow-emerald-100">
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-base">Achat réalisé ✓</p>
                          {selectedTasting.vente && (
                            <p className="text-emerald-100 text-xs">
                              {selectedTasting.vente.quantite} × {selectedTasting.vente.conditionnement_display}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedTasting.vente?.prix_total && (
                        <div className="text-right">
                          <p className="text-2xl font-black">
                            {new Intl.NumberFormat("fr-FR").format(Number(selectedTasting.vente.prix_total))} F
                          </p>
                          <p className="text-emerald-200 text-xs">total</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500 text-sm">Aucun achat</p>
                      <p className="text-xs text-slate-400">Le client n&apos;a pas acheté lors de cette dégustation</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-400" />
                    Stats · {selectedTasting.campagne_nom}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: campTastings.length, label: "Dégustations", icon: "🍷", color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-100" },
                      { value: avgRating,            label: "Note moyenne",  icon: "⭐", color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100"  },
                      { value: `${convRate}%`,       label: "Conversion",    icon: "📈", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                    ].map((s, i) => (
                      <div key={i} className={cn("rounded-xl border p-3 text-center", s.bg, s.border)}>
                        <div className="text-xl mb-0.5">{s.icon}</div>
                        <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}