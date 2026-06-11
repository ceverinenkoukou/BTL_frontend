"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import {
  Target, Plus, Trash2, Edit2, Loader2, Search, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import type {
  ObjectifSite, CreateObjectifSitePayload, SiteList, RemoteUser, CampagneList,
} from "@/lib/types/backend";
import {
  getObjectifs, createObjectif, updateObjectif, deleteObjectif, genererObjectifsCampagne,
} from "@/lib/services/objectifService";

const EMPTY_FORM: CreateObjectifSitePayload = {
  site: "",
  hotesse: "",
  date: new Date().toISOString().slice(0, 10),
  objectif_degustations: 0,
  objectif_ventes: 0,
};

function unwrapList<T>(data: T[] | { results?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export default function ObjectifsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";

  const [objectifs, setObjectifs] = useState<ObjectifSite[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [hotesses, setHotesses] = useState<RemoteUser[]>([]);
  const [campagnes, setCampagnes] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateObjectifSitePayload>(EMPTY_FORM);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSite, setFilterSite] = useState("all");
  const [filterCampagne, setFilterCampagne] = useState("all");
  const [genCampagneId, setGenCampagneId] = useState("");
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [objData, sitesData, usersData, campData] = await Promise.all([
        getObjectifs(),
        api.get("/sites/").then(r => unwrapList<SiteList>(r.data)),
        api.get("/users/?role=Hotesse").then(r => unwrapList<RemoteUser>(r.data)),
        api.get("/campagnes/").then(r => unwrapList<CampagneList>(r.data)),
      ]);
      setObjectifs(objData);
      setSites(sitesData);
      setHotesses(usersData);
      setCampagnes(campData);
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredObjectifs = objectifs.filter(o => {
    const matchSite = filterSite === "all" || o.site === filterSite;
    const matchCamp = filterCampagne === "all" || sites.find(s => s.id === o.site)?.campagne === filterCampagne;
    const matchSearch = !searchQuery ||
      o.hotesse_nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.site_nom.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSite && matchCamp && matchSearch;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (o: ObjectifSite) => {
    setEditingId(o.id);
    setForm({
      site: o.site,
      hotesse: o.hotesse,
      date: o.date,
      objectif_degustations: o.objectif_degustations,
      objectif_ventes: o.objectif_ventes,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site || !form.hotesse || !form.date) {
      toast.error("Site, hôtesse et date sont requis.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateObjectif(editingId, form);
        toast.success("Objectif mis à jour.");
      } else {
        await createObjectif(form);
        toast.success("Objectif créé.");
      }
      setDialogOpen(false);
      fetchAll();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet objectif ?")) return;
    try {
      await deleteObjectif(id);
      toast.success("Objectif supprimé.");
      fetchAll();
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genCampagneId) { toast.error("Sélectionner une campagne."); return; }
    setGenerating(true);
    try {
      const res = await genererObjectifsCampagne(genCampagneId, genDate);
      toast.success(res.detail);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la génération automatique.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Objectifs par site / hôtesse
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {objectifs.length} objectif{objectifs.length !== 1 ? "s" : ""} au total
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Nouvel objectif
          </Button>
        )}
      </div>

      {/* Auto-generate block (admin only) */}
      {isAdmin && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="font-semibold text-sm mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Génération automatique depuis les objectifs campagne
          </p>
          <form onSubmit={handleGenerate} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs mb-1 block">Campagne</Label>
              <Select value={genCampagneId} onValueChange={setGenCampagneId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {campagnes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Date de référence</Label>
              <Input
                type="date"
                value={genDate}
                onChange={e => setGenDate(e.target.value)}
                className="h-9 w-44"
              />
            </div>
            <Button type="submit" variant="secondary" className="gap-2 h-9" disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Générer
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
      ) : filteredObjectifs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun objectif trouvé</p>
          {isAdmin && <p className="text-sm mt-1">Créez un objectif manuellement ou utilisez la génération automatique.</p>}
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Hôtesse</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Site</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Obj. Dégustations</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Obj. Ventes</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filteredObjectifs.map((o, i) => (
                <tr key={o.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium">{o.hotesse_nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.site_nom}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {new Date(o.date).toLocaleDateString("fr-FR")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-blue-600">
                    {o.objectif_degustations}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                    {o.objectif_ventes}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => openEdit(o)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(o.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Site</Label>
                <Select value={form.site} onValueChange={v => setForm(f => ({ ...f, site: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un site…" /></SelectTrigger>
                  <SelectContent>
                    {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom} — {s.campagne_nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hôtesse</Label>
                <Select value={form.hotesse} onValueChange={v => setForm(f => ({ ...f, hotesse: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une hôtesse…" /></SelectTrigger>
                  <SelectContent>
                    {hotesses.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Obj. Dégustations</Label>
                  <Input
                    type="number" min={0}
                    value={form.objectif_degustations}
                    onChange={e => setForm(f => ({ ...f, objectif_degustations: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Obj. Ventes</Label>
                  <Input
                    type="number" min={0}
                    value={form.objectif_ventes}
                    onChange={e => setForm(f => ({ ...f, objectif_ventes: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Mettre à jour" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
