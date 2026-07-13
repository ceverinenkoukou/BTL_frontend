"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings2, Save, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";
import { toast } from "sonner";
import type { RapportConfig, RapportConfigPayload } from "@/lib/types/backend";
import { DEFAULT_RAPPORT_CONFIG } from "@/lib/types/backend";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  onConfigChange?: (config: RapportConfig) => void;
};

type Section = {
  key: string;
  label: string;
  items: { field: keyof RapportConfigPayload; label: string; hint?: string }[];
};

const SECTIONS: Section[] = [
  {
    key: "kpis",
    label: "Indicateurs clés (KPI)",
    items: [
      { field: "show_kpi_degustations",    label: "Ventes" },
      { field: "show_kpi_ventes",          label: "Produits offerts" },
      { field: "show_kpi_ventes_hors_promo", label: "Ventes hors promo", hint: "Ventes qui ne déclenchent pas la mécanique promotionnelle" },
      { field: "show_kpi_ca",              label: "Chiffre d'affaires" },
      { field: "show_kpi_goodies",         label: "Goodies distribués" },
      { field: "show_kpi_sites",           label: "Nombre de sites actifs" },
      { field: "show_kpi_personnes_touchees", label: "Personnes touchées", hint: "Tous les clients ayant participé à la campagne" },
    ],
  },
  {
    key: "sections",
    label: "Sections du rapport",
    items: [
      { field: "show_section_offres_promo",       label: "Offres promotionnelles",                   hint: "Tableau des mécaniques promo (acheter X → recevoir Y)" },
      { field: "show_section_gains_goodies",      label: "Gains de goodies par site",               hint: "Récapitulatif des goodies et avantages par site" },
      { field: "show_section_perf_hotesses",      label: "Performance des hôtesses",                hint: "Rapport interne uniquement" },
      { field: "show_section_perf_sites",         label: "Performances par site",                   hint: "Classement et taux d'atteinte par site" },
      { field: "show_section_goodies_par_site",   label: "Goodies distribués par site — synthèse",  hint: "Tableau : goodies directs, offres promo, total avantages par site" },
      { field: "show_section_goodies_detail",     label: "Goodies distribués par site — détail par goodie", hint: "Tableau : Site / Goodie / Reçu / Gagné par les clients / Restant" },
      { field: "show_section_offres_par_hotesse", label: "Offres promotionnelles par hôtesse",      hint: "Rapport interne uniquement" },
      { field: "show_section_horaires_sites",     label: "Horaires d'ouverture des sites",          hint: "Horaires d'ouverture/fermeture des sites de la campagne" },
      { field: "show_section_stock_boissons",     label: "Boissons vendues / gratuites par jour",   hint: "Détail jour par jour et par site (peut être long)" },
      { field: "show_section_boissons_total",     label: "Total boissons reçues / offertes",        hint: "Récapitulatif par site sur toute la campagne, en canettes" },
      { field: "show_section_ugs_livraisons",     label: "UGs (goodies) reçus / distribués / restants", hint: "Par site, d'après les livraisons de goodies enregistrées" },
      { field: "show_section_graphiques",         label: "Graphiques de comparaison par site",      hint: "Diagrammes en barres colorés : ventes et dégustations par site" },
    ],
  },
  {
    key: "colonnes",
    label: "Colonnes des tableaux",
    items: [
      { field: "show_col_ca",           label: "Chiffre d'affaires (€ / XOF)" },
      { field: "show_col_goodies",      label: "Goodies" },
      { field: "show_col_promo_details", label: "Détails promo (offerts, tickets, tirages)" },
      { field: "show_col_performance",  label: "Taux de performance" },
    ],
  },
  {
    key: "detail_degustations",
    label: "Détail des dégustations (formulaire hôtesse)",
    items: [
      { field: "show_section_detail_degustations", label: "Inclure la section",                hint: "Tableau détaillé de chaque dégustation saisie par les hôtesses sur le terrain" },
      { field: "show_col_nom_client",              label: "Nom du client" },
      { field: "show_col_tranche_age",              label: "Tranche d'âge du client" },
      { field: "show_col_intention_achat",          label: "Intention d'achat" },
      { field: "inclure_notes_sensorielles",        label: "Notes de goût et d'ambiance",        hint: "Si activées sur la campagne" },
    ],
  },
  {
    key: "options",
    label: "Options générales",
    items: [
      { field: "show_logo",                  label: "Logo de l'entreprise",                     hint: "Affiché sur la page de couverture" },
      { field: "show_equipe_hotesses",       label: "Données individuelles des hôtesses",       hint: "Rapport interne" },
    ],
  },
];

export default function ReportConfigPanel({ campaignId, onConfigChange }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RapportConfig>({ ...DEFAULT_RAPPORT_CONFIG, campagne: campaignId });
  const [expandedSection, setExpandedSection] = useState<string | null>("kpis");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<RapportConfig | { detail: string; defaults: boolean }>(
        `/rapport-configs/par-campagne/?campagne=${campaignId}`
      );
      if ("defaults" in data && data.defaults) {
        setConfig({ ...DEFAULT_RAPPORT_CONFIG, campagne: campaignId });
      } else {
        setConfig(data as RapportConfig);
      }
    } catch {
      setConfig({ ...DEFAULT_RAPPORT_CONFIG, campagne: campaignId });
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const handleToggle = (field: keyof RapportConfigPayload) => {
    setConfig(prev => ({ ...prev, [field]: !prev[field as keyof RapportConfig] }));
  };

  const handleText = (field: "titre_personnalise" | "sous_titre_personnalise", value: string) => {
    setConfig(prev => ({ ...prev, [field]: value || null }));
  };

  const handleObservations = (value: string) => {
    setConfig(prev => ({ ...prev, observations_manuelles: value || null }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: RapportConfigPayload = {
        titre_personnalise: config.titre_personnalise,
        sous_titre_personnalise: config.sous_titre_personnalise,
        show_kpi_degustations: config.show_kpi_degustations,
        show_kpi_ventes: config.show_kpi_ventes,
        show_kpi_ventes_hors_promo: config.show_kpi_ventes_hors_promo,
        show_kpi_ca: config.show_kpi_ca,
        show_kpi_goodies: config.show_kpi_goodies,
        show_kpi_sites: config.show_kpi_sites,
        show_kpi_personnes_touchees: config.show_kpi_personnes_touchees,
        show_section_offres_promo: config.show_section_offres_promo,
        show_section_gains_goodies: config.show_section_gains_goodies,
        show_section_perf_hotesses: config.show_section_perf_hotesses,
        show_section_perf_sites: config.show_section_perf_sites,
        show_section_goodies_par_site: config.show_section_goodies_par_site,
        show_section_goodies_detail: config.show_section_goodies_detail,
        show_section_offres_par_hotesse: config.show_section_offres_par_hotesse,
        show_section_detail_degustations: config.show_section_detail_degustations,
        show_section_horaires_sites: config.show_section_horaires_sites,
        show_section_stock_boissons: config.show_section_stock_boissons,
        show_section_boissons_total: config.show_section_boissons_total,
        show_section_ugs_livraisons: config.show_section_ugs_livraisons,
        show_section_graphiques: config.show_section_graphiques,
        show_col_ca: config.show_col_ca,
        show_col_goodies: config.show_col_goodies,
        show_col_promo_details: config.show_col_promo_details,
        show_col_performance: config.show_col_performance,
        show_col_nom_client: config.show_col_nom_client,
        show_col_tranche_age: config.show_col_tranche_age,
        show_col_intention_achat: config.show_col_intention_achat,
        show_logo: config.show_logo,
        show_equipe_hotesses: config.show_equipe_hotesses,
        inclure_notes_sensorielles: config.inclure_notes_sensorielles,
        show_observations: config.show_observations,
        observations_manuelles: config.observations_manuelles,
      };
      const { data } = await api.patch<RapportConfig>(
        `/rapport-configs/par-campagne/?campagne=${campaignId}`,
        payload
      );
      setConfig(data);
      onConfigChange?.(data);
      toast.success("Configuration du rapport sauvegardée !");
    } catch {
      toast.error("Erreur lors de la sauvegarde de la configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Configuration du rapport PDF</p>
            <p className="text-xs text-slate-500 mt-0.5">Choisissez les sections et données à inclure</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="ml-2 text-sm text-slate-500">Chargement…</span>
            </div>
          ) : (
            <>
              {/* Titre personnalisé */}
              <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Personnalisation de la couverture</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Titre personnalisé</Label>
                    <Input
                      placeholder={`Nom de la campagne (défaut)`}
                      value={config.titre_personnalise ?? ""}
                      onChange={e => handleText("titre_personnalise", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Sous-titre</Label>
                    <Input
                      placeholder="Rapport de Campagne Promotionnelle (défaut)"
                      value={config.sous_titre_personnalise ?? ""}
                      onChange={e => handleText("sous_titre_personnalise", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Sections accordéon */}
              {SECTIONS.map(section => (
                <div key={section.key} className="border-b border-slate-100">
                  <button
                    onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{section.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {section.items.filter(i => config[i.field as keyof RapportConfig] as boolean).length}/{section.items.length} actifs
                      </span>
                      {expandedSection === section.key
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </button>

                  {expandedSection === section.key && (
                    <div className="px-5 pb-4 space-y-3">
                      {section.items.map(item => (
                        <div key={item.field} className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">{item.label}</p>
                            {item.hint && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <Info className="w-3 h-3 flex-shrink-0" /> {item.hint}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={!!config[item.field as keyof RapportConfig]}
                            onCheckedChange={() => handleToggle(item.field)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Observations manuelles */}
              <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Observations manuelles</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Info className="w-3 h-3 flex-shrink-0" /> Notes libres du superviseur, affichées dans le rapport
                    </p>
                  </div>
                  <Switch
                    checked={config.show_observations}
                    onCheckedChange={() => handleToggle("show_observations")}
                  />
                </div>
                <textarea
                  value={config.observations_manuelles ?? ""}
                  onChange={e => handleObservations(e.target.value)}
                  placeholder="Ex : Forte affluence le week-end, rupture de stock sur le site X le 12/06…"
                  rows={4}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Footer */}
              <div className="px-5 py-4 flex items-center justify-between bg-slate-50">
                {config.configure_par_nom && (
                  <p className="text-xs text-slate-400">
                    Dernière configuration par <strong>{config.configure_par_nom}</strong>
                  </p>
                )}
                <div className="ml-auto">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    size="sm"
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Sauvegarder
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
