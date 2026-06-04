"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { CampagneList, Entreprise } from "@/lib/types/backend";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Gift, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function GoodiesPage() {
  const { user } = useAuth();
  const [campaigns,   setCampaigns]   = useState<CampagneList[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, entRes] = await Promise.all([
        api.get<CampagneList[]>("/campagnes/"),
        api.get<Entreprise[]>("/entreprises/"),
      ]);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []));
      setEntreprises(Array.isArray(entRes.data) ? entRes.data : ((entRes.data as { results?: Entreprise[] }).results ?? []));
    } catch {
      toast.error("Impossible de charger les données goodies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getStatut = (c: CampagneList) => {
    const now = new Date();
    if (new Date(c.date_debut) > now) return "Planifiée";
    if (new Date(c.date_fin) < now) return "Terminée";
    return "En cours";
  };

  const companyGroups = useMemo(() => {
    const filtered = selectedCompany === "all"
      ? campaigns
      : campaigns.filter(c => {
          const ent = entreprises.find(e => e.id === selectedCompany);
          return ent ? c.entreprise_nom === ent.nom_commercial : true;
        });
    const map = new Map<string, { nom: string; id: string; campaigns: CampagneList[] }>();
    filtered.forEach(c => {
      if (!map.has(c.entreprise_nom)) map.set(c.entreprise_nom, { nom: c.entreprise_nom, id: c.entreprise_nom, campaigns: [] });
      map.get(c.entreprise_nom)!.campaigns.push(c);
    });
    return [...map.values()];
  }, [campaigns, entreprises, selectedCompany]);

  return (
    <div className="space-y-6">

      {/* ── Hero banner — Fuchsia/Pink ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-600 via-pink-500 to-rose-400 text-white shadow-2xl shadow-fuchsia-200">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_65%)]" />
        <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-32 -bottom-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Goodies gagnés</h1>
              </div>
              <p className="text-white/65 text-sm ml-12">Suivi des goodies distribués par entreprise et campagne</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-44 bg-white/20 border-white/30 text-white rounded-xl text-sm [&>svg]:text-white">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les entreprises</SelectItem>
                  {entreprises.map(e => <SelectItem key={e.id} value={e.id}>{e.nom_commercial}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI chips */}
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            {[
              { icon: "🎁", label: "Campagnes",    value: campaigns.length,    sub: "" },
              { icon: "🏢", label: "Entreprises",  value: entreprises.length,  sub: "" },
            ].map((s, i) => (
              <div key={i} className="bg-white/18 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                <div className="text-base mb-1">{s.icon}</div>
                <div className="text-xl font-bold leading-none">
                  {s.value}
                  {s.sub && <span className="text-xs font-normal text-white/55 ml-1">{s.sub}</span>}
                </div>
                <div className="text-xs text-white/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Company sections ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
        </div>
      ) : companyGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Gift className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Aucune donnée</p>
          <p className="text-xs text-muted-foreground">Aucune campagne trouvée</p>
        </div>
      ) : (
        <div className="space-y-5">
          {companyGroups.map(({ nom, id, campaigns: cmpList }) => (
            <div key={id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Company header */}
              <div className="bg-gradient-to-r from-fuchsia-50 via-pink-50 to-rose-50 border-b border-fuchsia-100 px-5 py-4 flex items-center gap-4">
                <div className="w-11 h-11 bg-fuchsia-100 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-fuchsia-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-foreground truncate">{nom}</h2>
                  <p className="text-xs text-muted-foreground">
                    {cmpList.length} campagne{cmpList.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              {/* Campaigns */}
              <div className="divide-y divide-slate-50">
                {cmpList.map(campaign => (
                  <div key={campaign.id} className="p-5">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-fuchsia-400 rounded-full" />
                        <span className="font-semibold text-sm text-foreground">{campaign.nom}</span>
                      </div>
                      <span className={cn(
                        "text-xs px-2.5 py-0.5 rounded-full font-semibold border",
                        getStatut(campaign) === "En cours"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : getStatut(campaign) === "Terminée"
                          ? "bg-slate-50 text-slate-500 border-slate-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {getStatut(campaign)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-2.5 text-center">
                        <p className="text-lg font-black text-fuchsia-700">{campaign.nb_sites}</p>
                        <p className="text-xs text-muted-foreground">Sites</p>
                      </div>
                      <div className="rounded-xl border border-pink-100 bg-pink-50 p-2.5 text-center">
                        <p className="text-lg font-black text-pink-700">{campaign.nb_hotesses}</p>
                        <p className="text-xs text-muted-foreground">Hôtesses</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-3 italic">
                      Détail des goodies disponible par site dans la section Degustations.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
