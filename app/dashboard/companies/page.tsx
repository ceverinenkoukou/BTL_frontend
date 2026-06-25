"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api, { invalidateCache } from "@/lib/api";
import type { Entreprise, CreateEntreprisePayload, Produit } from "@/lib/types/backend";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Plus, Package, Mail, Phone, MapPin,
  Trash2, Edit2, ChevronRight, ChevronLeft, X, Check,
  Palette, Upload, Loader2, Send, KeyRound, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";

type ProductEntry = {
  existingId?:     string;                  // id du produit existant (édition)
  name:           string;
  description:    string;
  modes:          ("UNITE" | "PACK")[];   // au moins un requis
  prix_unite:      string;                  // prix détail/unité
  quantite_unite:  string;                  // quantité vendue (ex: 1, 6, 12…)
  prix_pack:       string;                  // prix du pack
  items_par_pack:  string;                  // nb d'items dans le pack (optionnel)
};
const EMPTY_PRODUCT: ProductEntry = {
  name: "", description: "",
  modes: ["UNITE"],
  prix_unite: "", quantite_unite: "", prix_pack: "", items_par_pack: "",
};

const isLight = (hex: string) => {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
};


export default function CompaniesPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Entreprise[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [step, setStep]                   = useState<1 | 2>(1);
  const [editingCompany, setEditingCompany] = useState<Entreprise | null>(null);
  const [sendNewPassword, setSendNewPassword] = useState(false);
  const [resendingId, setResendingId]     = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entreprise | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Step-1 fields
  const [cName,     setCName]     = useState("");
  const [cAddress,  setCAddress]  = useState("");
  const [cEmail,    setCEmail]    = useState("");
  const [cPhone,    setCPhone]    = useState("");
  const [cLogoUrl,  setCLogoUrl]  = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cColor1,   setCColor1]   = useState("#006776");
  const [cColor2,   setCColor2]   = useState("#00899b");

  // Step-2 fields
  const [entries, setEntries] = useState<ProductEntry[]>([{ ...EMPTY_PRODUCT }]);

  const updateEntry = (i: number, patch: Partial<ProductEntry>) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));

  const toggleMode = (i: number, mode: "UNITE" | "PACK") =>
    setEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      const has = e.modes.includes(mode);
      if (has && e.modes.length === 1) return e; // always keep at least one
      return { ...e, modes: has ? e.modes.filter(m => m !== mode) : [...e.modes, mode] };
    }));


  // ── Fetch companies from API ────────────────────────────────
  const fetchCompanies = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get<Entreprise[] | { results: Entreprise[] }>("/entreprises/");
      setCompanies(Array.isArray(data) ? data : (data.results ?? []));
    } catch {
      toast.error("Impossible de charger les entreprises.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // ── Computed ─────────────────────────────────────────────────
  const list = Array.isArray(companies) ? companies : [];
  const kpis = useMemo(() => ({
    companies: list.length,
    products:  list.reduce((sum, c) => sum + (c.produits?.length ?? 0), 0),
  }), [list]);

  // ── Helpers ───────────────────────────────────────────────────
  const initials = (s: string) => s.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const resetForm = () => {
    setCName(""); setCAddress(""); setCEmail(""); setCPhone("");
    setCLogoUrl(""); setCColor1("#006776"); setCColor2("#00899b");
    setEntries([{ ...EMPTY_PRODUCT }]);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleLogoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setCLogoUrl(e.target?.result as string ?? "");
    reader.readAsDataURL(file);
  };

  // ── Dialog open helpers ──────────────────────────────────────
  const openCreate = () => {
    setEditingCompany(null);
    resetForm();
    setStep(1);
    setDialogOpen(true);
  };

  const openEdit = (company: Entreprise) => {
    setEditingCompany(company);
    setCName(company.nom_commercial);
    setCAddress(company.adresse ?? "");
    setCEmail(company.email ?? "");
    setCPhone(company.telephone ?? "");
    setCLogoUrl(company.logo_url ?? "");
    setCColor1(company.couleur_primaire ?? "#006776");
    setCColor2(company.couleur_secondaire ?? "#00899b");
    // Pré-remplir avec les produits existants + une ligne vide pour ajouter
    const existingEntries: ProductEntry[] = company.produits.map(p => ({
      existingId: p.id,
      name: p.nom,
      description: p.description ?? "",
      modes: [p.type_conditionnement as "UNITE" | "PACK"],
      prix_unite: p.type_conditionnement === "UNITE" ? (p.prix_indicatif ?? "") : "",
      quantite_unite: "",
      prix_pack: p.type_conditionnement === "PACK" ? (p.prix_indicatif ?? "") : "",
      items_par_pack: "",
    }));
    setEntries([...existingEntries, { ...EMPTY_PRODUCT }]);
    setSendNewPassword(false);
    setStep(1);
    setDialogOpen(true);
  };

  const handleResendCredentials = async (company: Entreprise) => {
    if (!confirm(`Générer et envoyer un nouveau mot de passe à ${company.email} ?`)) return;
    setResendingId(company.id);
    try {
      const { data } = await api.post<{ detail: string; email_sent: boolean }>(
        `/entreprises/${company.id}/resend-credentials/`
      );
      if (data.email_sent) {
        toast.success(`Nouveaux identifiants envoyés à ${company.email}.`);
      } else {
        toast.warning("Mot de passe régénéré mais l'email n'a pas pu être envoyé. Vérifiez la configuration SMTP.");
      }
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, is_password_changed: false } : c));
    } catch {
      toast.error("Erreur lors du renvoi des identifiants.");
    } finally {
      setResendingId(null);
    }
  };

  // ── Actions ──────────────────────────────────────────────────
  const handleDelete = (company: Entreprise) => {
    setDeleteTarget(company);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/entreprises/${deleteTarget.id}/`);
      setCompanies(prev => prev.filter(c => c.id !== deleteTarget.id));
      invalidateCache("/entreprises");
      toast.success(`Entreprise "${deleteTarget.nom_commercial}" supprimée définitivement.`);
      setDeleteTarget(null);
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const handleStep1Next = () => {
    if (!cName.trim()) { toast.error("Le nom de l'entreprise est requis"); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!cName.trim() || !cEmail.trim()) {
      toast.error("Nom et email sont requis.");
      return;
    }
    setSubmitting(true);
    try {
      const validProducts = entries
        .filter(e => e.name.trim())
        .flatMap(e => e.modes.map(mode => ({
          nom: e.name.trim(),
          type_conditionnement: mode,
          description: [
            e.description.trim(),
            mode === "UNITE" && e.quantite_unite ? `${e.quantite_unite} unité(s)` : "",
            mode === "PACK"  && e.items_par_pack  ? `${e.items_par_pack} unités/pack`  : "",
          ].filter(Boolean).join(" — ") || undefined,
          prix_indicatif: mode === "UNITE"
            ? parseFloat(e.prix_unite) || undefined
            : parseFloat(e.prix_pack)  || undefined,
        })));

      if (editingCompany) {
        const payload = {
          nom_commercial:    cName.trim(),
          adresse:           cAddress.trim() || undefined,
          telephone:         cPhone.trim()   || undefined,
          couleur_primaire:  cColor1,
          couleur_secondaire: cColor2,
          logo_url:          cLogoUrl.trim() || undefined,
        };
        const { data: updated } = await api.patch<Entreprise>(`/entreprises/${editingCompany.id}/`, payload);

        // Mettre à jour les produits existants modifiés
        const existingProducts = entries.filter(e => e.existingId && e.name.trim());
        const updatedProduits: Produit[] = [];
        for (const e of existingProducts) {
          const mode = e.modes[0];
          const { data: p } = await api.patch<Produit>(`/produits/${e.existingId}/`, {
            nom: e.name.trim(),
            type_conditionnement: mode,
            description: e.description.trim() || undefined,
            prix_indicatif: mode === "UNITE"
              ? parseFloat(e.prix_unite) || undefined
              : parseFloat(e.prix_pack) || undefined,
          });
          updatedProduits.push(p);
        }

        // Créer les nouveaux produits (sans existingId)
        const newProducts = entries.filter(e => !e.existingId && e.name.trim());
        const createdProduits: Produit[] = [];
        for (const e of newProducts) {
          for (const mode of e.modes) {
            const { data: p } = await api.post<Produit>("/produits/", {
              nom: e.name.trim(),
              entreprise: editingCompany.id,
              type_conditionnement: mode,
              description: e.description.trim() || undefined,
              prix_indicatif: mode === "UNITE"
                ? parseFloat(e.prix_unite) || undefined
                : parseFloat(e.prix_pack) || undefined,
            });
            createdProduits.push(p);
          }
        }

        // Mettre à jour l'état local : produits existants remplacés par leur version
        // modifiée (si modifiés), nouveaux produits ajoutés à la suite.
        const updatedWithProducts = {
          ...updated,
          produits: [
            ...updated.produits.map(p => updatedProduits.find(up => up.id === p.id) ?? p),
            ...createdProduits,
          ],
        };
        setCompanies(prev => prev.map(c => c.id === editingCompany.id ? updatedWithProducts : c));

        if (sendNewPassword) {
          try {
            const { data: resendData } = await api.post<{ detail: string; email_sent: boolean }>(
              `/entreprises/${editingCompany.id}/resend-credentials/`
            );
            if (resendData.email_sent) {
              toast.success(`Entreprise mise à jour. Nouveaux identifiants envoyés à ${editingCompany.email}.`);
            } else {
              toast.warning("Entreprise mise à jour, mais l'email de mot de passe n'a pas pu être envoyé.");
            }
          } catch {
            toast.warning("Entreprise mise à jour, mais erreur lors de l'envoi du mot de passe.");
          }
        } else {
          const parts = [
            updatedProduits.length > 0 ? `${updatedProduits.length} produit(s) modifié(s)` : null,
            createdProduits.length   > 0 ? `${createdProduits.length} produit(s) ajouté(s)`   : null,
          ].filter(Boolean).join(", ");
          toast.success(parts ? `Entreprise mise à jour. ${parts}.` : "Entreprise mise à jour.");
        }
      } else {
        const payload: CreateEntreprisePayload = {
          email:             cEmail.trim(),
          nom_commercial:    cName.trim(),
          adresse:           cAddress.trim() || undefined,
          telephone:         cPhone.trim()   || undefined,
          couleur_primaire:  cColor1,
          couleur_secondaire: cColor2,
          logo_url:          cLogoUrl.trim() || undefined,
          produits:          validProducts.length ? validProducts : undefined,
        };
        const { data: created } = await api.post<Entreprise>("/entreprises/", payload);
        setCompanies(prev => [...prev, created]);
        invalidateCache("/entreprises");
        const productsMsg = validProducts.length ? ` avec ${validProducts.length} produit(s)` : "";
        if (created.email_sent === false) {
          toast.warning(
            `Entreprise créée${productsMsg}, mais l'e-mail d'identifiants n'a pas pu être envoyé. Vérifiez la configuration SMTP du serveur.`,
          );
        } else {
          toast.success(`Entreprise créée${productsMsg}. Un e-mail avec les identifiants a été envoyé à ${created.email}.`);
        }
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const addEntry    = () => setEntries(prev => [...prev, { ...EMPTY_PRODUCT }]);
  const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i));

  const handleDeleteProduct = async (companyId: string, productId: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    setDeletingProductId(productId);
    try {
      await api.delete(`/produits/${productId}/`);
      setCompanies(prev => prev.map(c =>
        c.id === companyId
          ? { ...c, produits: c.produits.filter(p => p.id !== productId) }
          : c
      ));
      toast.success("Produit supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression du produit.");
    } finally {
      setDeletingProductId(null);
    }
  };


  return (
    <div className="space-y-6">

      <PageHeader
        title="Entreprises"
        description="Gérez vos clients et leurs produits associés"
        icon={<Building2 className="w-5 h-5" />}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md">
        {[
          { icon: "🏢", label: "Entreprises", value: kpis.companies },
          { icon: "📦", label: "Produits",    value: kpis.products  },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3.5 py-3">
            <div className="text-base mb-1">{s.icon}</div>
            <div className="text-2xl font-bold leading-none text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {list.length} entreprise{list.length !== 1 ? "s" : ""} enregistrée{list.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={openCreate}
          className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md shadow-sky-200 font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle entreprise
        </Button>
      </div>

      {/* ── Company grid ── */}
      {loadingList ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-48 animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-8 h-8 text-sky-200" />
          </div>
          <p className="font-semibold text-foreground mb-1">Aucune entreprise</p>
          <p className="text-xs text-muted-foreground mb-4">Commencez par créer votre première entreprise</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer une entreprise
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {list.map(company => {
            const prods = company.produits;
            const primary  = company.couleur_primaire  || "#006776";
            const secondary = company.couleur_secondaire || "#00899b";
            const light    = isLight(primary);
            const textCls  = light ? "text-gray-900" : "text-white";
            const mutedCls = light ? "text-gray-600" : "text-white/60";
            return (
              <div key={company.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                {/* Card header — brand color */}
                <div className="relative p-5 overflow-hidden" style={{ backgroundColor: primary }}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 blur-xl" style={{ backgroundColor: secondary }} />
                  <div className={cn("flex items-start justify-between gap-3 relative z-10", textCls)}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 border border-white/30 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                        {company.logo_url
                          ? <img src={company.logo_url} alt={company.nom_commercial} className="w-full h-full object-contain p-1" />
                          : <span className="text-lg font-black">{initials(company.nom_commercial)}</span>}
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-base leading-tight truncate">{company.nom_commercial}</h2>
                        <p className={cn("text-xs mt-0.5", mutedCls)}>
                          {new Date(company.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleResendCredentials(company)}
                        disabled={resendingId === company.id}
                        className="w-7 h-7 bg-white/20 hover:bg-amber-500/80 rounded-lg flex items-center justify-center transition-colors"
                        title="Renvoyer les identifiants"
                      >
                        {resendingId === company.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Send className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => openEdit(company)} className="w-7 h-7 bg-white/20 hover:bg-white/35 rounded-lg flex items-center justify-center transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(company)} className="w-7 h-7 bg-white/20 hover:bg-red-500/80 rounded-lg flex items-center justify-center transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Badges + color swatches */}
                  <div className="flex items-center gap-2 mt-3 relative z-10">
                    <span className={cn("flex items-center gap-1 text-xs bg-white/20 border border-white/25 rounded-full px-2.5 py-0.5 font-semibold", textCls)}>
                      <Package className="w-3 h-3" />
                      {prods.length} produit{prods.length > 1 ? "s" : ""}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full border-2 border-white/40" style={{ backgroundColor: primary }} title="Couleur primaire" />
                      <div className="w-4 h-4 rounded-full border-2 border-white/40" style={{ backgroundColor: secondary }} title="Couleur secondaire" />
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="p-4 space-y-2">
                  {company.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                      <span className="truncate">{company.email}</span>
                    </div>
                  )}
                  {company.telephone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                      <span>{company.telephone}</span>
                    </div>
                  )}
                  {company.adresse && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-sky-400 mt-0.5" />
                      <span className="line-clamp-2">{company.adresse}</span>
                    </div>
                  )}
                  {!company.email && !company.telephone && !company.adresse && (
                    <p className="text-xs text-muted-foreground/50 italic">Aucune information de contact</p>
                  )}
                </div>

                {/* Products list */}
                <div className="border-t border-slate-50 px-4 pt-3 pb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Produits</p>
                  {prods.length > 0 ? (
                    <div className="space-y-1.5 mb-3">
                      {prods.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 group/prod">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 bg-sky-50 rounded-md flex items-center justify-center shrink-0">
                              <Package className="w-3 h-3 text-sky-500" />
                            </div>
                            <span className="text-xs font-medium text-foreground truncate">{p.nom}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {p.prix_indicatif && (
                              <span className="text-xs font-bold text-sky-700">
                                {Number(p.prix_indicatif).toLocaleString("fr-FR")} F
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteProduct(company.id, p.id)}
                              disabled={deletingProductId === p.id}
                              className="w-5 h-5 rounded-md bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-colors opacity-0 group-hover/prod:opacity-100"
                              title="Supprimer ce produit"
                            >
                              {deletingProductId === p.id
                                ? <Loader2 className="w-2.5 h-2.5 text-rose-500 animate-spin" />
                                : <Trash2 className="w-2.5 h-2.5 text-rose-500" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic mb-3">Aucun produit encore</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* ── Multi-step Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">

          {/* Dialog header */}
          <div className={cn(
            "relative overflow-hidden p-6 text-white",
            "bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600"
          )}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <DialogHeader className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    {step === 1 ? <Building2 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  </div>
                  <DialogTitle className="text-white text-base font-bold">
                    {editingCompany ? "Modifier l'entreprise" : step === 1 ? "Nouvelle entreprise" : `Produits de ${cName}`}
                  </DialogTitle>
                </div>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="w-7 h-7 bg-white/20 hover:bg-white/35 rounded-lg flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mt-3">
                {[1, 2].map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2",
                      step === s ? "bg-white text-sky-700 border-white" :
                      step > s   ? "bg-white/30 border-white/50 text-white" :
                                    "bg-white/10 border-white/30 text-white/50")}>
                      {step > s ? <Check className="w-3 h-3" /> : s}
                    </div>
                    <span className={cn("text-xs", step === s ? "text-white font-semibold" : "text-white/50")}>
                      {s === 1 ? "Entreprise" : "Produits"}
                    </span>
                    {s < 2 && <div className="w-6 h-px bg-white/30 ml-1" />}
                  </div>
                ))}
              </div>
            </DialogHeader>
          </div>

          {/* ── Step 1: Company info ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cname" className="text-sm font-semibold">Nom de l&apos;entreprise <span className="text-rose-500">*</span></Label>
                <Input
                  id="cname" placeholder="Ex: FreshUp Beverages"
                  value={cName} onChange={e => setCName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              {!editingCompany && (
                <div className="space-y-1.5">
                  <Label htmlFor="cemail" className="text-sm font-semibold">Email de connexion <span className="text-rose-500">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="cemail" type="email" placeholder="contact@entreprise.com"
                      value={cEmail} onChange={e => setCEmail(e.target.value)}
                      className="pl-9 rounded-xl"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Un mot de passe provisoire sera envoyé à cet email.</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cphone" className="text-sm font-semibold">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="cphone" placeholder="+241 01 23 45 67"
                    value={cPhone} onChange={e => setCPhone(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="caddress" className="text-sm font-semibold">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    id="caddress" placeholder="Libreville, Gabon"
                    value={cAddress} onChange={e => setCAddress(e.target.value)}
                    rows={2}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* ── Branding ── */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-slate-50/60">
                <div className="flex items-center gap-2 mb-1">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Identité visuelle</p>
                </div>

                {/* Logo upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Logo</Label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleLogoFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-sm text-muted-foreground transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {cLogoUrl ? "Changer le logo" : "Choisir un fichier"}
                    </button>
                    {cLogoUrl && (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cLogoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-contain border border-slate-200 bg-white p-0.5" />
                        <button type="button" onClick={() => { setCLogoUrl(""); if (logoInputRef.current) logoInputRef.current.value = ""; }} className="text-muted-foreground hover:text-rose-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ccolor1" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Couleur primaire</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="ccolor1" type="color"
                        value={cColor1} onChange={e => setCColor1(e.target.value)}
                        className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={cColor1}
                        onChange={e => setCColor1(e.target.value)}
                        placeholder="#006776"
                        className="rounded-xl text-sm font-mono flex-1"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ccolor2" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Couleur secondaire</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="ccolor2" type="color"
                        value={cColor2} onChange={e => setCColor2(e.target.value)}
                        className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={cColor2}
                        onChange={e => setCColor2(e.target.value)}
                        placeholder="#00899b"
                        className="rounded-xl text-sm font-mono flex-1"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <div className="h-8 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: cColor1, color: isLight(cColor1) ? "#111" : "#fff" }}>
                    {cName || "Nom de l’entreprise"}
                  </div>
                  <div className="h-4" style={{ backgroundColor: cColor2 }} />
                </div>
              </div>

              {editingCompany && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <div className="space-y-0.5">
                    <label htmlFor="send_new_password" className="text-xs font-bold text-amber-800 uppercase tracking-wide cursor-pointer flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      Envoyer un nouveau mot de passe
                    </label>
                    <p className="text-[10px] text-amber-600">Génère et envoie de nouveaux identifiants à {editingCompany.email}</p>
                  </div>
                  <input
                    id="send_new_password"
                    type="checkbox"
                    checked={sendNewPassword}
                    onChange={e => setSendNewPassword(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleStep1Next}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors"
                >
                  Suivant : Produits
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Products ── */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 text-xs text-sky-700">
                <span className="font-semibold">📦 Produits de {cName}</span> — {editingCompany ? "Modifiez les produits existants ou ajoutez-en de nouveaux." : "Ajoutez les produits liés à cette entreprise."}
              </div>

              {/* Produits existants (mode édition) */}
              {editingCompany && entries.some(e => e.existingId) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produits existants</p>
                  {entries.map((entry, i) => {
                    if (!entry.existingId) return null;
                    const priceField = entry.modes[0] === "PACK" ? "prix_pack" : "prix_unite";
                    return (
                      <div key={entry.existingId} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-1.5">
                            {([
                              { mode: "UNITE" as const, label: "Unité", icon: "🛍️" },
                              { mode: "PACK"  as const, label: "Pack",  icon: "📦" },
                            ]).map(({ mode, label, icon }) => {
                              const active = entry.modes[0] === mode;
                              return (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => updateEntry(i, { modes: [mode] })}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide transition-all",
                                    active
                                      ? "border-sky-500 bg-sky-100 text-sky-700"
                                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                                  )}
                                >
                                  <span>{icon}</span>{label}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => {
                              handleDeleteProduct(editingCompany.id, entry.existingId!);
                              setEntries(prev => prev.filter(e => e.existingId !== entry.existingId));
                            }}
                            disabled={deletingProductId === entry.existingId}
                            className="w-5 h-5 rounded-md bg-rose-100 hover:bg-rose-200 flex items-center justify-center transition-colors"
                            title="Supprimer ce produit"
                          >
                            {deletingProductId === entry.existingId
                              ? <Loader2 className="w-3 h-3 text-rose-600 animate-spin" />
                              : <X className="w-3 h-3 text-rose-600" />}
                          </button>
                        </div>
                        <div className="space-y-2">
                          <Input
                            placeholder="Nom du produit *"
                            value={entry.name}
                            onChange={e => updateEntry(i, { name: e.target.value })}
                            className="rounded-lg text-sm h-8 bg-white"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder={entry.modes[0] === "PACK" ? "Prix du pack (F CFA)" : "Prix unitaire (F CFA)"}
                              type="number" min="0"
                              value={entry[priceField]}
                              onChange={e => updateEntry(i, { [priceField]: e.target.value } as Partial<ProductEntry>)}
                              className="rounded-lg text-sm h-8 bg-white"
                            />
                            <Input
                              placeholder="Description (optionnel)"
                              value={entry.description}
                              onChange={e => updateEntry(i, { description: e.target.value })}
                              className="rounded-lg text-sm h-8 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Nouveaux produits à ajouter */}
              {editingCompany && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ajouter des produits</p>}

              {/* Product rows */}
              <div className="space-y-3">
                {entries.filter(e => !e.existingId).map((entry, relIdx) => {
                  const i = entries.findIndex(e => e === entry);
                  return (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">Nouveau produit {relIdx + 1}</span>
                      {entries.filter(e => !e.existingId).length > 1 && (
                        <button onClick={() => removeEntry(i)} className="w-5 h-5 rounded-md bg-rose-100 hover:bg-rose-200 flex items-center justify-center transition-colors">
                          <X className="w-3 h-3 text-rose-600" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      {/* Nom */}
                      <Input
                        placeholder="Nom du produit *"
                        value={entry.name}
                        onChange={e => updateEntry(i, { name: e.target.value })}
                        className="rounded-lg text-sm h-8"
                      />

                      {/* Mode de vente */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Mode de vente</p>
                        <div className="flex gap-2">
                          {([
                            { mode: "UNITE" as const, label: "Détail / Unité", icon: "🛍️" },
                            { mode: "PACK"  as const, label: "Pack",           icon: "📦" },
                          ]).map(({ mode, label, icon }) => {
                            const active = entry.modes.includes(mode);
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => toggleMode(i, mode)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all",
                                  active
                                    ? "border-sky-500 bg-sky-50 text-sky-700"
                                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                                )}
                              >
                                <span>{icon}</span>{label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Champs conditionnels */}
                      <div className="space-y-2">
                        {entry.modes.includes("UNITE") && (
                          <div className="rounded-lg bg-white border border-sky-100 p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wide">Détail / Unité</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Quantité (ex : 1, 6, 12…)"
                                type="number" min="1"
                                value={entry.quantite_unite}
                                onChange={e => updateEntry(i, { quantite_unite: e.target.value })}
                                className="rounded-lg text-sm h-8"
                              />
                              <Input
                                placeholder="Prix unitaire (F CFA)"
                                type="number" min="0"
                                value={entry.prix_unite}
                                onChange={e => updateEntry(i, { prix_unite: e.target.value })}
                                className="rounded-lg text-sm h-8"
                              />
                            </div>
                          </div>
                        )}
                        {entry.modes.includes("PACK") && (
                          <div className="rounded-lg bg-white border border-amber-100 p-2.5 space-y-1.5">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Pack</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Prix du pack (F CFA)"
                                type="number" min="0"
                                value={entry.prix_pack}
                                onChange={e => updateEntry(i, { prix_pack: e.target.value })}
                                className="rounded-lg text-sm h-8"
                              />
                              <Input
                                placeholder="Nb d'items / pack (optionnel)"
                                type="number" min="1"
                                value={entry.items_par_pack}
                                onChange={e => updateEntry(i, { items_par_pack: e.target.value })}
                                className="rounded-lg text-sm h-8"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <Input
                        placeholder="Description (optionnel)"
                        value={entry.description}
                        onChange={e => updateEntry(i, { description: e.target.value })}
                        className="rounded-lg text-sm h-8"
                      />
                    </div>
                  </div>
                  );
                })}
              </div>

              <button
                onClick={addEntry}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-sky-200 hover:border-sky-400 text-sky-600 hover:text-sky-700 text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter un autre produit
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-muted-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-md shadow-sky-200"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingCompany ? "Enregistrer" : "Créer l'entreprise"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-rose-600 to-red-700 p-6 text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-bold">Supprimer définitivement</DialogTitle>
                <p className="text-white/70 text-xs mt-0.5">Cette action est irréversible</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-foreground font-medium">
              Voulez-vous supprimer l&apos;entreprise{" "}
              <span className="font-bold text-rose-600">{deleteTarget?.nom_commercial}</span> ?
            </p>

            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 space-y-2">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-2">Données supprimées :</p>
              {[
                "Toutes les campagnes et sites",
                "Toutes les dégustations, ventes et rapports",
                "Tous les goodies et stocks",
                "Tous les produits",
                "Le compte utilisateur de l'entreprise",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-rose-800">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-muted-foreground transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold transition-colors shadow-md shadow-rose-200"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
