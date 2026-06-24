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
import type { RapportConfig } from "@/lib/types/backend";
import { DEFAULT_RAPPORT_CONFIG } from "@/lib/types/backend";

type HostessTasting = Tasting & {
  // Données brutes du formulaire hôtesse, utilisées par la section "Détail des dégustations"
  hostess_name?: string;
  site_name?: string;
  product_name?: string;
  nom_client?: string | null;
  tranche_age_display?: string;
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
};
type ReportSale = Sale & {
  notes?: string;
  goodies_given?: number;
  type_vente?: "NORMAL" | "GRATUIT" | "PROMOTION";
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
  reportConfig?: RapportConfig | null;
};
type GeneratePDFArgs = {
  campaign: ReportCampaign;
  user?: Profile | null;
  hostessStats: HostessStat[];
  siteStats: SiteStat[];
  tastings: HostessTasting[];
  sales: ReportSale[];
  horaires: HoraireSite[];
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

function buildHostessStats(tastings: HostessTasting[], sales: ReportSale[], team: StaffMember[], campaign: ReportCampaign): HostessStat[] {
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
      const goodiesCount = hS.reduce((a, s) => {
        if ((s.notes ?? "").includes("Goodie: ✓")) return a + 1;
        return a + (s.goodies_given ?? 0);
      }, 0);
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

function buildSiteStats(hostessStats: HostessStat[], tastings: HostessTasting[], sales: ReportSale[], sites: CampaignSite[]): SiteStat[] {
  return sites.map(site => {
    const hIds = hostessStats.filter(h => h.siteId === site.id).map(h => h.id);
    const sH   = hostessStats.filter(h => h.siteId === site.id);
    const promoGainsAgg = sH.reduce<Record<string, number>>((acc, h) => {
      Object.entries(h.promoGains).forEach(([k, v]) => { acc[k] = (acc[k] ?? 0) + v; });
      return acc;
    }, {});
    return {
      id: site.id, name: site.name ?? "—",
      location: site.zone?.name ?? site.address ?? "—",
      tastings: tastings.filter(t => hIds.includes(t.hostess_id)).length,
      sales:    sales.filter(s => hIds.includes(s.hostess_id)).length,
      revenue:  sales.filter(s => hIds.includes(s.hostess_id)).reduce((a, s) => a + (s.total_amount ?? 0), 0),
      goodies:  sH.reduce((a, h) => a + h.goodiesCount, 0),
      promoGains: promoGainsAgg,
      hostesses: sH,
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

// ─────────────────────────────────────────────────────────────
// 6. Construction PDF
// ─────────────────────────────────────────────────────────────

function generatePDF({
  campaign, user, hostessStats, siteStats, tastings, sales, horaires,
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
    const roleLabel = isAdminOrSupervisor ? "Rapport Interne" : "Rapport Entreprise";
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
  const totalSales    = sales.length;
  const totalVentesHorsPromo = sales.filter(s => (s.type_vente ?? "NORMAL") === "NORMAL").length;
  const totalRevenue  = sales.reduce((a, s) => a + (s.total_amount ?? 0), 0);
  const totalGoodies  = hostessStats.reduce((a, h) => a + h.goodiesCount, 0);

  sectionTitle("Synthèse globale");
  const kpis = [
    cfg.show_kpi_degustations    ? { value: fmt(totalTastings),          label: TASTING_LABEL }          : null,
    cfg.show_kpi_ventes          ? { value: fmt(totalSales),             label: OFFERED_LABEL }          : null,
    cfg.show_kpi_ventes_hors_promo ? { value: fmt(totalVentesHorsPromo), label: "Ventes hors promo" }    : null,
    cfg.show_kpi_ca              ? { value: `${totalRevenue.toFixed(0)} €`, label: "Chiffre d'affaires" } : null,
    cfg.show_kpi_goodies         ? { value: fmt(totalGoodies),           label: "Goodies distribués" }   : null,
    cfg.show_kpi_sites           ? { value: fmt(siteStats.length),       label: "Sites actifs" }         : null,
  ].filter(Boolean) as { value: string | number; label: string }[];
  if (kpis.length > 0) kpiRow(kpis);

  // ── Offres promotionnelles ──────────────────────────────
  if (cfg.show_section_offres_promo) {
  sectionTitle("Détail des offres promotionnelles");
  if (isGMS) {
    const totalCan   = sales.reduce((a, s) => a + (s.quantity ?? 0), 0);
    const totalPacks = sales.filter(s => (s.notes ?? "").includes("packs")).reduce((a, s) => a + (s.quantity ?? 0), 0);
    table(
      ["Mécanique", "Qté achetée", "Avantage offert", "Total distribué"],
      [
        ["4 canettes achetées → 1 canette offerte",     fmt(totalCan),   "Canettes offertes",   fmt(Math.floor(totalCan / 4))],
        ["6 canettes achetées → 1 ticket tombola",      fmt(totalCan),   "Tickets tombola",     fmt(Math.floor(totalCan / 6))],
        ["4 packs achetés → 1 pack offert",             fmt(totalPacks), "Packs offerts",       fmt(Math.floor(totalPacks / 4))],
        ["4 packs achetés → 1 goodie",                  fmt(totalPacks), "Goodies (promo pack)", fmt(Math.floor(totalPacks / 4))],
      ]
    );
  } else if (isCHR) {
    const totalBout = sales.reduce((a, s) => a + (s.quantity ?? 0), 0);
    table(
      ["Mécanique", "Qté achetée", "Avantage offert", "Total distribué"],
      [
        ["3 bouteilles achetées → 1 bouteille offerte", fmt(totalBout), "Bouteilles offertes", fmt(Math.floor(totalBout / 3))],
        ["9 bouteilles achetées → 1 tirage tombola",    fmt(totalBout), "Tirages tombola",     fmt(Math.floor(totalBout / 9))],
      ]
    );
  } else {
    const prodMap: Record<string, { qty: number; rev: number }> = {};
    sales.forEach(s => {
      const k = s.product?.name ?? "—";
      if (!prodMap[k]) prodMap[k] = { qty: 0, rev: 0 };
      prodMap[k].qty += s.quantity ?? 0;
      prodMap[k].rev += s.total_amount ?? 0;
    });
    const offresHead = cfg.show_col_ca ? ["Produit", "Qté vendue", "CA (€)"] : ["Produit", "Qté vendue"];
    table(
      offresHead,
      Object.entries(prodMap).map(([n, v]) => cfg.show_col_ca ? [n, fmt(v.qty), v.rev.toFixed(2)] : [n, fmt(v.qty)])
    );
  }
  } // end show_section_offres_promo

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
    if (cfg.show_section_perf_sites) {
      sectionTitle("Performances par site");
      const siteObj = Math.max(1, Math.ceil(campaign.sales_objective / (siteStats.length || 1)));
      const sitePerfHead = ["Site", "Localisation", TASTING_LABEL, OFFERED_LABEL,
        ...(cfg.show_col_performance ? ["Objectif", "Taux"] : []),
        ...(cfg.show_col_ca ? ["CA (€)"] : []),
        ...(cfg.show_col_goodies ? ["Goodies"] : []),
      ];
      table(
        sitePerfHead,
        siteStats.map(s => [
          s.name, s.location, fmt(s.tastings), fmt(s.sales),
          ...(cfg.show_col_performance ? [fmt(siteObj), `${pct(s.sales, siteObj)} %`] : []),
          ...(cfg.show_col_ca ? [s.revenue.toFixed(2)] : []),
          ...(cfg.show_col_goodies ? [fmt(s.goodies)] : []),
        ])
      );
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
  reportConfig,
}: CampaignReportProps) {
  const [loading, setLoading] = useState(false);
  const isAdminOrSupervisor = user?.role === "admin" || user?.role === "supervisor";

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      // Résolution du branding depuis les données de l'entreprise
      const { palette, logoBase64, logoMimeType } = await resolveBranding(campaign.company);

      const hostessStats = buildHostessStats(tastings, sales, team, campaign);
      const siteStats    = buildSiteStats(hostessStats, tastings, sales, sites);

      const cfg: RapportConfig = reportConfig ?? { ...DEFAULT_RAPPORT_CONFIG };

      const doc = generatePDF({
        campaign, user, hostessStats, siteStats, tastings, sales, horaires,
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
  }, [campaign, user, tastings, sales, team, sites, horaires, isAdminOrSupervisor, reportConfig]);

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
        : <><FileDown className="w-4 h-4" /> Exporter le rapport PDF</>}
    </button>
  );
}