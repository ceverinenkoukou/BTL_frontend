"use client";

/**
 * CampaignReport.jsx — v2
 *
 * Rapport PDF campagne, branché dynamiquement aux couleurs de l'entreprise.
 *
 * Le branding est résolu dans cet ordre de priorité :
 *   1. company.brand  → { primaryColor, secondaryColor, logoBase64, logoMimeType, fontFamily? }
 *      (champ stocké en base / fourni par l'API)
 *   2. company.color  → string hex "#rrggbb"  (couleur principale simple)
 *   3. Extraction automatique depuis company.logoUrl (canvas côté client)
 *   4. Fallback : palette neutre grise (fonctionne pour n'importe quelle entreprise)
 *
 * Rôles :
 *   admin | supervisor → rapport complet (hôtesses + sites + goodies)
 *   company_admin      → rapport entreprise (sites + goodies uniquement)
 *
 * Dépendances :
 *   npm install jspdf jspdf-autotable
 *
 * Props :
 *   campaign     Campaign
 *   user         User
 *   tastings     Tasting[]
 *   sales        Sale[]
 *   team         CampaignTeamMember[]
 *   sites        CampaignSite[]
 */

import { useState, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, Loader2 } from "lucide-react";
import type { Campaign, CampaignSite, CampaignTeamMember, Company, Profile, Sale, Tasting, Zone } from "@/lib/types";
import type { RapportConfig, DonneesSiteJour, LivraisonGoodiesJour, TypeCampagne, GainGoodie, GainPromotion, TrancheAge, Genre, IntentionAchat } from "@/lib/types/backend";
import { DEFAULT_RAPPORT_CONFIG } from "@/lib/types/backend";

type HostessTasting = Tasting & {
  // Données brutes du formulaire hôtesse, utilisées par la section "Détail des dégustations"
  hostess_name?: string;
  site_name?: string;
  product_name?: string;
  nom_client?: string | null;
  tranche_age?: TrancheAge;
  tranche_age_display?: string;
  genre?: Genre | null;
  intention_achat?: IntentionAchat;
  intention_achat_display?: string;
  note_gout?: number | null;
  note_ambiance?: number | null;
  a_achete?: boolean;
};
type StaffMember = CampaignTeamMember & {
  daily_objective?: number;
  site?: CampaignSite;
};
type RGB = [number, number, number];
type BrandCompany = Company & {
  brand?: {
    primaryColor?: string;
    logoBase64?: string;
    logoMimeType?: string;
  };
  color?: string;
  logoUrl?: string;
};
type ReportCampaign = Campaign & {
  company?: BrandCompany;
  zone?: Zone;
  type_campagne?: TypeCampagne;
  note_gout_max?: 5 | 10;
  note_ambiance_max?: 5 | 10;
};
type ReportSale = Sale & {
  notes?: string;
  type_vente?: "NORMAL" | "GRATUIT" | "PROMOTION";
  est_achat_promo?: boolean;
  tranche_age?: TrancheAge | null;
  genre?: Genre | null;
  note_gout?: number | null;
  note_ambiance?: number | null;
  nom_client?: string | null;
  produit_nom?: string;
  conditionnement_display?: string;
};
type HostessStat = {
  id: string;
  name: string;
  site: string;
  siteId?: string;
  tastings: number;
  sales: number;
  revenue: number;
  dailyObjective: number;
  avgPerDay: number;
  perfPct: number;
  goodiesCount: number;
  promoGains: Record<string, number>;
  totalQty: number;
};
type SiteStat = {
  id: string;
  name: string;
  location: string;
  tastings: number;
  sales: number;
  revenue: number;
  goodies: number;
  promoGains: Record<string, number>;
  hostesses: HostessStat[];
  activeDays: number;
  ventesNormales: number;
  offerts: number;
  avgVentesNormalesParJour: number;
  avgOffertsParJour: number;
};
type Palette = ReturnType<typeof buildPalette>;
type HoraireSite = {
  site: string | null;
  site_nom: string | null;
  date: string;
  heure_ouverture: string;
  heure_fermeture: string;
};
type CampaignReportProps = {
  campaign: ReportCampaign;
  user?: Profile | null;
  tastings?: HostessTasting[];
  sales?: ReportSale[];
  team?: StaffMember[];
  sites?: CampaignSite[];
  horaires?: HoraireSite[];
  donneesSiteJour?: DonneesSiteJour[];
  livraisons?: LivraisonGoodiesJour[];
  gainsGoodies?: GainGoodie[];
  gainsPromotions?: GainPromotion[];
  reportConfig?: RapportConfig | null;
  label?: string;
};
type GeneratePDFArgs = {
  campaign: ReportCampaign;
  user?: Profile | null;
  hostessStats: HostessStat[];
  siteStats: SiteStat[];
  tastings: HostessTasting[];
  sales: ReportSale[];
  horaires: HoraireSite[];
  donneesSiteJour: DonneesSiteJour[];
  livraisons: LivraisonGoodiesJour[];
  gainsGoodies: GainGoodie[];
  gainsPromotions: GainPromotion[];
  isAdminOrSupervisor: boolean;
  palette: Palette;
  logoBase64: string | null;
  logoMimeType: string;
  cfg: RapportConfig;
};


// ─────────────────────────────────────────────────────────────
// 1. Utilitaires couleur
// ─────────────────────────────────────────────────────────────

/** Convertit "#rrggbb" ou "rgb(r,g,b)" en tableau [r,g,b] */
function hexToRgb(hex: string): RGB | null {
  if (!hex) return null;
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

/** Mélange deux couleurs rgb avec un ratio (0 = c1, 1 = c2) */
function mixRgb(c1: RGB, c2: RGB, ratio = 0.5): RGB {
  return c1.map((v, i) => Math.round(v + (c2[i] - v) * ratio)) as RGB;
}

/** Éclaircit une couleur vers le blanc */
const lighten = (c: RGB, amount = 0.85) => mixRgb(c, [255, 255, 255], amount);

/** Assombrit une couleur vers le noir */
const darken  = (c: RGB, amount = 0.3)  => mixRgb(c, [0, 0, 0], amount);

/** Luminosité perceptuelle (0–255) */
function luminance([r, g, b]: RGB) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Choisit blanc ou noir selon le contraste avec bg */
function contrastColor(bg: RGB): RGB {
  return luminance(bg) > 140 ? [30, 30, 40] : [255, 255, 255];
}

/**
 * Construit la palette complète à partir d'une couleur primaire [r,g,b].
 * Toutes les autres couleurs sont dérivées algorithmiquement,
 * garantissant la cohérence sur n'importe quel branding.
 */
function buildPalette(primary: RGB) {
  const P = primary;
  return {
    primary:    P,
    secondary:  darken(P, 0.15),          // version plus sombre pour le dégradé
    accent:     lighten(P, 0.88),          // fond très clair (tableaux alternés, badges)
    accentBorder: lighten(P, 0.65),        // bordure légère
    headerText: contrastColor(P),          // texte sur fond primaire
    dark:       [30, 30, 40] as RGB,       // texte principal
    mid:        [100, 100, 120] as RGB,    // texte secondaire
    light:      [240, 240, 245] as RGB,    // fond neutre clair
    white:      [255, 255, 255] as RGB,
    success:    [22, 163, 74] as RGB,
    warn:       [202, 138, 4] as RGB,
    error:      [220, 38, 38] as RGB,
  };
}

/** Palette de fallback (gris ardoise neutre — fonctionne pour toute entreprise) */
const FALLBACK_PRIMARY: RGB = [71, 85, 105]; // slate-600

// ─────────────────────────────────────────────────────────────
// 2. Extraction couleur depuis logo (canvas côté client)
// ─────────────────────────────────────────────────────────────

/**
 * Charge une image via une URL (ou data-URI) et retourne la couleur dominante
 * en analysant les pixels non-transparents les plus saturés du bord supérieur.
 * Retourne null en cas d'échec (CORS, format non supporté…).
 */
async function extractDominantColor(src: string): Promise<RGB | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const SIZE = 80;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

          // Trouver le pixel non-transparent le plus saturé
          let bestSat = -1;
          let bestRgb: RGB | null = null;
          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b, a] = [data[i], data[i+1], data[i+2], data[i+3]] as [number, number, number, number];
            if (a < 128) continue;                         // transparent
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const lum = luminance([r, g, b]);
            // Ignorer quasi-blancs et quasi-noirs
            if (lum > 240 || lum < 15) continue;
            if (sat > bestSat) { bestSat = sat; bestRgb = [r, g, b]; }
          }
          resolve(bestSat > 0.15 ? bestRgb : null);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;

/** Mappe un mime-type ("image/png") vers le format attendu par jsPDF ("PNG"). */
function mimeToJsPdfFormat(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "JPEG";
  if (m.includes("webp")) return "WEBP";
  if (m.includes("gif")) return "GIF";
  if (m.includes("bmp")) return "BMP";
  return "PNG";
}

/**
 * Charge une image (URL distante ou data-URI) et la convertit en data-URI PNG
 * via un canvas, pour qu'elle soit exploitable par jsPDF (doc.addImage).
 * Retourne null en cas d'échec (CORS, format non supporté…).
 */
async function loadImageAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 3. Résolution du branding final
// ─────────────────────────────────────────────────────────────

/**
 * Retourne { palette, logoBase64, logoMimeType } pour une entreprise donnée.
 * Essaie toutes les sources dans l'ordre de priorité.
 */
async function resolveBranding(company?: BrandCompany) {
  let primaryRgb: RGB | null = null;
  let logoBase64: string | null = null;
  let logoMimeType = "image/png";

  // Priorité 1 — champ brand structuré
  if (company?.brand) {
    const b = company.brand;
    if (b.primaryColor)  primaryRgb   = hexToRgb(b.primaryColor) ?? hexToRgb(`#${b.primaryColor}`);
    if (b.logoBase64)    logoBase64   = b.logoBase64;
    if (b.logoMimeType)  logoMimeType = b.logoMimeType;
  }

  // Priorité 2 — color simple
  if (!primaryRgb && company?.color) {
    primaryRgb = hexToRgb(company.color) ?? hexToRgb(`#${company.color}`);
  }

  // Logo de l'entreprise (Entreprise.logo_url) — data-URI directe ou URL à convertir
  if (!logoBase64 && company?.logoUrl) {
    const directMatch = DATA_URI_RE.exec(company.logoUrl);
    if (directMatch) {
      logoMimeType = directMatch[1];
      logoBase64 = directMatch[2];
    } else {
      try {
        const dataUrl = await loadImageAsDataUrl(company.logoUrl);
        const match = dataUrl ? DATA_URI_RE.exec(dataUrl) : null;
        if (match) {
          logoMimeType = match[1];
          logoBase64 = match[2];
        }
      } catch { /* logo distant inaccessible (CORS, etc.) — pas de logo dans le PDF */ }
    }
  }

  // Priorité 3 — extraction de couleur depuis logoUrl (si pas déjà trouvée)
  if (!primaryRgb && company?.logoUrl) {
    try {
      primaryRgb = await extractDominantColor(company.logoUrl);
    } catch { /* silently ignore */ }
  }

  // Priorité 4 — extraction depuis logoBase64 lui-même
  if (!primaryRgb && logoBase64) {
    try {
      const src = `data:${logoMimeType};base64,${logoBase64}`;
      primaryRgb = await extractDominantColor(src);
    } catch { /* silently ignore */ }
  }

  // Fallback
  if (!primaryRgb) primaryRgb = FALLBACK_PRIMARY;

  return {
    palette:      buildPalette(primaryRgb),
    logoBase64,
    logoMimeType,
  };
}

// ─────────────────────────────────────────────────────────────
// 4. Helpers rapport
// ─────────────────────────────────────────────────────────────

const fmt     = (n: number | string)   => Number(n ?? 0).toLocaleString("fr-FR");
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";
const pct     = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

/**
 * Retourne la première valeur non vide (après trim) de la liste, ou "" si
 * aucune. Contrairement à `??`, traite aussi les chaînes vides ("") comme
 * absentes — utile car certains champs backend (ex: RapportConfig.titre_personnalise)
 * valent "" par défaut plutôt que null.
 */
function firstNonEmpty(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return "";
}

const GMS_ID = "3";
const CHR_ID = "4";

function computePromoGains(campaignId: string, qty:number, promoType = "canettes"): Record<string, number> {
  if (campaignId === GMS_ID) {
    if (promoType === "canettes")
      return { canettesOffertes: Math.floor(qty / 4), ticketsTombola: Math.floor(qty / 6) };
    return { packsOfferts: Math.floor(qty / 4), goodies: Math.floor(qty / 4) };
  }
  if (campaignId === CHR_ID)
    return { bouteillesOffertes: Math.floor(qty / 3), tirages: Math.floor(qty / 9) };
  return {};
}

// ─────────────────────────────────────────────────────────────
// 5. Agrégations données
// ─────────────────────────────────────────────────────────────

function buildHostessStats(
  tastings: HostessTasting[], sales: ReportSale[], team: StaffMember[],
  campaign: ReportCampaign, gainsGoodies: GainGoodie[]
): HostessStat[] {
  return team
    .filter(m => m.role === "hostess")
    .map(h => {
      const hT = tastings.filter(t => t.hostess_id === h.user_id);
      const hS = sales.filter(s => s.hostess_id === h.user_id);
      const totalQty = hS.reduce((s, x) => s + (x.quantity ?? 0), 0);
      const promoGains = computePromoGains(campaign.id, totalQty, "canettes");
      const dailyObj = h.daily_objective ?? Math.max(1, Math.ceil(campaign.sales_objective / 30));
      const activeDays = Math.max(1, [...new Set(hS.map(s => s.created_at?.slice(0, 10)))].length);
      const avgPerDay  = Math.round(hS.length / activeDays);
      // Goodies réellement gagnés par des clients (GainGoodie), pas une valeur
      // dérivée des ventes — hotesse est nullable côté backend (SET_NULL), donc
      // ce comptage par hôtesse peut sous-estimer légèrement les gains non
      // rattachés à une hôtesse (voir le total par site, plus fiable, ci-dessous).
      const goodiesCount = gainsGoodies.filter(g => g.hotesse === h.user_id).length;
      return {
        id: h.user_id, name: h.user?.full_name ?? "—",
        site: h.site?.name ?? "—", siteId: h.site_id,
        tastings: hT.length, sales: hS.length,
        revenue: hS.reduce((a, s) => a + (s.total_amount ?? 0), 0),
        dailyObjective: dailyObj, avgPerDay,
        perfPct: pct(avgPerDay, dailyObj),
        goodiesCount, promoGains, totalQty,
      };
    });
}

function buildSiteStats(
  hostessStats: HostessStat[], tastings: HostessTasting[], sales: ReportSale[],
  sites: CampaignSite[], gainsGoodies: GainGoodie[]
): SiteStat[] {
  return sites.map(site => {
    const hIds = hostessStats.filter(h => h.siteId === site.id).map(h => h.id);
    const sH   = hostessStats.filter(h => h.siteId === site.id);
    const promoGainsAgg = sH.reduce<Record<string, number>>((acc, h) => {
      Object.entries(h.promoGains).forEach(([k, v]) => { acc[k] = (acc[k] ?? 0) + v; });
      return acc;
    }, {});
    const siteSales = sales.filter(s => hIds.includes(s.hostess_id));
    // "Ventes normales" = quantités réellement achetées (ex : les 4 canettes dans
    // une mécanique "4 achetées → 1 offerte"). GRATUIT/PROMOTION = le produit
    // offert (CA nul) — jamais compté comme une vente pour ce graphique.
    const normalSales = siteSales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL");
    const offertSales = siteSales.filter(s => s.type_vente === "GRATUIT" || s.type_vente === "PROMOTION");
    // Jours d'activité = dates distinctes où une vente normale a été enregistrée
    // sur ce site — un jour non travaillé ne produit aucune ligne et ne dilue
    // donc jamais la moyenne (comparaison équitable entre sites à durées d'activité différentes).
    const activeDays = Math.max(1, new Set(normalSales.map(s => s.created_at?.slice(0, 10))).size);
    return {
      id: site.id, name: site.name ?? "—",
      location: site.zone?.name ?? site.address ?? "—",
      tastings: tastings.filter(t => hIds.includes(t.hostess_id)).length,
      sales:    siteSales.length,
      revenue:  siteSales.reduce((a, s) => a + (s.total_amount ?? 0), 0),
      // GainGoodie.site n'est jamais nul côté backend (contrairement à hotesse),
      // donc ce comptage par site est exhaustif — plus fiable que la somme des
      // goodiesCount par hôtesse.
      goodies:  gainsGoodies.filter(g => g.site === site.id).length,
      promoGains: promoGainsAgg,
      hostesses: sH,
      activeDays,
      // Nombre de produits (quantité), pas de lignes de vente — une ligne
      // peut porter plusieurs unités (ex : 4 canettes en une seule saisie).
      ventesNormales: normalSales.reduce((a, s) => a + (s.quantity ?? 0), 0),
      offerts: offertSales.reduce((a, s) => a + (s.quantity ?? 0), 0),
      avgVentesNormalesParJour: Math.round(normalSales.reduce((a, s) => a + (s.quantity ?? 0), 0) / activeDays),
      avgOffertsParJour: Math.round(offertSales.reduce((a, s) => a + (s.quantity ?? 0), 0) / activeDays),
    };
  });
}

type SiteHoraires = { name: string; horaires: string; jours: number };

/** Pour chaque site, déduit l'horaire effectif (entrées propres au site, sinon entrées "tous les sites" de la campagne). */
function buildSiteHoraires(horaires: HoraireSite[], siteStats: SiteStat[]): SiteHoraires[] {
  const fmtRange = (o: string, f: string) => `${o.slice(0, 5)} – ${f.slice(0, 5)}`;
  const globalEntries = horaires.filter(h => !h.site);
  return siteStats.map(site => {
    const own = horaires.filter(h => h.site === site.id);
    const entries = own.length > 0 ? own : globalEntries;
    if (entries.length === 0) return { name: site.name, horaires: "—", jours: 0 };
    const ranges = [...new Set(entries.map(h => fmtRange(h.heure_ouverture, h.heure_fermeture)))];
    return { name: site.name, horaires: ranges.join(" / "), jours: entries.length };
  });
}

// Ordre fixe (porte le sens de l'échelle) — jamais trié par valeur.
const AGE_BRACKETS: { code: TrancheAge; label: string }[] = [
  { code: "MOINS_18", label: "-18 ans" },
  { code: "18_25", label: "18-25 ans" },
  { code: "26_35", label: "26-35 ans" },
  { code: "36_50", label: "36-50 ans" },
  { code: "PLUS_50", label: "+50 ans" },
];
const GENRE_BUCKETS: { code: Genre; label: string }[] = [
  { code: "HOMME", label: "Hommes" },
  { code: "FEMME", label: "Femmes" },
];

/**
 * Répartition par tranche d'âge du client, ordre d'âge croissant.
 * Une campagne VENTE n'a aucune dégustation (formulaire hôtesse absent) —
 * la tranche d'âge n'existe alors que sur la Vente elle-même (saisie au
 * moment de l'achat) ; on y bascule la source dans ce cas, comme pour le
 * KPI "Ventes" (isVenteCampagne). Ventes NORMAL uniquement : les lignes
 * GRATUIT/PROMOTION n'ont pas ces champs renseignés côté backend.
 */
function buildAgeDistribution(tastings: HostessTasting[], sales: ReportSale[], isVenteCampagne: boolean) {
  return AGE_BRACKETS.map(a => ({
    label: a.label,
    value: isVenteCampagne
      ? sales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL" && s.tranche_age === a.code).length
      : tastings.filter(t => t.tranche_age === a.code).length,
  }));
}

/** Répartition par sexe du client — même bascule de source que buildAgeDistribution. */
function buildGenreDistribution(tastings: HostessTasting[], sales: ReportSale[], isVenteCampagne: boolean) {
  return GENRE_BUCKETS.map(g => ({
    label: g.label,
    value: isVenteCampagne
      ? sales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL" && s.genre === g.code).length
      : tastings.filter(t => t.genre === g.code).length,
  }));
}

/**
 * Distribution d'une note (goût ou ambiance) sur son échelle réelle 1–max
 * (max configurable par campagne, 5 ou 10 — jamais 0, les notes commencent
 * à 1 sur le formulaire hôtesse), ordre croissant. Même bascule de source
 * que buildAgeDistribution : une campagne VENTE porte ces notes sur la
 * Vente elle-même (pas de dégustation).
 */
function buildNoteDistribution(
  tastings: HostessTasting[], sales: ReportSale[], isVenteCampagne: boolean,
  field: "note_gout" | "note_ambiance", maxValue: number
) {
  return Array.from({ length: maxValue }, (_, i) => i + 1).map(n => ({
    label: String(n),
    value: isVenteCampagne
      ? sales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL" && s[field] === n).length
      : tastings.filter(t => t[field] === n).length,
  }));
}

// Ordre fixe (ordinal : faible → élevée) — jamais trié par valeur.
const INTENTION_BUCKETS: { code: IntentionAchat; label: string }[] = [
  { code: "FAIBLE", label: "Faible" },
  { code: "MOYENNE", label: "Moyenne" },
  { code: "ELEVEE", label: "Élevée" },
];

/** Répartition des dégustations par intention d'achat déclarée. */
function buildIntentionDistribution(tastings: HostessTasting[]) {
  return INTENTION_BUCKETS.map(i => ({
    label: i.label,
    value: tastings.filter(t => t.intention_achat === i.code).length,
  }));
}

/** Tendance journalière : dégustations et ventes normales par jour, sur toute la période avec activité. */
function buildDailyTrend(tastings: HostessTasting[], sales: ReportSale[]) {
  const allDates = new Set<string>();
  tastings.forEach(t => { const d = t.created_at?.slice(0, 10); if (d) allDates.add(d); });
  sales.forEach(s => { const d = s.created_at?.slice(0, 10); if (d) allDates.add(d); });
  const dates = [...allDates].sort();
  const tastingsPerDay = dates.map(d => tastings.filter(t => t.created_at?.slice(0, 10) === d).length);
  const salesPerDay = dates.map(d =>
    sales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL" && s.created_at?.slice(0, 10) === d).length
  );
  return { dates, tastingsPerDay, salesPerDay };
}

/**
 * Libellé lisible d'une offre promotionnelle. Si promotion_description est
 * vide ou un nombre pur (anciennes saisies admin), on recompose depuis les
 * quantités — même logique que le bulletin condensé (condensedBulletinHtml.ts).
 */
function formatPromoLabel(g: GainPromotion): string {
  const desc = (g.promotion_description || "").trim();
  if (!desc || /^\d+$/.test(desc)) {
    const req = g.quantite_requise;
    const off = g.quantite_offerte;
    if (g.type_promotion === "TIRAGE" || g.type_promotion === "GAGNE") {
      return `Tirage (${req} acheté${req > 1 ? "s" : ""})`;
    }
    return `${req} acheté${req > 1 ? "s" : ""} → ${off} offert${off > 1 ? "s" : ""}`;
  }
  return desc;
}

/** Synthèse par site : pour chaque offre promo réellement appliquée (GainPromotion), combien de fois et combien de boissons offertes. */
function buildOffresParSite(gainsPromotions: GainPromotion[]) {
  const map = new Map<string, { site: string; offre: string; fois: number; qtyOfferte: number }>();
  gainsPromotions.forEach(g => {
    const offre = formatPromoLabel(g);
    const key = `${g.site_nom}__${offre}`;
    if (!map.has(key)) map.set(key, { site: g.site_nom, offre, fois: 0, qtyOfferte: 0 });
    const e = map.get(key)!;
    e.fois += 1;
    e.qtyOfferte += g.quantite_offerte;
  });
  return [...map.values()].sort((a, b) =>
    a.site === b.site ? b.qtyOfferte - a.qtyOfferte : a.site.localeCompare(b.site)
  );
}

const OFFER_WINDOW_MS = 10 * 60 * 1000;
const isPlaceholderClient = (c: string) => c === "—";
const normalizeClient = (v: string | null | undefined) => (v || "").trim() || "—";

type VenteRow = {
  time: number; siteId: string; siteName: string; date: string; client: string;
  produit: string; conditionnement: string; quantiteAchetee: number;
  offre: string; quantiteOfferte: number; goodieNom: string;
};

/**
 * Une ligne par vente NORMAL (achat), enrichie de l'offre promo éventuellement
 * déclenchée (GainPromotion.vente_achat, lien exact) et du goodie remporté
 * (GainGoodie, rattaché par proximité site + client + 10 min, comme les ventes
 * GRATUIT sans lien direct — même heuristique que le bulletin condensé).
 * Le site est dérivé de l'hôtesse (via siteStats), Vente n'ayant pas de FK site.
 */
function buildVenteRows(
  sales: ReportSale[], siteStats: SiteStat[],
  gainsPromotions: GainPromotion[], gainsGoodies: GainGoodie[]
): VenteRow[] {
  const siteByHostess = new Map<string, { id: string; name: string }>();
  siteStats.forEach(s => s.hostesses.forEach(h => siteByHostess.set(h.id, { id: s.id, name: s.name })));

  const gainsByVenteId = new Map(
    gainsPromotions.filter(g => g.vente_achat).map(g => [g.vente_achat as string, g])
  );

  const rowsMap = new Map<string, VenteRow>();

  sales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL").forEach(s => {
    const site = siteByHostess.get(s.hostess_id);
    if (!site) return;
    const gain = gainsByVenteId.get(s.id);
    rowsMap.set(s.id, {
      time: new Date(s.created_at).getTime(),
      siteId: site.id, siteName: site.name,
      date: s.created_at.slice(0, 10),
      client: normalizeClient(s.nom_client),
      produit: s.produit_nom ?? "—",
      conditionnement: s.conditionnement_display ?? "—",
      quantiteAchetee: s.quantity ?? 0,
      offre: gain ? formatPromoLabel(gain) : "—",
      quantiteOfferte: gain?.quantite_offerte ?? 0,
      goodieNom: "—",
    });
  });

  // Ventes GRATUIT : pas de lien direct vers l'achat — rattachement par
  // proximité (même site, même client si connu, à moins de 10 min d'écart).
  sales
    .filter(s => s.type_vente === "GRATUIT")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach(s => {
      const site = siteByHostess.get(s.hostess_id);
      if (!site) return;
      const time = new Date(s.created_at).getTime();
      const client = normalizeClient(s.nom_client);
      const match = [...rowsMap.values()]
        .filter(row =>
          row.siteId === site.id &&
          (row.client === client || isPlaceholderClient(row.client) || isPlaceholderClient(client)) &&
          Math.abs(row.time - time) <= OFFER_WINDOW_MS
        )
        .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0];
      if (match) {
        if (isPlaceholderClient(match.client) && !isPlaceholderClient(client)) match.client = client;
        match.quantiteOfferte += s.quantity ?? 0;
        if (match.offre === "—") match.offre = "Offert (goodie)";
      } else {
        rowsMap.set(`gratuit-${s.id}`, {
          time, siteId: site.id, siteName: site.name, date: s.created_at.slice(0, 10), client,
          produit: s.produit_nom ?? "—", conditionnement: s.conditionnement_display ?? "—",
          quantiteAchetee: 0, offre: "Offert (goodie)", quantiteOfferte: s.quantity ?? 0, goodieNom: "—",
        });
      }
    });

  // Goodies gagnés (roue / promo) : même heuristique de proximité, pas de FK vente.
  [...gainsGoodies]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach(g => {
      const time = new Date(g.created_at).getTime();
      const client = normalizeClient(g.nom_client);
      const match = [...rowsMap.values()]
        .filter(row =>
          row.siteId === g.site &&
          (row.client === client || isPlaceholderClient(row.client) || isPlaceholderClient(client)) &&
          Math.abs(row.time - time) <= OFFER_WINDOW_MS
        )
        .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time))[0];
      if (match) {
        match.goodieNom = match.goodieNom === "—" ? g.goodie_nom : `${match.goodieNom}, ${g.goodie_nom}`;
      }
    });

  return [...rowsMap.values()].sort((a, b) =>
    a.siteName === b.siteName ? a.date.localeCompare(b.date) : a.siteName.localeCompare(b.siteName)
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Construction PDF
// ─────────────────────────────────────────────────────────────

function generatePDF({
  campaign, user, hostessStats, siteStats, tastings, sales, horaires,
  donneesSiteJour, livraisons, gainsGoodies, gainsPromotions,
  isAdminOrSupervisor, palette, logoBase64, logoMimeType, cfg,
}: GeneratePDFArgs) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M  = 14;
  const CW = PW - M * 2;
  let Y = M;

  const P = palette;
  const company = campaign.company ?? ({} as BrandCompany);
  const isGMS  = campaign.id === GMS_ID;
  const isCHR  = campaign.id === CHR_ID;
  const isPromo = isGMS || isCHR;
  // Campagne VENTE : pas de dégustations (nb_degustations forcé à 0 côté backend),
  // le KPI "Ventes" doit donc refléter les ventes réelles de la campagne, pas les dégustations.
  const isVenteCampagne = campaign.type_campagne === "VENTE";
  const TASTING_LABEL = "Ventes";
  const OFFERED_LABEL = "Produits offerts";

  // ── Helpers internes ──────────────────────────────────────
  function newPage() {
    doc.addPage(); Y = M;
    runningHeader();
  }

  function guard(needed = 20) {
    if (Y + needed > PH - 14) newPage();
  }

  function runningHeader() {
    doc.setFillColor(...P.primary);
    doc.rect(0, 0, PW, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...P.headerText);
    doc.text(firstNonEmpty(company.name, "—"), M, 8.2);
    doc.text(firstNonEmpty(campaign.name, "—"), PW - M, 8.2, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, PW / 2, 8.2, { align: "center" });
    Y = 18;
  }

  function coverPage() {
    // ── Fond plein couleur primaire haut ──
    doc.setFillColor(...P.primary);
    doc.rect(0, 0, PW, 60, "F");

    // ── Bande secondaire ──
    doc.setFillColor(...P.secondary);
    doc.rect(0, 48, PW, 8, "F");

    // ── Logo entreprise ──
    let logoPlaced = false;
    if (cfg.show_logo && logoBase64) {
      try {
        doc.addImage(logoBase64, mimeToJsPdfFormat(logoMimeType), M, 8, 0, 28); // hauteur fixe 28mm, largeur auto
        logoPlaced = true;
      } catch { /* logo invalide */ }
    }

    // ── Nom entreprise ──
    // Affiché systématiquement (même si un logo est présent) : le logo seul
    // ne suffit pas à identifier l'entreprise dans le rapport.
    const companyName = firstNonEmpty(company.name, "Entreprise");
    if (logoPlaced) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...P.headerText);
      doc.text(companyName, PW - M, 16, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(...P.headerText);
      doc.text(companyName, M, 26);
    }

    // ── Sous-titre ──
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...lighten(P.primary, 0.6));
    doc.text(firstNonEmpty(cfg.sous_titre_personnalise, "Rapport de Campagne Promotionnelle"), M, 42);

    // ── Fond blanc corps ──
    doc.setFillColor(...P.white);
    doc.rect(0, 56, PW, PH - 56, "F");

    // ── Bandeau accent titre ──
    doc.setFillColor(...P.accent);
    doc.rect(M, 68, CW, 28, "F");
    doc.setFillColor(...P.primary);
    doc.rect(M, 68, 3, 28, "F"); // barre verticale

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...P.dark);
    doc.text(firstNonEmpty(cfg.titre_personnalise, campaign.name, "Campagne"), M + 8, 79);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...P.mid);
    const dateRange = `Du ${fmtDate(campaign.start_date)} au ${fmtDate(campaign.end_date)}`;
    doc.text(dateRange, M + 8, 87);
    if (campaign.zone?.name)
      doc.text(`Zone : ${campaign.zone.name}`, M + 8, 93);

    // ── Badge rôle ──
    const roleLabel = isAdminOrSupervisor ? "Rapport final" : "Rapport Entreprise";
    doc.setFillColor(...P.primary);
    doc.roundedRect(PW - M - 42, 68, 42, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...P.headerText);
    doc.text(roleLabel, PW - M - 21, 74.5, { align: "center" });

    // ── Généré par ──
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...P.mid);
    doc.text(
      `Généré par ${user?.full_name ?? "—"} le ${fmtDate(new Date().toISOString())}`,
      M, PH - 16
    );

    Y = 106;
  }

  function sectionTitle(title: string) {
    guard(16);
    // Fond accent + barre primaire gauche
    doc.setFillColor(...P.accent);
    doc.roundedRect(M, Y, CW, 9, 1.5, 1.5, "F");
    doc.setFillColor(...P.primary);
    doc.rect(M, Y, 3, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...P.primary);
    doc.text(title, M + 6, Y + 6.2);
    Y += 13;
  }

  function kpiRow(kpis: { value: string | number; label: string }[]) {
    guard(24);
    const colW = CW / kpis.length;
    kpis.forEach((k, i) => {
      const x = M + i * colW;
      // Carte KPI
      doc.setFillColor(...P.light);
      doc.roundedRect(x, Y, colW - 2, 20, 2, 2, "F");
      doc.setFillColor(...P.primary);
      doc.rect(x, Y + 17, colW - 2, 3, "F"); // pied coloré
      // Valeur
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...P.dark);
      doc.text(String(k.value), x + (colW - 2) / 2, Y + 10, { align: "center" });
      // Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...P.mid);
      doc.text(k.label, x + (colW - 2) / 2, Y + 15.5, { align: "center" });
    });
    Y += 26;
  }

  /** Tronque un libellé pour qu'il tienne dans maxWidth (mm), avec "…" si besoin. */
  function truncateLabel(label: string, maxWidth: number): string {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    if (doc.getTextWidth(label) <= maxWidth) return label;
    let t = label;
    while (t.length > 1 && doc.getTextWidth(t + "…") > maxWidth) t = t.slice(0, -1);
    return t + "…";
  }

  /** Titre de graphique — gras, plus grand et coloré (teinte marque) pour bien se détacher au-dessus de chaque graphique. */
  function chartTitle(text: string) {
    guard(9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...P.primary);
    doc.text(text, M, Y);
    Y += 6.5;
  }

  /** Légende à puces colorées (obligatoire dès 2 séries). */
  function legendRow(items: { color: RGB; label: string }[]) {
    guard(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    let x = M;
    items.forEach(it => {
      doc.setFillColor(...it.color);
      doc.roundedRect(x, Y, 3.2, 3.2, 0.6, 0.6, "F");
      doc.setTextColor(...P.mid);
      doc.text(it.label, x + 4.6, Y + 2.7);
      x += 4.6 + doc.getTextWidth(it.label) + 7;
    });
    Y += 8;
  }

  /**
   * Barres horizontales à une seule série (comparaison de magnitude).
   * Couleur séquentielle (une teinte, du plus sombre — valeur la plus haute —
   * au plus clair), triée décroissante, valeur affichée à l'extrémité de la barre.
   */
  function barChartSequential(items: { label: string; value: number }[]) {
    if (items.length === 0) return;
    const labelW = 40, valueW = 16;
    const chartW = CW - labelW - valueW;
    const barH = 5, gap = 2.2;
    guard(items.length * (barH + gap) + 10);
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const maxV = Math.max(1, sorted[0].value);
    const baseX = M + labelW;
    const startY = Y;
    sorted.forEach((it, i) => {
      const y = Y + i * (barH + gap);
      const ratio = sorted.length > 1 ? i / (sorted.length - 1) : 0;
      const color = mixRgb(P.secondary, lighten(P.primary, 0.55), ratio);
      const w = Math.max(1.5, (it.value / maxV) * chartW);
      doc.setFillColor(...color);
      doc.roundedRect(baseX, y, w, barH, 1, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.dark);
      doc.text(truncateLabel(it.label, labelW - 3), M, y + barH - 1.2);
      doc.setTextColor(...P.mid);
      doc.text(fmt(it.value), baseX + w + 2, y + barH - 1.2);
    });
    doc.setDrawColor(...P.accentBorder);
    doc.setLineWidth(0.2);
    doc.line(baseX, startY - 1, baseX, startY + sorted.length * (barH + gap) - gap + 1);
    Y = startY + sorted.length * (barH + gap) + 8;
  }

  /**
   * Barres horizontales à une seule série, ORDRE FIXE (non trié) — pour les
   * échelles ordinales (tranche d'âge, note 0–10) où l'ordre porte le sens :
   * une teinte, dégradée du plus sombre (premier élément) au plus clair
   * (dernier). Passer flatColor:true pour une échelle nominale (ex: sexe)
   * où tous les éléments portent la même teinte (identité, pas de gradient).
   */
  function barChartOrdinal(items: { label: string; value: number }[], opts?: { flatColor?: boolean }) {
    if (items.length === 0) return;
    const labelW = 40, valueW = 16;
    const chartW = CW - labelW - valueW;
    const barH = 5, gap = 2.2;
    guard(items.length * (barH + gap) + 10);
    const maxV = Math.max(1, ...items.map(i => i.value));
    const baseX = M + labelW;
    const startY = Y;
    items.forEach((it, i) => {
      const y = Y + i * (barH + gap);
      const ratio = opts?.flatColor ? 0 : (items.length > 1 ? i / (items.length - 1) : 0);
      const color = mixRgb(P.secondary, lighten(P.primary, 0.55), ratio);
      const w = Math.max(1.5, (it.value / maxV) * chartW);
      doc.setFillColor(...color);
      doc.roundedRect(baseX, y, w, barH, 1, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.dark);
      doc.text(truncateLabel(it.label, labelW - 3), M, y + barH - 1.2);
      doc.setTextColor(...P.mid);
      doc.text(fmt(it.value), baseX + w + 2, y + barH - 1.2);
    });
    doc.setDrawColor(...P.accentBorder);
    doc.setLineWidth(0.2);
    doc.line(baseX, startY - 1, baseX, startY + items.length * (barH + gap) - gap + 1);
    Y = startY + items.length * (barH + gap) + 8;
  }

  /**
   * Barres horizontales groupées à deux séries (identité fixe : couleur A / couleur B,
   * jamais permutées). Valeurs directement étiquetées à l'extrémité de chaque barre.
   */
  function barChartGrouped2(items: { label: string; a: number; b: number }[], colorA: RGB, colorB: RGB) {
    if (items.length === 0) return;
    const labelW = 40, valueW = 14;
    const chartW = CW - labelW - valueW;
    const barH = 3.4, pairGap = 1, groupGap = 3.5;
    const step = barH * 2 + pairGap + groupGap;
    guard(items.length * step + 10);
    const maxV = Math.max(1, ...items.flatMap(i => [i.a, i.b]));
    const baseX = M + labelW;
    const startY = Y;
    items.forEach((it, i) => {
      const yTop = Y + i * step;
      const wa = Math.max(1, (it.a / maxV) * chartW);
      const wb = Math.max(1, (it.b / maxV) * chartW);
      doc.setFillColor(...colorA);
      doc.roundedRect(baseX, yTop, wa, barH, 0.8, 0.8, "F");
      doc.setFillColor(...colorB);
      doc.roundedRect(baseX, yTop + barH + pairGap, wb, barH, 0.8, 0.8, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.dark);
      doc.text(truncateLabel(it.label, labelW - 3), M, yTop + barH + pairGap / 2 + 1.2);
      doc.setFontSize(6.5);
      doc.setTextColor(...P.mid);
      doc.text(fmt(it.a), baseX + wa + 1.5, yTop + barH - 0.6);
      doc.text(fmt(it.b), baseX + wb + 1.5, yTop + barH + pairGap + barH - 0.6);
    });
    doc.setDrawColor(...P.accentBorder);
    doc.setLineWidth(0.2);
    doc.line(baseX, startY - 1, baseX, startY + items.length * step - groupGap + 1);
    Y = startY + items.length * step + 8;
  }

  /**
   * Dessine un segment d'anneau (donut) entre deux angles, par polygone
   * (arc extérieur + arc intérieur inversé) — jsPDF n'a pas de primitive
   * d'arc native. Angles en radians, 0 = droite, sens horaire (repère écran).
   */
  function drawDonutSegment(cx: number, cy: number, innerR: number, outerR: number, a0: number, a1: number, color: RGB) {
    const steps = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 36))); // ~1 point tous les 5°
    const outerPts: [number, number][] = [];
    const innerPts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      outerPts.push([cx + outerR * Math.cos(a), cy + outerR * Math.sin(a)]);
      innerPts.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
    }
    const poly = [...outerPts, ...innerPts.reverse()];
    const deltas: [number, number][] = [];
    for (let i = 1; i < poly.length; i++) {
      deltas.push([poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]]);
    }
    doc.setFillColor(...color);
    doc.lines(deltas, poly[0][0], poly[0][1], [1, 1], "F", true);
  }

  /** Légende à puces rondes avec valeur en gras (identité + magnitude). */
  function donutLegend(items: { color: RGB; label: string; value: number }[]) {
    guard(8);
    let x = M;
    items.forEach(it => {
      doc.setFillColor(...it.color);
      doc.circle(x + 1.6, Y + 1.6, 1.6, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...P.mid);
      const labelText = `${it.label} `;
      doc.text(labelText, x + 4.6, Y + 2.7);
      const labelW = doc.getTextWidth(labelText);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...P.dark);
      doc.text(fmt(it.value), x + 4.6 + labelW, Y + 2.7);
      const valueW = doc.getTextWidth(fmt(it.value));
      x += 4.6 + labelW + valueW + 7;
    });
    Y += 8;
  }

  /**
   * Anneau centré avec total au centre et légende (puce + libellé + valeur)
   * en dessous — identité catégorielle, couleurs fournies par l'appelant
   * (nominal : teintes fixes ; ordinal : dégradé d'une teinte).
   */
  function donutWithLegend(items: { label: string; value: number; color: RGB }[]) {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total <= 0) return;
    const outerR = 16, innerR = 9;
    guard(outerR * 2 + 16);
    const cx = M + CW / 2;
    const cy = Y + outerR;
    let angle = -Math.PI / 2;
    const gapRad = items.filter(i => i.value > 0).length > 1 ? 0.04 : 0;
    items.forEach(it => {
      const sweepFull = (it.value / total) * (2 * Math.PI);
      if (it.value > 0 && sweepFull - gapRad > 0) {
        drawDonutSegment(cx, cy, innerR, outerR, angle, angle + sweepFull - gapRad, it.color);
      }
      angle += sweepFull;
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...P.dark);
    doc.text(fmt(total), cx, cy + 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...P.mid);
    doc.text("total", cx, cy + 4.5, { align: "center" });
    Y = cy + outerR + 4;
    donutLegend(items.map(i => ({ color: i.color, label: i.label, value: i.value })));
  }

  /**
   * Courbe(s) de tendance — jusqu'à 2 séries, identité fixe (couleur A / B),
   * légende obligatoire, points ronds sur chaque valeur, axe Y 0→max seulement
   * (gridlines recessives, pas de grille pleine pour rester léger en PDF).
   */
  function lineChart(dates: string[], series: { label: string; color: RGB; values: number[] }[]) {
    if (dates.length === 0 || series.length === 0) return;
    const chartH = 32, leftPad = 12;
    const chartW = CW - leftPad;
    guard(chartH + 18);
    const baseX = M + leftPad;
    const baseY = Y + chartH;
    const maxV = Math.max(1, ...series.flatMap(s => s.values));
    doc.setDrawColor(...P.accentBorder);
    doc.setLineWidth(0.2);
    doc.line(baseX, Y, baseX, baseY);
    doc.line(baseX, baseY, baseX + chartW, baseY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...P.mid);
    doc.text(fmt(maxV), M, Y + 2);
    doc.text("0", M, baseY + 1);

    const stepX = dates.length > 1 ? chartW / (dates.length - 1) : 0;
    series.forEach(s => {
      const pts = s.values.map((v, i) => [baseX + i * stepX, baseY - (v / maxV) * chartH] as [number, number]);
      doc.setDrawColor(...s.color);
      doc.setLineWidth(0.6);
      for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      doc.setFillColor(...s.color);
      pts.forEach(p => doc.circle(p[0], p[1], 0.8, "F"));
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...P.mid);
    const idxs = dates.length <= 6
      ? dates.map((_, i) => i)
      : [0, Math.floor((dates.length - 1) / 2), dates.length - 1];
    idxs.forEach(i => {
      const x = baseX + i * stepX;
      const align = i === 0 ? "left" : i === dates.length - 1 ? "right" : "center";
      doc.text(fmtDate(dates[i]), x, baseY + 5, { align });
    });
    Y = baseY + 9;
  }

  function table(head: string[], body: (string | number)[][]) {
    guard(28);
    autoTable(doc, {
      startY: Y,
      head: [head],
      body,
      margin: { left: M, right: M },
      styles: {
        fontSize: 8, cellPadding: 3,
        textColor: P.dark,
        lineColor: P.accentBorder,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: P.primary,
        textColor: P.headerText,
        fontStyle: "bold", fontSize: 8,
      },
      alternateRowStyles: { fillColor: P.accent },
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    const autoTableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
    Y = (autoTableDoc.lastAutoTable?.finalY ?? Y) + 6;
  }

  // ─────────────────────────────────────────────────────────
  // Construction du document
  // ─────────────────────────────────────────────────────────
  coverPage();

  // Totaux globaux
  const totalTastings = tastings.length;
  // Nombre de produits (quantité), pas de lignes de vente — une ligne peut
  // porter plusieurs unités (ex : 4 canettes en une seule saisie).
  const totalVentesNormales  = sales
    .filter(s => (s.type_vente ?? "NORMAL") === "NORMAL")
    .reduce((a, s) => a + (s.quantity ?? 0), 0);
  // "Produits offerts" = quantité réellement offerte (GRATUIT + PROMOTION),
  // pas un décompte de lignes de vente (qui compterait des clients, pas des produits).
  const totalProduitsOfferts = sales
    .filter(s => s.type_vente === "GRATUIT" || s.type_vente === "PROMOTION")
    .reduce((a, s) => a + (s.quantity ?? 0), 0);
  const totalVentesHorsPromo = sales
    .filter(s => (s.type_vente ?? "NORMAL") === "NORMAL" && !s.est_achat_promo)
    .reduce((a, s) => a + (s.quantity ?? 0), 0);
  const totalRevenue  = sales.reduce((a, s) => a + (s.total_amount ?? 0), 0);
  const totalGoodies  = gainsGoodies.length;

  sectionTitle("Synthèse globale");
  const kpis = [
    cfg.show_kpi_degustations    ? { value: fmt(isVenteCampagne ? totalVentesNormales : totalTastings), label: TASTING_LABEL } : null,
    cfg.show_kpi_ventes          ? { value: fmt(totalProduitsOfferts),   label: OFFERED_LABEL }          : null,
    cfg.show_kpi_ventes_hors_promo ? { value: fmt(totalVentesHorsPromo), label: "Ventes hors promo" }    : null,
    cfg.show_kpi_ca              ? { value: `${totalRevenue.toFixed(0)} €`, label: "Chiffre d'affaires" } : null,
    cfg.show_kpi_goodies         ? { value: fmt(totalGoodies),           label: "Goodies distribués" }   : null,
    cfg.show_kpi_sites           ? { value: fmt(siteStats.length),       label: "Sites actifs" }         : null,
    // Toutes les personnes ayant participé à la campagne — même valeur que
    // le KPI "Ventes" (chaque dégustation ou vente normale = un client
    // rencontré), affichée sous un libellé explicite.
    cfg.show_kpi_personnes_touchees ? { value: fmt(isVenteCampagne ? totalVentesNormales : totalTastings), label: "Personnes touchées" } : null,
  ].filter(Boolean) as { value: string | number; label: string }[];
  if (kpis.length > 0) kpiRow(kpis);

  // ── Page de synthèse condensée : tous les graphiques regroupés ─────────
  // Métrique de comparaison par site : ventes NORMAL (quantités réellement
  // achetées, hors produits offerts GRATUIT/PROMOTION) rapportées aux jours
  // d'activité réels du site — comparaison équitable entre sites qui n'ont
  // pas travaillé le même nombre de jours sur la campagne.
  if (cfg.show_section_graphiques && siteStats.length > 0) {
    sectionTitle("Graphiques");

    // Comparaison par site
    guard(6);
    chartTitle("Ventes normales par jour actif, par site (du plus élevé au plus faible)");
    barChartSequential(siteStats.map(s => ({ label: s.name, value: s.avgVentesNormalesParJour })));

    guard(14);
    chartTitle("Ventes normales vs produits offerts, par jour actif et par site");
    legendRow([{ color: P.primary, label: "Ventes normales" }, { color: P.mid, label: "Produits offerts" }]);
    barChartGrouped2(
      siteStats.map(s => ({ label: s.name, a: s.avgVentesNormalesParJour, b: s.avgOffertsParJour })),
      P.primary, P.mid
    );

    // Tendance journalière (toute la période avec activité)
    const trend = buildDailyTrend(tastings, sales);
    if (trend.dates.length > 1) {
      guard(20);
      chartTitle("Tendance journalière — dégustations vs ventes normales");
      legendRow([{ color: P.primary, label: TASTING_LABEL }, { color: P.mid, label: "Ventes normales" }]);
      lineChart(trend.dates, [
        { label: TASTING_LABEL, color: P.primary, values: trend.tastingsPerDay },
        { label: "Ventes normales", color: P.mid, values: trend.salesPerDay },
      ]);
    }

    // Profil des clients (formulaire hôtesse, ou Vente directe pour une campagne VENTE)
    if (cfg.show_col_tranche_age) {
      const ageDist = buildAgeDistribution(tastings, sales, isVenteCampagne);
      if (ageDist.some(a => a.value > 0)) {
        guard(14);
        chartTitle("Répartition des clients par tranche d'âge");
        barChartOrdinal(ageDist);
      }
    }

    const genreDist = buildGenreDistribution(tastings, sales, isVenteCampagne);
    if (genreDist.some(g => g.value > 0)) {
      guard(50);
      chartTitle("Répartition des clients par sexe");
      donutWithLegend([
        { label: "Hommes", value: genreDist[0].value, color: P.primary },
        { label: "Femmes", value: genreDist[1].value, color: P.mid },
      ]);
    }

    if (cfg.show_col_intention_achat) {
      const intentionDist = buildIntentionDistribution(tastings);
      if (intentionDist.some(i => i.value > 0)) {
        guard(50);
        chartTitle("Intention d'achat déclarée");
        donutWithLegend(intentionDist.map((it, i) => ({
          label: it.label,
          value: it.value,
          color: mixRgb(P.secondary, lighten(P.primary, 0.55), intentionDist.length > 1 ? i / (intentionDist.length - 1) : 0),
        })));
      }
    }

    // Retours clients (notes sensorielles, si activées sur la campagne)
    // Échelle réelle 1–max (5 ou 10, configurable par campagne) — jamais 0-10 fixe.
    if (cfg.inclure_notes_sensorielles) {
      const goutMax = campaign.note_gout_max ?? 5;
      const gout = buildNoteDistribution(tastings, sales, isVenteCampagne, "note_gout", goutMax);
      if (gout.some(n => n.value > 0)) {
        guard(14);
        chartTitle(`Note de goût (1-${goutMax})`);
        barChartOrdinal(gout);
      }

      const ambianceMax = campaign.note_ambiance_max ?? 5;
      const ambiance = buildNoteDistribution(tastings, sales, isVenteCampagne, "note_ambiance", ambianceMax);
      if (ambiance.some(n => n.value > 0)) {
        guard(14);
        chartTitle(`Note d'ambiance (1-${ambianceMax})`);
        barChartOrdinal(ambiance);
      }
    }

    // Le détail complet (tableaux) démarre sur une page neuve — la synthèse
    // condensée (KPIs + graphiques) reste groupée sur les pages précédentes.
    newPage();
  }

  // ── Synthèse par site (offres promotionnelles réellement appliquées) ───
  // Basé sur GainPromotion (données réelles), pas sur une mécanique
  // supposée à partir des ventes — une ligne par (site, offre) : le nom de
  // l'offre, combien de fois elle a été appliquée, combien de boissons
  // offertes au total pour cette offre. Pas de colonne hôtesse (agrégé au
  // niveau site).
  if (cfg.show_section_offres_promo) {
    sectionTitle("Synthèse par site");
    const offresParSite = buildOffresParSite(gainsPromotions);
    if (offresParSite.length > 0) {
      table(
        ["Site", "Offre promo appliquée", "Nb fois appliquée", "Boissons offertes"],
        offresParSite.map(o => [o.site, o.offre, fmt(o.fois), fmt(o.qtyOfferte)])
      );
    }
  }

  // ── Gains goodies globaux ──────────────────────────────
  const offrLabel  = isGMS ? "Canettes offertes" : isCHR ? "Bouteilles offertes" : "Offres produit";
  const tickLabel  = isGMS ? "Tickets tombola"   : isCHR ? "Tirages tombola"     : "Tickets";
  if (cfg.show_section_gains_goodies) {
  sectionTitle("Détail des gains de goodies");
  const gainsHead = ["Site", TASTING_LABEL, OFFERED_LABEL,
    ...(cfg.show_col_goodies ? ["Goodies"] : []),
    ...(cfg.show_col_promo_details ? [offrLabel, tickLabel] : []),
  ];
  table(
    gainsHead,
    siteStats.map(s => [
      s.name, fmt(s.tastings), fmt(s.sales),
      ...(cfg.show_col_goodies ? [fmt(s.goodies)] : []),
      ...(cfg.show_col_promo_details ? [
        fmt(isGMS ? (s.promoGains.canettesOffertes ?? 0) : isCHR ? (s.promoGains.bouteillesOffertes ?? 0) : 0),
        fmt(isGMS ? (s.promoGains.ticketsTombola ?? 0)   : isCHR ? (s.promoGains.tirages ?? 0) : 0),
      ] : []),
    ])
  );
  } // end show_section_gains_goodies

  // ── Observations manuelles ─────────────────────────────
  if (cfg.show_observations && cfg.observations_manuelles) {
    sectionTitle("Observations");
    guard(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...P.dark);
    const lines = doc.splitTextToSize(cfg.observations_manuelles, CW);
    doc.text(lines, M, Y);
    Y += lines.length * 5 + 6;
  }

  // ── Horaires d'ouverture des sites ─────────────────────
  if (cfg.show_section_horaires_sites && horaires.length > 0) {
    sectionTitle("Horaires d'ouverture des sites");
    const siteHoraires = buildSiteHoraires(horaires, siteStats);
    table(
      ["Site", "Horaires", "Jours animés"],
      siteHoraires.map(s => [s.name, s.horaires, fmt(s.jours)])
    );
  }

  // ── Boissons vendues / gratuites par jour d'activité, par site ─────────
  // Saisies indépendantes de l'hôtesse (cf. DonneesSiteJour, une ligne par
  // site+date). "Boissons vendues" est calculé depuis les ventes NORMAL
  // réelles (pas depuis stock_boissons, un stock général saisi à part).
  // Le suivi des boissons GRATUITES (reçu/reporté/restant) suit exactement
  // la même logique que les UGs goodies : "Reporté" = restant du jour
  // d'activité précédent pour ce site.
  if (cfg.show_section_stock_boissons && donneesSiteJour.length > 0) {
    sectionTitle("Boissons vendues / gratuites par jour d'activité, par site");

    const parSite = new Map<string, DonneesSiteJour[]>();
    donneesSiteJour.forEach(d => {
      if (!parSite.has(d.site)) parSite.set(d.site, []);
      parSite.get(d.site)!.push(d);
    });

    [...parSite.entries()].forEach(([siteId, entries]) => {
      const site = siteStats.find(s => s.id === siteId);
      const siteName = site?.name ?? entries[0]?.site_nom ?? "—";
      const hIds = site?.hostesses.map(h => h.id) ?? [];
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

      guard(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...P.dark);
      doc.text(siteName, M, Y);
      Y += 5;

      // "Reçu" = nombre_boissons_gratuites (champ manuel réellement utilisé
      // sur le terrain pour indiquer le stock de boissons gratuites apporté
      // sur le site — pas le champ quantite_gratuites_recue, jamais renseigné
      // en pratique). "Boissons offertes" = quantité réellement offerte via
      // la mécanique promo (Vente type_vente=PROMOTION, liée aux
      // GainPromotion). "Restant" est recalculé ici (Reçu − Offertes) pour
      // que chaque ligne s'additionne correctement.
      let totalVendues = 0, totalOffertesCumule = 0, totalRecuFraisCumule = 0, totalReporteCumule = 0;
      let prevRestant: number | null = null;
      const body = sorted.map((d, i) => {
        const dateSales = sales.filter(s => hIds.includes(s.hostess_id) && s.created_at?.slice(0, 10) === d.date);
        const vendues = dateSales
          .filter(s => (s.type_vente ?? "NORMAL") === "NORMAL")
          .reduce((a, s) => a + (s.quantity ?? 0), 0);
        const offertes = dateSales
          .filter(s => s.type_vente === "PROMOTION")
          .reduce((a, s) => a + (s.quantity ?? 0), 0);
        const recu = d.nombre_boissons_gratuites;
        const reporte = i > 0 ? prevRestant : null;
        const recuFrais = recu != null ? Math.max(0, recu - (reporte ?? 0)) : null;
        const restant = recu != null ? Math.max(0, recu - offertes) : null;

        totalVendues += vendues;
        totalOffertesCumule += offertes;
        if (recuFrais != null) totalRecuFraisCumule += recuFrais;
        if (reporte) totalReporteCumule += reporte;
        prevRestant = restant;

        return [
          fmtDate(d.date), d.conditionnement_display, fmt(vendues), fmt(offertes),
          recuFrais != null ? fmt(recuFrais) : "—",
          reporte ? fmt(reporte) : "—",
          restant != null ? fmt(restant) : "—",
        ];
      });
      body.push([
        "TOTAL", "—", fmt(totalVendues), fmt(totalOffertesCumule),
        totalRecuFraisCumule > 0 ? fmt(totalRecuFraisCumule) : "—",
        totalReporteCumule > 0 ? fmt(totalReporteCumule) : "—",
        prevRestant != null ? fmt(prevRestant) : "—",
      ]);

      table(
        ["Date", "Conditionnement", "Boissons vendues", "Boissons offertes", "Reçu (frais)", "Reporté", "Restant"],
        body
      );
    });
  }

  // ── UGs (goodies) : détail par jour d'activité, par site ─
  // Chaque ligne LivraisonGoodiesJour = un jour d'activité réel pour (site, goodie).
  // "Reporté" = restant du jour d'activité précédent (les goodies non distribués
  // restent physiquement sur site et alimentent le stock disponible du jour suivant),
  // qu'il ait été reporté automatiquement (est_report) ou réapprovisionné manuellement.
  if (cfg.show_section_ugs_livraisons && livraisons.length > 0) {
    sectionTitle("UGs (goodies) — reçus / reportés / gagnés / restants par jour d'activité");

    const parSiteGoodie = new Map<string, { siteName: string; goodieNom: string; jours: LivraisonGoodiesJour[] }>();
    livraisons.forEach(l => {
      const key = `${l.site}__${l.goodie}`;
      if (!parSiteGoodie.has(key)) {
        parSiteGoodie.set(key, { siteName: l.site_nom, goodieNom: l.goodie_nom, jours: [] });
      }
      parSiteGoodie.get(key)!.jours.push(l);
    });

    // Total par goodie (tous sites confondus), pour le récapitulatif final.
    const totalParGoodie = new Map<string, { gagne: number; restant: number }>();

    [...parSiteGoodie.values()].forEach(({ siteName, goodieNom, jours }) => {
      const sorted = [...jours].sort((a, b) => a.date.localeCompare(b.date));

      guard(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...P.dark);
      doc.text(`${siteName} — ${goodieNom}`, M, Y);
      Y += 5;

      let totalRecusFrais = 0, totalGagne = 0, totalReporteCumule = 0;
      const body = sorted.map((l, i) => {
        const reporte = i > 0 ? sorted[i - 1].restants_du_jour : 0;
        const recusFrais = Math.max(0, l.quantite_apportee - reporte);
        totalRecusFrais += recusFrais;
        totalGagne += l.gains_du_jour;
        if (reporte > 0) totalReporteCumule += reporte;
        return [
          goodieNom,
          fmtDate(l.date),
          fmt(recusFrais),
          reporte > 0 ? fmt(reporte) : "—",
          fmt(l.gains_du_jour),
          fmt(l.restants_du_jour),
        ];
      });
      const restantFinal = Math.max(0, totalRecusFrais - totalGagne);
      body.push([
        goodieNom, "TOTAL",
        fmt(totalRecusFrais),
        totalReporteCumule > 0 ? fmt(totalReporteCumule) : "—",
        fmt(totalGagne),
        fmt(restantFinal),
      ]);

      const prevTotal = totalParGoodie.get(goodieNom) ?? { gagne: 0, restant: 0 };
      totalParGoodie.set(goodieNom, { gagne: prevTotal.gagne + totalGagne, restant: prevTotal.restant + restantFinal });

      table(["Goodie", "Date", "Reçus (frais)", "Reporté (veille)", "Gagné", "Restant"], body);
    });

    // Récapitulatif explicite : combien de goodies au total ont été gagnés
    // par les clients (tous sites confondus, par nom de goodie), et s'il
    // reste du stock non distribué.
    if (totalParGoodie.size > 0) {
      guard(20);
      sectionTitle("Total des goodies gagnés par les clients");
      table(
        ["Goodie", "Total gagné (tous sites)", "Restant (tous sites)"],
        [...totalParGoodie.entries()].map(([nom, v]) => [nom, fmt(v.gagne), fmt(v.restant)])
      );
    }
  }

  // ── SECTIONS SELON RÔLE ────────────────────────────────
  if (isAdminOrSupervisor) {
    newPage();

    // ── Détail des dégustations (formulaire hôtesse) ────
    if (cfg.show_section_detail_degustations) {
      sectionTitle("Détail des dégustations");
      const detailHead = ["Hôtesse", "Site",
        ...(cfg.show_col_nom_client ? ["Client"] : []),
        ...(cfg.show_col_tranche_age ? ["Tranche d'âge"] : []),
        ...(cfg.show_col_intention_achat ? ["Intention d'achat"] : []),
        ...(cfg.inclure_notes_sensorielles ? ["Note goût", "Note ambiance"] : []),
        "Achat",
      ];
      table(
        detailHead,
        tastings.map(t => [
          t.hostess_name ?? "—", t.site_name ?? "—",
          ...(cfg.show_col_nom_client ? [t.nom_client || "—"] : []),
          ...(cfg.show_col_tranche_age ? [t.tranche_age_display ?? "—"] : []),
          ...(cfg.show_col_intention_achat ? [t.intention_achat_display ?? "—"] : []),
          ...(cfg.inclure_notes_sensorielles ? [
            t.note_gout != null ? String(t.note_gout) : "—",
            t.note_ambiance != null ? String(t.note_ambiance) : "—",
          ] : []),
          t.a_achete ? "Oui" : "Non",
        ])
      );
    }

    // ── Offres par hôtesse ──────────────────────────────
    if (cfg.show_section_offres_par_hotesse && cfg.show_equipe_hotesses) {
      sectionTitle("Offres promotionnelles par hôtesse");
      const hotOffrHead = ["Hôtesse", "Site", TASTING_LABEL, OFFERED_LABEL, "Qté totale",
        ...(cfg.show_col_promo_details ? [offrLabel, tickLabel] : []),
        ...(cfg.show_col_goodies ? ["Goodies"] : []),
      ];
      table(
        hotOffrHead,
        hostessStats.map(h => [
          h.name, h.site, fmt(h.tastings), fmt(h.sales), fmt(h.totalQty),
          ...(cfg.show_col_promo_details ? [
            fmt(isGMS ? (h.promoGains.canettesOffertes ?? 0) : isCHR ? (h.promoGains.bouteillesOffertes ?? 0) : 0),
            fmt(isGMS ? (h.promoGains.ticketsTombola ?? 0)   : isCHR ? (h.promoGains.tirages ?? 0) : 0),
          ] : []),
          ...(cfg.show_col_goodies ? [fmt(h.goodiesCount)] : []),
        ])
      );
    }

    // ── Performance hôtesses vs objectif journalier ─────
    if (cfg.show_section_perf_hotesses && cfg.show_equipe_hotesses) {
      sectionTitle("Performance hôtesses vs objectif journalier");
      const perfHead = ["Hôtesse", "Site", "Moy./jour", "Obj. journalier",
        ...(cfg.show_col_performance ? ["Taux d'atteinte", "Statut"] : []),
      ];
      table(
        perfHead,
        hostessStats.map(h => [
          h.name, h.site, fmt(h.avgPerDay), fmt(h.dailyObjective),
          ...(cfg.show_col_performance ? [
            `${h.perfPct} %`,
            h.perfPct >= 100 ? "✅ Atteint" : h.perfPct >= 75 ? "⚠️ En approche" : "❌ En deçà",
          ] : []),
        ])
      );
    }

    // ── Performances par site ───────────────────────────
    // Détail transaction par transaction (même niveau que "Détail des ventes"
    // du bulletin condensé) : achat, offre promo déclenchée, goodie remporté.
    // Pas de nom de client (contrairement au bulletin) — utilisé en interne
    // uniquement pour rattacher offres/goodies à la bonne vente.
    if (cfg.show_section_perf_sites) {
      sectionTitle("Performances par site");
      const venteRows = buildVenteRows(sales, siteStats, gainsPromotions, gainsGoodies);
      if (venteRows.length > 0) {
        table(
          ["Site", "Date", "Produit", "Conditionnement", "Qté achetée", "Offre appliquée", "Qté offerte", "Goodie remporté"],
          venteRows.map(r => [
            r.siteName, fmtDate(r.date), r.produit, r.conditionnement,
            r.quantiteAchetee || "—", r.offre, r.quantiteOfferte || "—", r.goodieNom,
          ])
        );
      }
    }

    // ── Goodies par site ────────────────────────────────
    if (cfg.show_section_goodies_par_site) {
      sectionTitle("Goodies distribués par site");
      const goodiesSiteHead = ["Site",
        ...(cfg.show_col_goodies ? ["Goodies directs"] : []),
        ...(cfg.show_col_promo_details ? [offrLabel, tickLabel] : []),
        "Total avantages",
      ];
      table(
        goodiesSiteHead,
        siteStats.map(s => {
          const offrt = isGMS ? (s.promoGains.canettesOffertes ?? 0) : isCHR ? (s.promoGains.bouteillesOffertes ?? 0) : 0;
          const ticks = isGMS ? (s.promoGains.ticketsTombola ?? 0)   : isCHR ? (s.promoGains.tirages ?? 0) : 0;
          return [
            s.name,
            ...(cfg.show_col_goodies ? [fmt(s.goodies)] : []),
            ...(cfg.show_col_promo_details ? [fmt(offrt), fmt(ticks)] : []),
            fmt(s.goodies + offrt + ticks),
          ];
        })
      );
    }

  } else {
    // ── Rapport Entreprise ──────────────────────────────
    newPage();
    if (cfg.show_section_offres_promo) {
      sectionTitle("Détail des offres promotionnelles par site");
      const entOffrHead = ["Site", TASTING_LABEL, OFFERED_LABEL,
        ...(cfg.show_col_promo_details ? [offrLabel, tickLabel] : []),
      ];
      table(
        entOffrHead,
        siteStats.map(s => [
          s.name, fmt(s.tastings), fmt(s.sales),
          ...(cfg.show_col_promo_details ? [
            fmt(isGMS ? (s.promoGains.canettesOffertes ?? 0) : isCHR ? (s.promoGains.bouteillesOffertes ?? 0) : 0),
            fmt(isGMS ? (s.promoGains.ticketsTombola ?? 0)   : isCHR ? (s.promoGains.tirages ?? 0) : 0),
          ] : []),
        ])
      );
    }

    if (cfg.show_section_goodies_par_site) {
      sectionTitle("Goodies distribués par site");
      const entGoodiesHead = ["Site",
        ...(cfg.show_col_goodies ? ["Goodies distribués"] : []),
        ...(cfg.show_col_promo_details ? [offrLabel, tickLabel] : []),
        "Total avantages client",
      ];
      table(
        entGoodiesHead,
        siteStats.map(s => {
          const offrt = isGMS ? (s.promoGains.canettesOffertes ?? 0) : isCHR ? (s.promoGains.bouteillesOffertes ?? 0) : 0;
          const ticks = isGMS ? (s.promoGains.ticketsTombola ?? 0)   : isCHR ? (s.promoGains.tirages ?? 0) : 0;
          return [
            s.name,
            ...(cfg.show_col_goodies ? [fmt(s.goodies)] : []),
            ...(cfg.show_col_promo_details ? [fmt(offrt), fmt(ticks)] : []),
            fmt(s.goodies + offrt + ticks),
          ];
        })
      );
    }
  }

  // ── Pied de page sur toutes les pages ─────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(...P.light);
    doc.rect(0, PH - 10, PW, 10, "F");
    doc.setFillColor(...P.primary);
    doc.rect(0, PH - 10, PW, 1, "F"); // ligne colorée
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...P.mid);
    doc.text(`${firstNonEmpty(company.name, "Rapport")} — ${firstNonEmpty(campaign.name, "Campagne")} — Confidentiel`, M, PH - 4);
    doc.text(`${i} / ${total}`, PW - M, PH - 4, { align: "right" });
  }

  return doc;
}

// ─────────────────────────────────────────────────────────────
// 7. Composant React
// ─────────────────────────────────────────────────────────────

export default function CampaignReport({
  campaign,
  user,
  tastings  = [],
  sales     = [],
  team      = [],
  sites     = [],
  horaires  = [],
  donneesSiteJour = [],
  livraisons = [],
  gainsGoodies = [],
  gainsPromotions = [],
  reportConfig,
  label = "Exporter le rapport PDF",
}: CampaignReportProps) {
  const [loading, setLoading] = useState(false);
  const isAdminOrSupervisor = user?.role === "admin" || user?.role === "supervisor";

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      // Résolution du branding depuis les données de l'entreprise
      const { palette, logoBase64, logoMimeType } = await resolveBranding(campaign.company);

      const hostessStats = buildHostessStats(tastings, sales, team, campaign, gainsGoodies);
      const siteStats    = buildSiteStats(hostessStats, tastings, sales, sites, gainsGoodies);

      const cfg: RapportConfig = reportConfig ?? { ...DEFAULT_RAPPORT_CONFIG };

      const doc = generatePDF({
        campaign, user, hostessStats, siteStats, tastings, sales, horaires,
        donneesSiteJour, livraisons, gainsGoodies, gainsPromotions,
        isAdminOrSupervisor, palette, logoBase64, logoMimeType, cfg,
      });

      const slug = (campaign.name ?? "rapport").replace(/\s+/g, "_").toLowerCase();
      doc.save(`${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Erreur génération PDF :", err);
      alert("Une erreur est survenue lors de la génération du rapport.");
    } finally {
      setLoading(false);
    }
  }, [campaign, user, tastings, sales, team, sites, horaires, donneesSiteJour, livraisons, gainsGoodies, gainsPromotions, isAdminOrSupervisor, reportConfig]);

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      style={{
        // Le bouton lui-même s'adapte à la couleur de l'entreprise via CSS var ou inline
        backgroundColor: campaign.company?.brand?.primaryColor
          ?? campaign.company?.color
          ?? "#dc2626",
      }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity disabled:opacity-60 hover:opacity-90"
    >
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…</>
        : <><FileDown className="w-4 h-4" /> {label}</>}
    </button>
  );
}