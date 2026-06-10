"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, Entreprise, Goodie, SiteList } from "@/lib/types/backend";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Gift, Building2, Loader2, Plus, Search, Trash2, Edit2, Package,
  ChevronDown, ChevronUp, Store, Boxes, MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GoodieFormData {
  nom: string;
  description: string;
  campagne: string;
  quantite_total: string;
}

const EMPTY_FORM: GoodieFormData = {
  nom: "",
  description: "",
  campagne: "",
  quantite_total: "",
};

export default function GoodiesPage() {
  const { user } = useAuth();
  const [goodies, setGoodies] = useState<Goodie[]>([]);
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoodie, setEditingGoodie] = useState<Goodie | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<GoodieFormData>(EMPTY_FORM);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [goodRes, campRes, entRes, sitesRes] = await Promise.all([
        api.get<Goodie[]>("/goodies/"),
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Entreprise[]>("/entreprises/"),
        api.get<SiteList[]>("/sites/"),
      ]);
      setGoodies(Array.isArray(goodRes.data) ? goodRes.data : ((goodRes.data as { results?: Goodie[] }).results ?? []));
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []));
      setEntreprises(Array.isArray(entRes.data) ? entRes.data : ((entRes.data as { results?: Entreprise[] }).results ?? []));
      setSites(Array.isArray(sitesRes.data) ? sitesRes.data : ((sitesRes.data as { results?: SiteList[] }).results ?? []));
    } catch {
      toast.error("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Group goodies by campaign
  const goodiesByCampaign = campaigns.map(campaign => {
    const campaignGoodies = goodies.filter(g => g.campagne === campaign.id);
    const totalStock = campaignGoodies.reduce((sum, g) => sum + g.quantite_total, 0);
    const totalRestant = campaignGoodies.reduce((sum, g) => sum + g.quantite_restante, 0);
    const totalDistribue = campaignGoodies.reduce((sum, g) => sum + g.quantite_distribuee, 0);
    return {
      campaign,
      goodies: campaignGoodies,
      stats: { total: campaignGoodies.length, totalStock, totalRestant, totalDistribue }
    };
  }).filter(cg => cg.goodies.length > 0 || filterCampaign === "all");

  // Filtered campaigns for display
  const filteredCampaigns = goodiesByCampaign.filter(cg => {
    const matchCampaign = filterCampaign === "all" || cg.campaign.id === filterCampaign;
    const matchCompany = filterCompany === "all" || cg.campaign.entreprise === filterCompany;
    const matchSearch = searchQuery === "" || 
      cg.goodies.some(g => g.nom.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCampaign && matchCompany && matchSearch;
  });

  // Stats
  const stats = {
    totalGoodies: goodies.length,
    totalCampaignsWithGoodies: new Set(goodies.map(g => g.campagne)).size,
    totalStock: goodies.reduce((sum, g) => sum + g.quantite_total, 0),
    totalDistribue: goodies.reduce((sum, g) => sum + g.quantite_distribuee, 0),
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.campagne || !form.quantite_total) {
      toast.error("Nom, campagne et quantité sont requis.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/goodies/", {
        nom: form.nom.trim(),
        description: form.description.trim() || undefined,
        campagne: form.campagne,
        quantite_total: parseInt(form.quantite_total),
      });
      toast.success("Goodie créé avec succès.");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la création du goodie.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoodie) return;
    setSaving(true);
    try {
      await api.patch(`/goodies/${editingGoodie.id}/`, {
        nom: form.nom.trim(),
        description: form.description.trim() || undefined,
        quantite_total: parseInt(form.quantite_total),
      });
      toast.success("Goodie mis à jour.");
      setDialogOpen(false);
      setEditingGoodie(null);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce goodie ? Cette action est irréversible.")) return;
    try {
      await api.delete(`/goodies/${id}/`);
      toast.success("Goodie supprimé.");
      fetchAll();
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const openEditDialog = (goodie: Goodie) => {
    setEditingGoodie(goodie);
    setForm({
      nom: goodie.nom,
      description: goodie.description || "",
      campagne: goodie.campagne,
      quantite_total: goodie.quantite_total.toString(),
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingGoodie(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const toggleCampaignExpand = (campaignId: string) => {
    const newSet = new Set(expandedCampaigns);
    if (newSet.has(campaignId)) {
      newSet.delete(campaignId);
    } else {
      newSet.add(campaignId);
    }
    setExpandedCampaigns(newSet);
  };

  // Get sites for selected campaign
  const campaignSites = sites.filter(s => s.campagne === form.campagne);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-600 via-pink-500 to-rose-400 text-white shadow-2xl shadow-fuchsia-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_65%)]" />
        <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-32 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestion des Goodies</h1>
              </div>
              <p className="text-white/65 text-sm ml-12">Enregistrement et suivi des goodies par campagne</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={openCreateDialog}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Goodie
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingGoodie ? "Modifier le Goodie" : "Nouveau Goodie"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={editingGoodie ? handleUpdate : handleCreate} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nom du goodie *
                    </Label>
                    <Input
                      value={form.nom}
                      onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                      placeholder="Ex: T-shirt promotionnel"
                      className="rounded-xl"
                    />
                  </div>

                  {!editingGoodie && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Campagne *
                      </Label>
                      <Select 
                        value={form.campagne} 
                        onValueChange={v => setForm(f => ({ ...f, campagne: v }))}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Sélectionner une campagne" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaigns.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nom} ({c.entreprise_nom})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Quantité totale *
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.quantite_total}
                      onChange={e => setForm(f => ({ ...f, quantite_total: e.target.value }))}
                      placeholder="Ex: 100"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Description
                    </Label>
                    <Input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Description optionnelle..."
                      className="rounded-xl"
                    />
                  </div>

                  {campaignSites.length > 0 && !editingGoodie && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs text-amber-700">
                        <Store className="w-3 h-3 inline mr-1" />
                        {campaignSites.length} site(s) disponible(s) pour allocation
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setDialogOpen(false)}
                      className="rounded-xl"
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={saving}
                      className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                    >
                      {saving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                      ) : editingGoodie ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* KPI chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: "🎁", label: "Goodies", value: stats.totalGoodies },
              { icon: "🎯", label: "Campagnes", value: stats.totalCampaignsWithGoodies },
              { icon: "📦", label: "Stock total", value: stats.totalStock },
              { icon: "✅", label: "Distribués", value: stats.totalDistribue },
            ].map((s, i) => (
              <div key={i} className="bg-white/18 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                <div className="text-base mb-1">{s.icon}</div>
                <div className="text-2xl font-bold leading-none">{s.value}</div>
                <div className="text-xs text-white/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un goodie..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-48 rounded-xl">
            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Entreprise" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entreprises</SelectItem>
            {entreprises.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.nom_commercial}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-48 rounded-xl">
            <Package className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Campagne" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les campagnes</SelectItem>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns with Goodies */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <div className="w-16 h-16 bg-fuchsia-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Boxes className="w-8 h-8 text-fuchsia-300" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Aucun goodie</p>
          <p className="text-xs text-muted-foreground">
            {searchQuery || filterCampaign !== "all" || filterCompany !== "all" 
              ? "Ajustez les filtres pour voir plus de résultats."
              : "Créez votre premier goodie en cliquant sur 'Nouveau Goodie'."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map(({ campaign, goodies: campaignGoodies, stats: campaignStats }) => (
            <div key={campaign.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Campaign Header */}
              <button
                onClick={() => toggleCampaignExpand(campaign.id)}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-fuchsia-100 to-pink-100 rounded-xl flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-fuchsia-600" />
                  </div>
                  <div className="text-left">
                    <h2 className="font-bold text-foreground">{campaign.nom}</h2>
                    <p className="text-xs text-muted-foreground">
                      {campaign.entreprise_nom} • {campaignGoodies.length} goodie{campaignGoodies.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <span className="font-bold text-fuchsia-600">{campaignStats.totalStock}</span>
                      <p className="text-muted-foreground">Stock</p>
                    </div>
                    <div className="text-center">
                      <span className="font-bold text-emerald-600">{campaignStats.totalRestant}</span>
                      <p className="text-muted-foreground">Restant</p>
                    </div>
                    <div className="text-center">
                      <span className="font-bold text-blue-600">{campaignStats.totalDistribue}</span>
                      <p className="text-muted-foreground">Distribué</p>
                    </div>
                  </div>
                  {expandedCampaigns.has(campaign.id) ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Goodies List */}
              {expandedCampaigns.has(campaign.id) && (
                <div className="border-t border-slate-100">
                  {campaignGoodies.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Aucun goodie pour cette campagne
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {campaignGoodies.map(goodie => (
                        <div key={goodie.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-fuchsia-50 rounded-lg flex items-center justify-center shrink-0">
                              <Gift className="w-4 h-4 text-fuchsia-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{goodie.nom}</p>
                              {goodie.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{goodie.description}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 sm:gap-6">
                            {/* Stock info */}
                            <div className="hidden sm:flex items-center gap-3 text-xs">
                              <div className="text-center px-2">
                                <span className="font-bold text-fuchsia-600">{goodie.quantite_total}</span>
                                <p className="text-muted-foreground">Total</p>
                              </div>
                              <div className="text-center px-2">
                                <span className={cn(
                                  "font-bold",
                                  goodie.quantite_restante > 0 ? "text-emerald-600" : "text-slate-400"
                                )}>
                                  {goodie.quantite_restante}
                                </span>
                                <p className="text-muted-foreground">Restant</p>
                              </div>
                              <div className="text-center px-2">
                                <span className="font-bold text-blue-600">{goodie.quantite_distribuee}</span>
                                <p className="text-muted-foreground">Distribué</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(goodie)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(goodie.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
