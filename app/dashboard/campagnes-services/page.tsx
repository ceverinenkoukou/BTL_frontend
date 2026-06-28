"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import {
  getCampagnesServices, createCampagneService,
} from "@/lib/services/campagneServiceService";
import { getEntreprises } from "@/lib/services/entrepriseService";
import { getSites } from "@/lib/services/siteService";
import { getUsers } from "@/lib/services/userService";
import type {
  CampagneServiceList, CreateCampagneServicePayload, Entreprise, SiteList, RemoteUser, TypeCampagneService,
} from "@/lib/types/backend";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Headset, Loader2 } from "lucide-react";

const EMPTY_FORM: CreateCampagneServicePayload = {
  nom: "",
  entreprise: "",
  type_campagne_service: "SONDAGE",
  description: "",
  date_debut: "",
  date_fin: "",
  sites: [],
  hotesses: [],
  superviseurs: [],
  campagne_produit_liee: null,
};

const TYPE_OPTIONS: { value: TypeCampagneService; label: string }[] = [
  { value: "SONDAGE", label: "Sondage / vérification de souscription" },
];

export default function CampagnesServicesPage() {
  const { user } = useAuth();
  const [campagnes, setCampagnes] = useState<CampagneServiceList[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [hotesses, setHotesses] = useState<RemoteUser[]>([]);
  const [superviseurs, setSuperviseurs] = useState<RemoteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateCampagneServicePayload>({ ...EMPTY_FORM });

  const isAdmin = user?.role === "Administrateur";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [camps, ents, sitesRes, usersRes] = await Promise.all([
        getCampagnesServices(),
        getEntreprises(),
        getSites(),
        getUsers(),
      ]);
      setCampagnes(camps);
      setEntreprises(Array.isArray(ents) ? ents : ents.results ?? []);
      setSites(Array.isArray(sitesRes) ? sitesRes : sitesRes.results ?? []);
      const allUsers = Array.isArray(usersRes) ? usersRes : usersRes.results ?? [];
      setHotesses(allUsers.filter(u => u.role === "Hotesse"));
      setSuperviseurs(allUsers.filter(u => u.role === "Superviseur"));
    } catch {
      toast.error("Erreur lors du chargement des campagnes service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleInList = (list: string[] = [], id: string): string[] =>
    list.includes(id) ? list.filter(v => v !== id) : [...list, id];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom || !form.entreprise || !form.date_debut || !form.date_fin) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSaving(true);
    try {
      await createCampagneService(form);
      toast.success("Campagne service créée !");
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campagnes service"
        description="Promotion d'un service (application, forfait...) — indépendant des campagnes produit"
        icon={<Headset className="w-5 h-5" />}
        ctaSlot={isAdmin ? (
          <Button onClick={() => setDialogOpen(true)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm">
            <Plus className="w-4 h-4 mr-2" />Nouvelle campagne service
          </Button>
        ) : undefined}
      />

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-slate-50 rounded-2xl animate-pulse" />)}
        </div>
      ) : campagnes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <Headset className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Aucune campagne service</p>
          <p className="text-xs text-muted-foreground">Créez-en une pour commencer.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campagnes.map(c => (
            <Link key={c.id} href={`/dashboard/campagnes-services/${c.id}`}>
              <Card className="hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground truncate">{c.nom}</p>
                    {!c.is_active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">Inactive</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.entreprise_nom}</p>
                  <p className="text-xs text-violet-600 font-medium">{c.type_campagne_service_display}</p>
                  {c.campagne_produit_liee_nom && (
                    <p className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-2 py-1">
                      Croisée avec : {c.campagne_produit_liee_nom}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span>{c.nb_sites} site{c.nb_sites > 1 ? "s" : ""}</span>
                    <span>{c.nb_hotesses} hôtesse{c.nb_hotesses > 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle campagne service</DialogTitle>
            <DialogDescription>Promotion d&apos;un service (pas de produit physique)</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Entreprise *</Label>
              <Select value={form.entreprise} onValueChange={v => setForm(f => ({ ...f, entreprise: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {entreprises.map(e => <SelectItem key={e.id} value={e.id}>{e.nom_commercial}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type_campagne_service} onValueChange={v => setForm(f => ({ ...f, type_campagne_service: v as TypeCampagneService }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin *</Label>
                <Input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description ?? ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optionnel" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sites</Label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                {sites.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <Checkbox checked={(form.sites ?? []).includes(s.id)} onCheckedChange={() => setForm(f => ({ ...f, sites: toggleInList(f.sites, s.id) }))} />
                    {s.nom}
                  </label>
                ))}
                {sites.length === 0 && <p className="text-xs text-muted-foreground p-1">Aucun site.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Hôtesses</Label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                {hotesses.map(h => (
                  <label key={h.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <Checkbox checked={(form.hotesses ?? []).includes(h.id)} onCheckedChange={() => setForm(f => ({ ...f, hotesses: toggleInList(f.hotesses, h.id) }))} />
                    {h.name}
                  </label>
                ))}
                {hotesses.length === 0 && <p className="text-xs text-muted-foreground p-1">Aucune hôtesse.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Superviseurs</Label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                {superviseurs.map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <Checkbox checked={(form.superviseurs ?? []).includes(s.id)} onCheckedChange={() => setForm(f => ({ ...f, superviseurs: toggleInList(f.superviseurs, s.id) }))} />
                    {s.name}
                  </label>
                ))}
                {superviseurs.length === 0 && <p className="text-xs text-muted-foreground p-1">Aucun superviseur.</p>}
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer la campagne service"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
