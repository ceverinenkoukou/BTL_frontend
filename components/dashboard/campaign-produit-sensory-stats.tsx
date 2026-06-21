"use client";

import { Star, UtensilsCrossed } from "lucide-react";
import type { Degustation, IntentionAchat } from "@/lib/types/backend";

const INTENT_META: { key: IntentionAchat; label: string; fill: string }[] = [
  { key: "FAIBLE",  label: "Faible",  fill: "#f87171" },
  { key: "MOYENNE", label: "Moyenne", fill: "#fbbf24" },
  { key: "ELEVEE",  label: "Élevée",  fill: "#4ade80" },
];

export interface ProduitSensoryStat {
  produit_nom: string;
  degustations: number;
  note_moyenne: number;
  notes: Record<1 | 2 | 3 | 4 | 5, number>;
  intentions: Record<IntentionAchat, number>;
}

export function computeProduitSensoryStats(tastings: Degustation[]): ProduitSensoryStat[] {
  const map = new Map<string, { notes: number[]; intentions: Record<IntentionAchat, number> }>();

  for (const t of tastings) {
    const key = t.produit_nom || "Produit";
    if (!map.has(key)) {
      map.set(key, {
        notes: [],
        intentions: { FAIBLE: 0, MOYENNE: 0, ELEVEE: 0 },
      });
    }
    const entry = map.get(key)!;
    if (t.note_gout !== null) entry.notes.push(t.note_gout);
    if (t.intention_achat in entry.intentions) {
      entry.intentions[t.intention_achat as IntentionAchat]++;
    }
  }

  return [...map.entries()]
    .map(([produit_nom, data]) => {
      const notesHist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const n of data.notes) {
        if (n >= 1 && n <= 5) notesHist[n as 1 | 2 | 3 | 4 | 5]++;
      }
      const avg = data.notes.length
        ? Math.round((data.notes.reduce((s, n) => s + n, 0) / data.notes.length) * 10) / 10
        : 0;
      return {
        produit_nom,
        degustations: data.notes.length,
        note_moyenne: avg,
        notes: notesHist,
        intentions: data.intentions,
      };
    })
    .sort((a, b) => b.degustations - a.degustations);
}

interface ProduitSensoryStatsPanelProps {
  stats: ProduitSensoryStat[];
  p1: string;
  p2: string;
  brandGrad: string;
}

function hex(color: string, alpha: number) {
  const c = (color || "#006776").replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function CampaignProduitSensoryCard({ stats, p1, p2, brandGrad }: ProduitSensoryStatsPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: hex(p1, 0.12) }}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" style={{ color: p1 }} />
        </div>
        Goût &amp; intention d&apos;achat par produit
      </h3>
      <ProduitSensoryStatsPanel stats={stats} p1={p1} p2={p2} brandGrad={brandGrad} />
    </div>
  );
}

export function ProduitSensoryStatsPanel({ stats, p1, p2, brandGrad }: ProduitSensoryStatsPanelProps) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-8">
        Aucune dégustation enregistrée — les statistiques goût et intention apparaîtront ici.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {stats.map(prod => {
        const maxNoteCount = Math.max(1, ...([1, 2, 3, 4, 5] as const).map(n => prod.notes[n]));
        return (
          <div key={prod.produit_nom} className="rounded-xl border border-slate-100 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-foreground">{prod.produit_nom}</h4>
              <span className="text-xs text-muted-foreground tabular-nums">
                {prod.degustations} dégustation{prod.degustations !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Goût */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Note de goût
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${n <= Math.round(prod.note_moyenne) ? "fill-amber-400" : "fill-transparent"} text-amber-400`}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {prod.note_moyenne}/5
                  </span>
                </div>
                <div className="space-y-1.5">
                  {([1, 2, 3, 4, 5] as const).map(note => (
                    <div key={note} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-muted-foreground tabular-nums">{note}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round((prod.notes[note] / maxNoteCount) * 100)}%`,
                            background: brandGrad,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-muted-foreground tabular-nums">{prod.notes[note]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intention d'achat */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Intention d&apos;achat
                </p>
                <div className="flex h-4 rounded-full overflow-hidden border border-slate-100">
                  {INTENT_META.map(meta => {
                    const count = prod.intentions[meta.key];
                    const pct = prod.degustations ? (count / prod.degustations) * 100 : 0;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={meta.key}
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta.fill }}
                        title={`${meta.label}: ${count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3">
                  {INTENT_META.map(meta => {
                    const count = prod.intentions[meta.key];
                    const pct = prod.degustations ? Math.round((count / prod.degustations) * 100) : 0;
                    return (
                      <div key={meta.key} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.fill }} />
                        <span className="text-muted-foreground">{meta.label}</span>
                        <span className="font-semibold text-foreground tabular-nums">{pct}%</span>
                        <span className="text-muted-foreground">({count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
