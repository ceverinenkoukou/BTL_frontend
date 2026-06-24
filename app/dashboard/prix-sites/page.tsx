"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { Tag, Plus, Trash2, Edit2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { useUrlState } from "@/lib/hooks/useUrlState";
import type {
  SiteProduitPrix, CreateSiteProduitPrixPayload, SiteList, Produit, CampagneList,
} from "@/lib/types/backend";
import { getPrixSites, createPrixSite, updatePrixSite, deletePrixSite } from "@/lib/services/prixSiteService";

const EMPTY_FORM: CreateSiteProduitPrixPayload = { site: "", produit: "", prix: 0 };

function fmtXOF(val: string | number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "XOF", maximumFractionDigits: 0,
  }).format(Number(val));
}

function unwrapList<T>(data: T[] | { results?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function PrixSitesPageContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";

  const [prix, setPrix] = useState<SiteProduitPrix[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [campagnes, setCampagnes] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSiteProduitPrixPayload>(EMPTY_FORM);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCampagne, setFilterCampagne] = useUrlState("campagne", "all");
  const [filterSite, setFilterSite] = useUrlState("site", "all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pxData, sitesData, prodsData, campData] = await Promise.all([
        getPrixSites(),
        api.get("/sites/").then(r => unwrapList<SiteList>(r.data)),
        api.get("/produits/").then(r => unwrapList<Produit>(r.data)),
        api.get("/campagnes/").then(r => unwrapList<CampagneList>(r.data)),
      ]);
      setPrix(pxData);
      setSites(sitesData);
      setProduits(prodsData);
      setCampagnes(campData);
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredSites = sites.filter(s =>
    filterCampagne === "all" || s.campagne === filterCampagne
  );

  const filtered = prix.filter(p => {
    const site = sites.find(s => s.id === p.site);
    const matchCamp = filterCampagne === "all" || site?.campagne === filterCampagne;
    const matchSite = filterSite === "all" || p.site === filterSite;
    const matchSearch = !searchQuery ||
      p.produit_nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.site_nom.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCamp && matchSite && matchSearch;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: SiteProduitPrix) => {
    setEditingId(p.id);
    setForm({ site: p.site, produit: p.produit, prix: Number(p.prix) });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site || !form.produit || !form.prix) {
      toast.error("Site, produit et prix sont requis.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updatePrixSite(editingId, form);
        toast.success("Prix mis à jour.");
      } else {
        await createPrixSite(form);
        toast.success("Prix créé.");
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
    if (!confirm("Supprimer ce prix ?")) return;
    try {
      await deletePrixSite(id);
      toast.success("Prix supprimé.");
      fetchAll();
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prix par site"
        description={`Écrase le prix indicatif du produit pour le calcul du CA sur un site donné. ${prix.length} entrée${prix.length !== 1 ? "s" : ""}.`}
        icon={<Tag className="w-5 h-5" />}
        ctaSlot={
          isAdmin ? (
            <Button onClick={openCreate} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm">
              <Plus className="w-4 h-4 mr-2" /> Nouveau prix
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher produit ou site…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterCampagne} onValueChange={v => { setFilterCampagne(v); setFilterSite("all"); }}>
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
            {filteredSites.map(s => <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>)}
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
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun prix spécifique configuré</p>
          {isAdmin && (
            <>
              <p className="text-sm mt-1">
                Sans configuration, le prix indicatif du produit est utilisé pour le CA.
              </p>
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Nouveau prix
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Produit</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Site</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Prix effectif</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium">{p.produit_nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.site_nom}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                    {fmtXOF(p.prix)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => openEdit(p)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(p.id)}
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

      {/* Dialog */}
      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier le prix" : "Nouveau prix par site"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label>Campagne (pour filtrer les sites)</Label>
                <Select
                  value={filterCampagne}
                  onValueChange={v => { setFilterCampagne(v); setForm(f => ({ ...f, site: "" })); }}
                >
                  <SelectTrigger><SelectValue placeholder="Filtrer par campagne…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {campagnes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Site</Label>
                <Select value={form.site} onValueChange={v => setForm(f => ({ ...f, site: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un site…" /></SelectTrigger>
                  <SelectContent>
                    {filteredSites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nom} — {s.campagne_nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produit</Label>
                <Select value={form.produit} onValueChange={v => setForm(f => ({ ...f, produit: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un produit…" /></SelectTrigger>
                  <SelectContent>
                    {produits.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom}{p.prix_indicatif ? ` (indicatif : ${p.prix_indicatif})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prix effectif (FCFA)</Label>
                <Input
                  type="number" min={0} step={1}
                  value={form.prix || ""}
                  onChange={e => setForm(f => ({ ...f, prix: parseFloat(e.target.value) || 0 }))}
                  placeholder="Ex : 500"
                />
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

export default function PrixSitesPage() {
  return (
    <Suspense fallback={null}>
      <PrixSitesPageContent />
    </Suspense>
  );
}
