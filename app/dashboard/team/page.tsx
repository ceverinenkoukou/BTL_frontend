"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import api, { invalidateCache } from "@/lib/api";
import type { RemoteUser, CreateUserPayload } from "@/lib/types/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Search, Users, UserCheck, UserX, Mail, ShieldCheck,
  Clock, Edit2, Trash2, X, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RoleFilter = "all" | "Hotesse" | "Superviseur";

const ROLE_CFG = {
  Hotesse:     { label: "Hôtesse",     bg: "bg-rose-100 text-rose-700 border-rose-200",     avatar: "from-rose-400 to-pink-500" },
  Superviseur: { label: "Superviseur", bg: "bg-indigo-100 text-indigo-700 border-indigo-200", avatar: "from-indigo-500 to-blue-500" },
};

const EMPTY_FORM: CreateUserPayload = { email: "", name: "", role: "Hotesse", username: "" };

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function TeamPage() {
  const [members, setMembers]     = useState<RemoteUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  // Dialog
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editing, setEditing]             = useState<RemoteUser | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [form, setForm]                   = useState<CreateUserPayload>({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<RemoteUser[] | { results: RemoteUser[] }>("/users/");
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setMembers(list.filter(u => u.role === "Hotesse" || u.role === "Superviseur"));
    } catch {
      toast.error("Erreur lors du chargement de l'équipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (member: RemoteUser) => {
    setEditing(member);
    setForm({ email: member.email, name: member.name, role: member.role as "Hotesse" | "Superviseur", username: member.username ?? "" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.name.trim()) {
      toast.error("Nom et email sont requis.");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const { data: updated } = await api.patch<RemoteUser>(`/users/${editing.id}/`, {
          name: form.name.trim(),
          username: form.username?.trim() || undefined,
        });
        setMembers(prev => prev.map(m => m.id === editing.id ? updated : m));
        toast.success("Membre mis à jour.");
      } else {
        const payload: CreateUserPayload = {
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
          username: form.username?.trim() || undefined,
        };
        const { data: created } = await api.post<RemoteUser>("/users/", payload);
        setMembers(prev => [created, ...prev]);
        invalidateCache("/users");
        toast.success(`${ROLE_CFG[form.role].label} créé(e). Identifiants envoyés par email.`);
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string; email?: string[] } } })?.response?.data;
      toast.error(msg?.detail ?? msg?.email?.[0] ?? "Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (member: RemoteUser) => {
    try {
      const { data: updated } = await api.patch<RemoteUser>(`/users/${member.id}/`, { is_active: !member.is_active });
      setMembers(prev => prev.map(m => m.id === member.id ? updated : m));
      toast.success(updated.is_active ? "Compte réactivé." : "Compte désactivé.");
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/users/${id}/`);
      setMembers(prev => prev.filter(m => m.id !== id));
      setDeleteConfirm(null);
      toast.success("Membre supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const hotesses     = members.filter(m => m.role === "Hotesse");
  const superviseurs = members.filter(m => m.role === "Superviseur");
  const actifs       = members.filter(m => m.is_active).length;

  const filtered = members.filter(m => {
    const matchRole = roleFilter === "all" || m.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const kpis = [
    { label: "Hôtesses",     value: hotesses.length,     icon: "👩", color: "from-rose-500 to-pink-400" },
    { label: "Superviseurs",  value: superviseurs.length,  icon: "👔", color: "from-indigo-500 to-blue-400" },
    { label: "Actifs",        value: actifs,               icon: "✅", color: "from-emerald-500 to-teal-400" },
    { label: "Inactifs",      value: members.length - actifs, icon: "⏸", color: "from-slate-400 to-slate-300" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#006776] via-teal-600 to-[#00899b] p-6 md:p-8 text-white shadow-2xl shadow-teal-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-yellow-200" />
              <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Administration</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Équipe terrain</h1>
            <p className="text-white/70 mt-1 text-sm">Gérez vos hôtesses et superviseurs</p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm w-fit shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />Nouveau membre
          </Button>
        </div>
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-base mb-0.5">{k.icon}</div>
              <div className="text-xl font-bold">{k.value}</div>
              <div className="text-xs text-white/65">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          {(["all", "Hotesse", "Superviseur"] as RoleFilter[]).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all border",
                roleFilter === r
                  ? "bg-[#006776] text-white border-[#006776] shadow-sm"
                  : "bg-white text-muted-foreground border-slate-200 hover:border-slate-300"
              )}
            >
              {r === "all" ? "Tous" : r === "Hotesse" ? "Hôtesses" : "Superviseurs"}
              <span className={cn("ml-1.5 text-xs px-1.5 py-0.5 rounded-full", roleFilter === r ? "bg-white/25" : "bg-slate-100")}>
                {r === "all" ? members.length : r === "Hotesse" ? hotesses.length : superviseurs.length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={searchRef}
            className="flex h-9 w-64 rounded-xl border border-input bg-white px-3 pl-9 text-sm shadow-sm"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-slate-50 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-slate-300" />
          </div>
          <p className="font-semibold text-foreground mb-1">Aucun membre trouvé</p>
          <p className="text-xs text-muted-foreground mb-4">
            {search ? "Essayez un autre terme de recherche." : "Commencez par créer un membre de l'équipe."}
          </p>
          {!search && (
            <Button onClick={openCreate} className="bg-[#006776] hover:bg-[#00566a] text-white rounded-xl">
              <Plus className="w-4 h-4 mr-2" />Créer un membre
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(member => {
            const cfg = ROLE_CFG[member.role as keyof typeof ROLE_CFG];
            return (
              <div key={member.id} className={cn(
                "bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden",
                member.is_active ? "border-slate-100" : "border-slate-200 opacity-70"
              )}>
                {/* Top strip */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${cfg?.avatar ?? "from-slate-400 to-slate-300"}`} />

                <div className="p-4 flex items-start gap-3">
                  {/* Avatar */}
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm bg-gradient-to-br",
                    cfg?.avatar ?? "from-slate-400 to-slate-300"
                  )}>
                    {initials(member.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{member.name}</p>
                      {!member.is_active && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">Inactif</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3 shrink-0" />{member.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", cfg?.bg)}>
                        {cfg?.label}
                      </span>
                      {member.is_password_changed ? (
                        <span className="text-xs flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <ShieldCheck className="w-3 h-3" />Connecté
                        </span>
                      ) : (
                        <span className="text-xs flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <Clock className="w-3 h-3" />En attente
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex items-center gap-2 border-t border-slate-50 pt-3">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => openEdit(member)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />Modifier
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    className={cn("flex-1 rounded-xl text-xs", member.is_active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")}
                    onClick={() => handleToggleActive(member)}
                  >
                    {member.is_active
                      ? <><UserX className="w-3.5 h-3.5 mr-1.5" />Désactiver</>
                      : <><UserCheck className="w-3.5 h-3.5 mr-1.5" />Réactiver</>
                    }
                  </Button>
                  {deleteConfirm === member.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="rounded-xl text-xs px-2.5" onClick={() => handleDelete(member.id)}>
                        Confirmer
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl text-xs px-2" onClick={() => setDeleteConfirm(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 px-2.5" onClick={() => setDeleteConfirm(member.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#006776] to-[#00899b] flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              {editing ? "Modifier le membre" : "Nouveau membre"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Role — only on create */}
            {!editing && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rôle *</Label>
                <Select
                  value={form.role}
                  onValueChange={v => setForm(f => ({ ...f, role: v as "Hotesse" | "Superviseur" }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hotesse">Hôtesse</SelectItem>
                    <SelectItem value="Superviseur">Superviseur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tm-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nom complet *</Label>
              <Input
                id="tm-name"
                placeholder="Ex: Marie Dupont"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email *{!editing && <span className="ml-1 text-muted-foreground font-normal normal-case">(les identifiants seront envoyés ici)</span>}
              </Label>
              <Input
                id="tm-email"
                type="email"
                placeholder="marie.dupont@exemple.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="rounded-xl"
                required
                disabled={!!editing}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tm-username" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nom d&apos;utilisateur <span className="font-normal normal-case text-muted-foreground">(optionnel)</span>
              </Label>
              <Input
                id="tm-username"
                placeholder="marie.dupont"
                value={form.username ?? ""}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            {!editing && (
              <p className="text-xs text-muted-foreground bg-slate-50 rounded-xl p-3 border border-slate-100">
                🔐 Un mot de passe provisoire sera généré automatiquement et envoyé par email au nouveau membre.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#006776] hover:bg-[#00566a] text-white"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                  : editing ? "Enregistrer" : `Créer ${form.role === "Hotesse" ? "l'hôtesse" : "le superviseur"}`
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
