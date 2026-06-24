"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Save, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import api from "@/lib/api";
import { toast } from "sonner";
import type { RapportJournalierConfig, RapportJournalierConfigPayload } from "@/lib/types/backend";
import { DEFAULT_RAPPORT_JOURNALIER_CONFIG } from "@/lib/types/backend";

type Props = {
  campaignId: string;
  onConfigChange?: (config: RapportJournalierConfig) => void;
};

const ITEMS: { field: keyof RapportJournalierConfigPayload; label: string; hint?: string }[] = [
  { field: "show_pointage",              label: "Heures d'arrivée / départ",        hint: "Reprises automatiquement du pointage de l'hôtesse" },
  { field: "show_stock",                 label: "Stock magasin en début de journée", hint: "Saisie manuelle" },
  { field: "show_stock_boissons",        label: "Stock de boissons du site",        hint: "Saisie manuelle" },
  { field: "show_boissons_gratuites",    label: "Nombre de boissons gratuites",     hint: "Saisie manuelle" },
  { field: "show_ventes_detail",         label: "Détail des ventes",                hint: "Ventes promo / hors promo" },
  { field: "show_ugs_recus",             label: "UGs (goodies) reçus" },
  { field: "show_ugs_distribues",        label: "UGs (goodies) distribués" },
  { field: "show_ugs_restants",          label: "UGs (goodies) restants" },
  { field: "show_degustation",           label: "Détail des dégustations du jour" },
  { field: "show_genre",                 label: "Répartition par genre (Hommes/Femmes)", hint: "Calculée à partir des dégustations saisies par les hôtesses" },
  { field: "show_personnes_touchees",    label: "Nombre de personnes touchées",     hint: "Saisie manuelle" },
  { field: "show_avis_consommateurs",    label: "Avis des consommateurs",           hint: "Saisie manuelle" },
  { field: "show_observation_generale",  label: "Observation générale",             hint: "Saisie manuelle" },
];

export default function RapportJournalierConfigPanel({ campaignId, onConfigChange }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RapportJournalierConfig>({ ...DEFAULT_RAPPORT_JOURNALIER_CONFIG, campagne: campaignId });

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<RapportJournalierConfig | { detail: string; defaults: boolean }>(
        `/rapport-journalier-configs/par-campagne/?campagne=${campaignId}`
      );
      if ("defaults" in data && data.defaults) {
        setConfig({ ...DEFAULT_RAPPORT_JOURNALIER_CONFIG, campagne: campaignId });
      } else {
        setConfig(data as RapportJournalierConfig);
      }
    } catch {
      setConfig({ ...DEFAULT_RAPPORT_JOURNALIER_CONFIG, campagne: campaignId });
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (open) fetchConfig();
  }, [open, fetchConfig]);

  const handleToggle = (field: keyof RapportJournalierConfigPayload) => {
    setConfig(prev => ({ ...prev, [field]: !prev[field as keyof RapportJournalierConfig] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: RapportJournalierConfigPayload = {
        show_pointage: config.show_pointage,
        show_stock: config.show_stock,
        show_stock_boissons: config.show_stock_boissons,
        show_boissons_gratuites: config.show_boissons_gratuites,
        show_ventes_detail: config.show_ventes_detail,
        show_ugs_recus: config.show_ugs_recus,
        show_ugs_distribues: config.show_ugs_distribues,
        show_ugs_restants: config.show_ugs_restants,
        show_degustation: config.show_degustation,
        show_genre: config.show_genre,
        show_personnes_touchees: config.show_personnes_touchees,
        show_avis_consommateurs: config.show_avis_consommateurs,
        show_observation_generale: config.show_observation_generale,
      };
      const { data } = await api.patch<RapportJournalierConfig>(
        `/rapport-journalier-configs/par-campagne/?campagne=${campaignId}`,
        payload
      );
      setConfig(data);
      onConfigChange?.(data);
      toast.success("Configuration du bulletin journalier sauvegardée !");
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
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Configuration du bulletin journalier</p>
            <p className="text-xs text-slate-500 mt-0.5">Choisissez les sections à inclure dans le rapport par site/jour</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
              <span className="ml-2 text-sm text-slate-500">Chargement…</span>
            </div>
          ) : (
            <>
              <div className="px-5 pt-4 pb-2 space-y-3">
                {ITEMS.map(item => (
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
                      checked={!!config[item.field as keyof RapportJournalierConfig]}
                      onCheckedChange={() => handleToggle(item.field)}
                    />
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 flex items-center justify-between bg-slate-50 mt-2">
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
                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
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
