"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { FileText, Loader2, Search, RefreshCw, Pencil, Clock, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { useUrlState } from "@/lib/hooks/useUrlState";
import api from "@/lib/api";
import type { RapportJournalier, RapportJournalierUpdatePayload, RapportJournalierConfig, SiteList, CampagneList } from "@/lib/types/backend";
import { DEFAULT_RAPPORT_JOURNALIER_CONFIG } from "@/lib/types/backend";
import { getRapports, genererRapports, updateRapport, getBulletin } from "@/lib/services/rapportService";
import { buildBulletinHtml } from "@/lib/services/rapportBulletinHtml";

function fmtXOF(val: string | number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "XOF", maximumFractionDigits: 0,
  }).format(Number(val));
}

function fmtHeure(val: string | null) {
  return val ? val.slice(0, 5) : "—";
}

function unwrapList<T>(data: T[] | { results?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

const EMPTY_EDIT_FORM: RapportJournalierUpdatePayload = {
  stock_initial_magasin: null,
  nombre_personnes_touchees: null,
  avis_consommateurs: "",
  observation_generale: "",
};

function RapportsPageContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";
  const canEdit = user?.role === "Administrateur" || user?.role === "Superviseur";

  const [rapports, setRapports] = useState<RapportJournalier[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [campagnes, setCampagnes] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSite, setFilterSite] = useUrlState("site", "all");
  const [filterCampagne, setFilterCampagne] = useUrlState("campagne", "all");
  const [filterDate, setFilterDate] = useUrlState("date", "");
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));

  const [editingRapport, setEditingRapport] = useState<RapportJournalier | null>(null);
  const [editForm, setEditForm] = useState<RapportJournalierUpdatePayload>(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);
  const [bulletinLoadingId, setBulletinLoadingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rapData, sitesData, campData] = await Promise.all([
        getRapports(),
        api.get("/sites/").then(r => unwrapList<SiteList>(r.data)),
        api.get("/campagnes/").then(r => unwrapList<CampagneList>(r.data)),
      ]);
      setRapports(rapData);
      setSites(sitesData);
      setCampagnes(campData);
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = rapports.filter(r => {
    const matchSite = filterSite === "all" || r.site === filterSite;
    const matchCamp = filterCampagne === "all" ||
      sites.find(s => s.id === r.site)?.campagne === filterCampagne;
    const matchDate = !filterDate || r.date === filterDate;
    const matchSearch = !searchQuery ||
      r.hotesse_nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.site_nom.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSite && matchCamp && matchDate && matchSearch;
  });

  const totalDegs = filtered.reduce((s, r) => s + r.nb_degustations, 0);
  const totalVentes = filtered.reduce((s, r) => s + r.nb_ventes, 0);
  const totalGoodies = filtered.reduce((s, r) => s + r.nb_goodies, 0);
  const totalCA = filtered.reduce((s, r) => s + Number(r.chiffre_affaires), 0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await genererRapports(genDate);
      toast.success(res.detail);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la génération.");
    } finally {
      setGenerating(false);
    }
  };

  const openEdit = (rapport: RapportJournalier) => {
    setEditingRapport(rapport);
    setEditForm({
      stock_initial_magasin: rapport.stock_initial_magasin,
      nombre_personnes_touchees: rapport.nombre_personnes_touchees,
      avis_consommateurs: rapport.avis_consommateurs ?? "",
      observation_generale: rapport.observation_generale ?? "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRapport) return;
    setSaving(true);
    try {
      const updated = await updateRapport(editingRapport.id, {
        stock_initial_magasin: editForm.stock_initial_magasin || null,
        nombre_personnes_touchees: editForm.nombre_personnes_touchees || null,
        avis_consommateurs: editForm.avis_consommateurs || null,
        observation_generale: editForm.observation_generale || null,
      });
      setRapports(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      toast.success("Rapport mis à jour.");
      setEditingRapport(null);
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBulletin = async (rapport: RapportJournalier) => {
    setBulletinLoadingId(rapport.id);
    try {
      const campagneId = sites.find(s => s.id === rapport.site)?.campagne;
      const campagneNom = campagnes.find(c => c.id === campagneId)?.nom ?? rapport.site_nom;

      const [bulletin, configRes] = await Promise.all([
        getBulletin(rapport.id),
        campagneId
          ? api.get<RapportJournalierConfig | { detail: string; defaults: boolean }>(
              `/rapport-journalier-configs/par-campagne/?campagne=${campagneId}`
            ).then(r => r.data).catch(() => null)
          : Promise.resolve(null),
      ]);

      const config: RapportJournalierConfig =
        configRes && !("defaults" in configRes) ? configRes : { ...DEFAULT_RAPPORT_JOURNALIER_CONFIG };

      const html = buildBulletinHtml(bulletin, config, campagneNom);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) win.document.title = `Bulletin — ${rapport.site_nom} — ${rapport.date}`;
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch {
      toast.error("Erreur lors de la génération du bulletin.");
    } finally {
      setBulletinLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports journaliers"
        description={`${rapports.length} rapport${rapports.length !== 1 ? "s" : ""} générés`}
        icon={<FileText className="w-5 h-5" />}
      />

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Dégustations", value: totalDegs, color: "text-blue-600" },
          { label: "Ventes", value: totalVentes, color: "text-emerald-600" },
          { label: "Goodies", value: totalGoodies, color: "text-fuchsia-600" },
          { label: "CA", value: fmtXOF(totalCA), color: "text-violet-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card shadow-sm p-4 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label} (filtre actif)</p>
          </div>
        ))}
      </div>

      {/* Manual trigger (admin only) */}
      {isAdmin && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="font-semibold text-sm mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Déclencher la génération manuellement
          </p>
          <form onSubmit={handleGenerate} className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs mb-1 block">Date</Label>
              <Input
                type="date"
                value={genDate}
                onChange={e => setGenDate(e.target.value)}
                className="h-9 w-44"
              />
            </div>
            <Button type="submit" variant="secondary" className="gap-2 h-9" disabled={generating}>
              {generating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              Générer les rapports
            </Button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher hôtesse ou site…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="h-9 w-44"
          title="Filtrer par date"
        />
        <Select value={filterCampagne} onValueChange={setFilterCampagne}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue placeholder="Toutes campagnes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes campagnes</SelectItem>
            {campagnes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSite} onValueChange={setFilterSite}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue placeholder="Tous les sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {sites
              .filter(s => filterCampagne === "all" || s.campagne === filterCampagne)
              .map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun rapport trouvé</p>
          {isAdmin && (
            <p className="text-sm mt-1">
              Les rapports sont générés automatiquement chaque soir à 23h00,<br />
              ou manuellement ci-dessus.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Hôtesse</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Site</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Pointage</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Dégustations</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ventes</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Goodies</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">CA</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Bulletin</th>
                {canEdit && <th className="px-4 py-3 font-semibold text-muted-foreground">Détails</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-mono">
                      {new Date(r.date).toLocaleDateString("fr-FR")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.hotesse_nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.site_nom}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{fmtHeure(r.heure_arrivee)} – {fmtHeure(r.heure_depart)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-blue-600">
                    {r.nb_degustations}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                    {r.nb_ventes}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-fuchsia-600">
                    {r.nb_goodies}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-violet-600">
                    {r.nb_ventes > 0 && Number(r.chiffre_affaires) === 0 ? (
                      <span
                        className="text-muted-foreground cursor-help"
                        title="Aucun prix configuré pour ce produit/site — le chiffre d'affaires n'a pas pu être calculé."
                      >
                        —
                      </span>
                    ) : (
                      fmtXOF(r.chiffre_affaires)
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost" size="sm" className="h-8 w-8 p-0"
                      disabled={bulletinLoadingId === r.id}
                      onClick={() => handleOpenBulletin(r)}
                      title="Voir le bulletin"
                    >
                      {bulletinLoadingId === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <FileDown className="w-3.5 h-3.5" />}
                    </Button>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(r)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit dialog — champs saisis manuellement */}
      <Dialog open={!!editingRapport} onOpenChange={open => !open && setEditingRapport(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Détails du jour — {editingRapport?.hotesse_nom} ({editingRapport?.site_nom})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Stock magasin (début de journée)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.stock_initial_magasin ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, stock_initial_magasin: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Personnes touchées</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.nombre_personnes_touchees ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, nombre_personnes_touchees: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avis des consommateurs</Label>
              <textarea
                value={editForm.avis_consommateurs ?? ""}
                onChange={e => setEditForm(f => ({ ...f, avis_consommateurs: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observation générale</Label>
              <textarea
                value={editForm.observation_generale ?? ""}
                onChange={e => setEditForm(f => ({ ...f, observation_generale: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingRapport(null)}>Annuler</Button>
              <Button onClick={handleSaveEdit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RapportsPage() {
  return (
    <Suspense fallback={null}>
      <RapportsPageContent />
    </Suspense>
  );
}
