"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { FileText, Loader2, Search, RefreshCw, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import type { RapportJournalier, SiteList, CampagneList } from "@/lib/types/backend";
import { getRapports, genererRapports } from "@/lib/services/rapportService";

function fmtXOF(val: string | number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "XOF", maximumFractionDigits: 0,
  }).format(Number(val));
}

function unwrapList<T>(data: T[] | { results?: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export default function RapportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Administrateur";

  const [rapports, setRapports] = useState<RapportJournalier[]>([]);
  const [sites, setSites] = useState<SiteList[]>([]);
  const [campagnes, setCampagnes] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSite, setFilterSite] = useState("all");
  const [filterCampagne, setFilterCampagne] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [genDate, setGenDate] = useState(new Date().toISOString().slice(0, 10));

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Rapports journaliers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rapports.length} rapport{rapports.length !== 1 ? "s" : ""} générés
          </p>
        </div>
      </div>

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
              Générer et envoyer les emails
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
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Dégustations</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Ventes</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Goodies</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">CA</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Email</th>
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
                    {fmtXOF(r.chiffre_affaires)}
                  </td>
                  <td className="px-4 py-3">
                    {r.email_envoye
                      ? <MailCheck className="w-4 h-4 text-emerald-500 mx-auto" />
                      : <Mail className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
