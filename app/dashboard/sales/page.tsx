"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useAuth } from "@/components/providers/auth-provider";

import api, { invalidateCache } from "@/lib/api";
import type { Vente, CampagneList, CampagneRapportSites } from "@/lib/types/backend";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { SalesTable } from "@/components/dashboard/SalesTable";
import { useUrlState } from "@/lib/hooks/useUrlState";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, Download, Package, FileText, Building2, MapPin, Archive, Eye, Trash2, Calendar,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  type VenteEnrichie, VenteTypeBadge, venteTypeMeta, fmt, getSaleRevenueAmount, sumSaleRevenue, formatSaleTotal,
} from "@/lib/utils/ventes";

interface ArchivedReport {
  id: string;
  entrepriseNom: string;
  generatedAt: string;
  label: string;
  htmlContent: string;
}

const ARCHIVE_KEY = "btl_rapport_archives";

function loadArchives(): ArchivedReport[] {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveArchive(report: ArchivedReport) {
  const list = loadArchives();
  if (list.some(a => a.id === report.id)) return;
  list.unshift(report);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list.slice(0, 100)));
}

function deleteArchive(id: string) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(loadArchives().filter(a => a.id !== id)));
}

interface GainGoodieReport {
  id: string;
  goodie_nom: string;
  site_nom: string;
  hotesse_nom?: string | null;
  produit_nom: string | null;
  quantite_produit: number;
  nom_client: string | null;
  promotion_nom: string | null;
  promotion_quantite_requise: number | null;
  promotion_quantite_offerte: number | null;
  created_at: string;
}

interface GainPromotionReport {
  id: string;
  type_promotion: "OFFERT" | "GAGNE" | "TIRAGE";
  promotion_description: string;
  quantite_requise: number;
  quantite_offerte: number;
  hotesse_nom: string;
  site_nom: string;
  nom_client: string | null;
  created_at: string;
}

type VenteTypeFilter = "all" | Vente["type_vente"];

const VENTE_TYPE_OPTIONS: { value: VenteTypeFilter; label: string }[] = [
  { value: "all", label: "Tous les types" },
  { value: "NORMAL", label: "Ventes normales" },
  { value: "PROMOTION", label: "Offerts promotion" },
  { value: "GRATUIT", label: "Offerts goodie" },
];

// Helpers ventes (fmt, getSaleRevenueAmount, VenteTypeBadge...) déplacés dans
// lib/utils/ventes.tsx pour être réutilisés par components/dashboard/SalesTable.tsx.

function SalesPageContent() {
  const { user } = useAuth();
  const [sales, setSales] = useState<VenteEnrichie[]>([]);
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useUrlState("campagne", "all");
  const [selectedSaleType, setSelectedSaleType] = useUrlState("type", "all");
  const [selectedHotesse, setSelectedHotesse] = useUrlState("hotesse", "all");
  const [selectedSite, setSelectedSite] = useUrlState("site", "all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [archives, setArchives] = useState<ArchivedReport[]>([]);
  const [view, setView] = useState<'sales' | 'archives'>('sales');

  const isHostess = user?.role === "Hotesse";
  const isAdmin = user?.role === "Administrateur";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ventesRes, campRes] = await Promise.all([
        api.get<VenteEnrichie[]>("/ventes/"),
        api.get<CampagneList[]>("/campagnes/"),
      ]);
      setSales(Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: VenteEnrichie[] }).results ?? []));
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []));
    } catch {
      toast.error("Erreur lors du chargement des ventes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setArchives(loadArchives()); }, []);

  const hotesseOptions = useMemo(() => [...new Set(sales.map(s => s.hotesse_nom))].sort(), [sales]);
  const siteOptions = useMemo(() => [...new Set(sales.map(s => s.site_nom))].sort(), [sales]);

  const filtered = sales.filter(s => {
    const campaignMatches = selectedCampaign === "all" || s.campagne_nom === campaigns.find(c => c.id === selectedCampaign)?.nom;
    const typeMatches = selectedSaleType === "all" || s.type_vente === selectedSaleType;
    const hotesseMatches = selectedHotesse === "all" || s.hotesse_nom === selectedHotesse;
    const siteMatches = selectedSite === "all" || s.site_nom === selectedSite;
    const saleDate = s.created_at.slice(0, 10);
    const fromMatches = !dateFrom || saleDate >= dateFrom;
    const toMatches = !dateTo || saleDate <= dateTo;
    return campaignMatches && typeMatches && hotesseMatches && siteMatches && fromMatches && toMatches;
  });

  const stats = {
    total: filtered.length,
    revenue: sumSaleRevenue(filtered),
    unites: filtered.reduce((sum, s) => sum + s.quantite, 0),
  };
  const missingPriceCount = filtered.filter(s => getSaleRevenueAmount(s) === null).length;

  const handleExport = () => {
    const data = filtered.map(s => ({
      Date: new Date(s.created_at).toLocaleDateString("fr-FR"),
      Heure: new Date(s.created_at).toLocaleTimeString("fr-FR"),
      Entreprise: s.entreprise_nom,
      Campagne: s.campagne_nom,
      Site: s.site_nom,
      Produit: s.produit_nom,
      Type: venteTypeMeta[s.type_vente]?.label ?? s.type_vente,
      Hôtesse: s.hotesse_nom,
      Conditionnement: s.conditionnement_display,
      Quantité: s.quantite,
      Total: getSaleRevenueAmount(s) ?? "Prix manquant",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventes");
    XLSX.writeFile(wb, `ventes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export téléchargé");
  };

  const companyGroups = useMemo(() => {
    const map = new Map<string, { name: string; campMap: Map<string, { name: string; sales: VenteEnrichie[] }> }>();
    filtered.forEach(s => {
      if (!map.has(s.entreprise_nom)) map.set(s.entreprise_nom, { name: s.entreprise_nom, campMap: new Map() });
      const cg = map.get(s.entreprise_nom)!;
      if (!cg.campMap.has(s.campagne_nom)) cg.campMap.set(s.campagne_nom, { name: s.campagne_nom, sales: [] });
      cg.campMap.get(s.campagne_nom)!.sales.push(s);
    });
    return [...map.values()].map(cg => ({
      name: cg.name,
      campaigns: [...cg.campMap.values()],
      totalRevenue: sumSaleRevenue([...cg.campMap.values()].flatMap(c => c.sales)),
      totalSales: [...cg.campMap.values()].flatMap(c => c.sales).length,
    }));
  }, [filtered]);

  const buildReportHtml = (
    reportSales: VenteEnrichie[],
    entrepriseNom: string,
    logoUrl: string,
    colorPrimary: string,
    colorSecondary: string,
    goodiesSiteMap: Map<string, Map<string, number>>,
    goodiesTotalsBySite: Map<string, number>,
    gainGoodies: GainGoodieReport[],
    gainPromotions: GainPromotionReport[],
    reportDateLabel: string,
    campagneNom?: string,
  ): string => {
    const esc = (value: string | number | null | undefined) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const formatTime = (value: string) =>
      new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const normalizeClientName = (value: string | null | undefined) =>
      (value || "Client").trim().replace(/\s+(achat|offert)$/i, "").replace(/\s+/g, " ");

    // Les promotions GAGNE/TIRAGE ne créent pas de Vente(PROMOTION) (la récompense
    // passe par la roue) : leur volume offert réel vient de la règle elle-même.
    // OFFERT est exclu ici car déjà compté via la Vente(PROMOTION) correspondante.
    const wheelGainPromotions = gainPromotions.filter(gp => gp.type_promotion !== "OFFERT");

    const totalVendu = reportSales.reduce((sum, s) => sum + (s.type_vente === "NORMAL" ? s.quantite : 0), 0);
    const totalOfferts = reportSales.reduce((sum, s) => sum + (s.type_vente !== "NORMAL" ? s.quantite : 0), 0)
      + wheelGainPromotions.reduce((sum, gp) => sum + (gp.quantite_offerte || 0), 0);
    const totalGoodies = gainGoodies.length;
    const periodGoodiesSiteMap = new Map<string, Map<string, number>>();
    gainGoodies.forEach(gain => {
      if (!periodGoodiesSiteMap.has(gain.site_nom)) {
        periodGoodiesSiteMap.set(gain.site_nom, new Map<string, number>());
      }
      const siteGoodies = periodGoodiesSiteMap.get(gain.site_nom)!;
      siteGoodies.set(gain.goodie_nom, (siteGoodies.get(gain.goodie_nom) ?? 0) + 1);
    });

    const hostMap = new Map<string, { hotesse: string; site: string; actes: number; vendu: number; offert: number; goodies: number }>();
    reportSales.forEach(s => {
      const key = `${s.hotesse_nom}__${s.site_nom}`;
      if (!hostMap.has(key)) hostMap.set(key, { hotesse: s.hotesse_nom || "Non renseignée", site: s.site_nom, actes: 0, vendu: 0, offert: 0, goodies: 0 });
      const row = hostMap.get(key)!;
      if (s.type_vente === "NORMAL") { row.actes += 1; row.vendu += s.quantite; }
      else row.offert += s.quantite;
    });
    gainGoodies.forEach(gain => {
      const hotesse = gain.hotesse_nom || "";
      const exactKey = `${hotesse}__${gain.site_nom}`;
      if (hotesse && hostMap.has(exactKey)) {
        hostMap.get(exactKey)!.goodies += 1;
        return;
      }
      const siteRows = [...hostMap.values()].filter(r => r.site === gain.site_nom);
      if (siteRows.length === 1) {
        siteRows[0].goodies += 1;
        return;
      }
      const fallbackKey = `${hotesse || "Non renseignée"}__${gain.site_nom}`;
      if (!hostMap.has(fallbackKey)) {
        hostMap.set(fallbackKey, { hotesse: hotesse || "Non renseignée", site: gain.site_nom, actes: 0, vendu: 0, offert: 0, goodies: 0 });
      }
      hostMap.get(fallbackKey)!.goodies += 1;
    });
    wheelGainPromotions.forEach(gp => {
      const key = `${gp.hotesse_nom}__${gp.site_nom}`;
      if (!hostMap.has(key)) {
        hostMap.set(key, { hotesse: gp.hotesse_nom || "Non renseignée", site: gp.site_nom, actes: 0, vendu: 0, offert: 0, goodies: 0 });
      }
      hostMap.get(key)!.offert += gp.quantite_offerte || 0;
    });
    const hostesseRows = [...hostMap.values()]
      .sort((a, b) => b.vendu - a.vendu || b.offert - a.offert || a.hotesse.localeCompare(b.hotesse))
      .map(row => `<tr>
        <td class="b">${esc(row.hotesse)}</td><td class="site-name b">${esc(row.site)}</td>
        <td class="r b">${row.actes}</td><td class="r">${row.vendu} u.</td>
        <td class="r text-gift">${row.offert ? `${row.offert} u.` : "0"}</td><td class="r b">${row.goodies}</td>
      </tr>`).join("");

    let goodiesRowsHtml = "";
    if (periodGoodiesSiteMap.size === 0) {
      goodiesRowsHtml = `<tr><td colspan="4" class="muted-row">Aucun détail de goodies enregistré pour cette période.</td></tr>`;
    } else {
      goodiesRowsHtml = [...periodGoodiesSiteMap.entries()].map(([siteNom, dist]) => {
        const itemsHtml = [...dist.entries()].map(([gNom, qty]) => `<div class="goodie-detail-item"><span class="goodie-label">${esc(gNom)}</span><span class="goodie-qty">x${qty}</span></div>`).join("");
        const total = [...dist.values()].reduce((a, b) => a + b, 0);
        const hotesses = [...hostMap.values()].filter(r => r.site === siteNom).map(r => r.hotesse).filter((v, i, a) => a.indexOf(v) === i).join(", ");
        return `<tr><td class="b">${esc(hotesses || "-")}</td><td class="b site-name">${esc(siteNom)}</td><td><div class="goodies-grid-cell">${itemsHtml}</div></td><td class="r b text-star" style="font-size:13px;">${total} lot(s)</td></tr>`;
      }).join("");
    }

    type TRow = { time: number; heure: string; hotesse: string; site: string; client: string; produit: string; vendu: number; offert: number; goodie: string; promo: string; qRequise: number; qOfferte: number };
    const OFFER_WINDOW = 10 * 60 * 1000;
    const isPlaceholder = (c: string) => c === "Client";
    const mergeGoodieLabel = (current: string, addition: string) => {
      if (!addition || addition === "-") return current || "-";
      if (!current || current === "-") return addition;
      const parts = new Set(current.split(", ").filter(Boolean));
      addition.split(", ").filter(Boolean).forEach(part => parts.add(part));
      return [...parts].join(", ");
    };
    const findTriggeringSale = (
      saleTime: number,
      hotesse: string | undefined,
      site: string,
      client: string,
    ) => [...tMap.entries()].filter(([, row]) =>
      row.vendu > 0 &&
      row.site === site &&
      row.hotesse === (hotesse || row.hotesse) &&
      (row.client === client || isPlaceholder(row.client) || isPlaceholder(client)) &&
      Math.abs(row.time - saleTime) <= OFFER_WINDOW
    ).sort(([, a], [, b]) => Math.abs(a.time - saleTime) - Math.abs(b.time - saleTime))[0];
    const goodieLookup = new Map<string, string[]>();
    gainGoodies.forEach(gain => {
      const mb = Math.floor(new Date(gain.created_at).getTime() / 60000);
      const client = normalizeClientName(gain.nom_client);
      const product = gain.produit_nom || "";
      [`${mb}__${gain.site_nom}__${client}__${product}`, `${mb}__${gain.site_nom}__${client}__`].forEach(k => {
        const v = goodieLookup.get(k) ?? []; v.push(gain.goodie_nom); goodieLookup.set(k, v);
      });
    });
    const tMap = new Map<string, TRow>();
    [...reportSales].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(s => {
      const saleTime = new Date(s.created_at).getTime();
      const mb = Math.floor(saleTime / 60000);
      const client = normalizeClientName(s.nom_client);
      let key = `${mb}__${s.hotesse_nom}__${s.site_nom}__${client}__${s.produit_nom}`;
      const goodies = goodieLookup.get(`${mb}__${s.site_nom}__${client}__${s.produit_nom}`) ?? goodieLookup.get(`${mb}__${s.site_nom}__${client}__`);
      if (s.type_vente !== "NORMAL") {
        const match = findTriggeringSale(saleTime, s.hotesse_nom || "Non renseignée", s.site_nom, client);
        if (match) key = match[0];
      }
      if (!tMap.has(key)) tMap.set(key, { time: saleTime, heure: formatTime(s.created_at), hotesse: s.hotesse_nom || "Non renseignée", site: s.site_nom, client, produit: s.produit_nom, vendu: 0, offert: 0, goodie: goodies?.join(", ") || "-", promo: "-", qRequise: 0, qOfferte: 0 });
      const row = tMap.get(key)!;
      if (isPlaceholder(row.client) && !isPlaceholder(client)) row.client = client;
      if (row.goodie === "-" && goodies?.length) row.goodie = goodies.join(", ");
      if (s.type_vente === "NORMAL") row.vendu += s.quantite; else row.offert += s.quantite;
    });
    gainGoodies.forEach(gain => {
      const date = new Date(gain.created_at);
      const mb = Math.floor(date.getTime() / 60000);
      const client = normalizeClientName(gain.nom_client);
      const product = gain.produit_nom || "Lot";
      const hotesse = gain.hotesse_nom || "Non renseignée";
      const match = findTriggeringSale(date.getTime(), gain.hotesse_nom || undefined, gain.site_nom, client);
      const alreadyCountedByFreeSale = reportSales.some(s =>
        s.type_vente === "GRATUIT" &&
        s.site_nom === gain.site_nom &&
        (!gain.produit_nom || s.produit_nom === gain.produit_nom) &&
        (normalizeClientName(s.nom_client) === client || isPlaceholder(normalizeClientName(s.nom_client)) || isPlaceholder(client)) &&
        Math.abs(new Date(s.created_at).getTime() - date.getTime()) <= OFFER_WINDOW
      );
      if (match) {
        const row = match[1];
        if (isPlaceholder(row.client) && !isPlaceholder(client)) row.client = client;
        if (!alreadyCountedByFreeSale) row.offert += gain.quantite_produit || 0;
        row.goodie = mergeGoodieLabel(row.goodie, gain.goodie_nom);
      } else {
        const hasSale = [...tMap.values()].some(row =>
          row.site === gain.site_nom &&
          (!gain.hotesse_nom || row.hotesse === gain.hotesse_nom) &&
          (row.client === client || isPlaceholder(row.client) || isPlaceholder(client)) &&
          Math.abs(row.time - date.getTime()) <= OFFER_WINDOW
        );
        if (!hasSale) tMap.set(`goodie__${gain.id}`, {
          time: date.getTime(),
          heure: formatTime(gain.created_at),
          hotesse,
          site: gain.site_nom,
          client,
          produit: product,
          vendu: 0,
          offert: gain.quantite_produit || 0,
          goodie: gain.goodie_nom,
          promo: gain.promotion_nom || "-",
          qRequise: gain.promotion_quantite_requise || 0,
          qOfferte: gain.promotion_quantite_offerte || 0,
        });
      }
    });
    wheelGainPromotions.forEach(gp => {
      const date = new Date(gp.created_at);
      const client = normalizeClientName(gp.nom_client);
      const hotesse = gp.hotesse_nom || "Non renseignée";
      const match = findTriggeringSale(date.getTime(), gp.hotesse_nom || undefined, gp.site_nom, client);
      if (match) {
        const row = match[1];
        if (isPlaceholder(row.client) && !isPlaceholder(client)) row.client = client;
        row.offert += gp.quantite_offerte || 0;
        if (row.promo === "-") { row.promo = gp.promotion_description; row.qRequise = gp.quantite_requise || 0; row.qOfferte = gp.quantite_offerte || 0; }
      } else {
        tMap.set(`promo__${gp.id}`, {
          time: date.getTime(),
          heure: formatTime(gp.created_at),
          hotesse,
          site: gp.site_nom,
          client,
          produit: "—",
          vendu: 0,
          offert: gp.quantite_offerte || 0,
          goodie: "-",
          promo: gp.promotion_description,
          qRequise: gp.quantite_requise || 0,
          qOfferte: gp.quantite_offerte || 0,
        });
      }
    });
    // Goodie section 2 : rebuild from gainGoodies directly (source of truth)
    const goodiesBySite2 = new Map<string, { goodieNom: string; qty: number; promo: string; qReq: number; qOff: number }[]>();
    gainGoodies.forEach(gain => {
      if (!goodiesBySite2.has(gain.site_nom)) goodiesBySite2.set(gain.site_nom, []);
      const arr = goodiesBySite2.get(gain.site_nom)!;
      const existing = arr.find(r => r.goodieNom === gain.goodie_nom && r.promo === (gain.promotion_nom || "-"));
      if (existing) { existing.qty += 1; }
      else arr.push({ goodieNom: gain.goodie_nom, qty: 1, promo: gain.promotion_nom || "-", qReq: gain.promotion_quantite_requise || 0, qOff: gain.promotion_quantite_offerte || 0 });
    });
    const goodiesRowsHtml2 = gainGoodies.length === 0
      ? `<tr><td colspan="5" class="muted-row">Aucun goodie enregistré pour cette période.</td></tr>`
      : [...goodiesBySite2.entries()].map(([siteNom, items]) => {
          const hotesses = [...hostMap.values()].filter(r => r.site === siteNom).map(r => r.hotesse).filter((v, i, a) => a.indexOf(v) === i).join(", ");
          const total = items.reduce((s, i) => s + i.qty, 0);
          const itemsHtml = items.map(item => `<div class="goodie-detail-item"><span class="goodie-label">${esc(item.goodieNom)}</span><span class="goodie-qty">x${item.qty}</span></div>`).join("");
          const promoLabel = items[0]?.promo !== "-" ? `<div style="font-size:11px;color:#6d28d9;margin-top:4px">${esc(items[0].promo)} (achat ${items[0].qReq}, offre ${items[0].qOff})</div>` : "";
          return `<tr><td class="b">${esc(hotesses || "-")}</td><td class="b site-name">${esc(siteNom)}</td><td><div class="goodies-grid-cell">${itemsHtml}</div>${promoLabel}</td><td class="r b text-star" style="font-size:13px;">${total} lot(s)</td></tr>`;
        }).join("");

    const transactionRowsHtml = tMap.size === 0
      ? `<tr><td colspan="9" class="muted-row">Aucune transaction enregistrée pour cette période.</td></tr>`
      : [...tMap.values()].sort((a, b) => b.time - a.time).map(row => `<tr>
          <td class="time">${esc(row.heure)}</td><td class="b">${esc(row.hotesse)}</td>
          <td class="site-name">${esc(row.site)}</td><td class="b">${esc(row.client)}</td>
          <td><span class="product-pill">${esc(row.produit)}</span></td>
          <td class="r b">${row.vendu ? `${row.vendu} u.` : "-"}</td>
          <td class="r b text-gift">${row.offert ? `+${row.offert} u.` : "-"}</td>
          <td>${esc(row.goodie)}</td>
          <td style="font-size:11px;color:#6d28d9">${row.promo !== "-" ? `${esc(row.promo)}<br/><span style="color:#94a3b8">${row.qRequise} → ${row.qOfferte} offert(s)</span>` : "-"}</td>
        </tr>`).join("");

    const safeNom = entrepriseNom.replace(/\s+/g, "_");
    const safeCamp = campagneNom ? `_${campagneNom.replace(/\s+/g, "_")}` : "";
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Rapport - ${esc(entrepriseNom)}${campagneNom ? ` — ${esc(campagneNom)}` : ""} — ${reportDateLabel}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  :root{--brand-primary:${colorPrimary};--brand-secondary:${colorSecondary}}
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:auto;margin:0mm}
  html,body{background:#fff !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#334155;padding:18mm 15mm;padding-top:85px}
  .action-bar{position:fixed;top:0;left:0;right:0;height:60px;background:#fff !important;box-shadow:0 4px 20px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:flex-end;padding:0 40px;gap:12px;z-index:99999;border-bottom:1px solid #e2e8f0}
  .btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s;border:none}
  .btn-download{background:var(--brand-primary) !important;color:#fff !important}.btn-download:hover{opacity:.9}
  .btn-print{background:#f1f5f9 !important;color:#334155 !important;border:1px solid #cbd5e1 !important}.btn-print:hover{background:#e2e8f0 !important}
  .report-wrapper{background:#fff !important;max-width:980px;margin:0 auto;padding:34px}
  .hdr-container{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid var(--brand-primary);padding-bottom:24px;margin-bottom:32px}
  .hdr-logo-area{display:flex;align-items:center;gap:18px}
  .corporate-logo-wrapper{width:65px;height:65px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8fafc !important;border:1px solid #e2e8f0}
  .corporate-logo-img{width:100%;height:100%;object-fit:contain}
  .corporate-logo-fallback{width:100%;height:100%;background:linear-gradient(135deg,var(--brand-primary),var(--brand-secondary)) !important;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:900}
  .hdr-text h1{font-size:24px;font-weight:900;color:var(--brand-primary);letter-spacing:-.5px;text-transform:uppercase;line-height:1.15}
  .hdr-text p{color:#64748b;font-size:16px;margin-top:6px;font-weight:800}
  .meta-date{text-align:right;color:#64748b;font-size:12px}
  .meta-date .date-box{background:#f8fafc !important;padding:8px 16px;border-radius:10px;border:1px solid #dbe3ec;margin-top:8px;display:inline-block;font-weight:800;color:#334155;font-size:15px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:38px}
  .kpi{background:#f8fafc !important;border:1px solid #dbe3ec;border-radius:14px;padding:18px 20px}
  .kpi .l{font-size:13px;color:#64748b;font-weight:900;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  .kpi .v{font-size:26px;font-weight:950;color:#0f172a;letter-spacing:-.4px}
  h2.section-title{font-size:16px;font-weight:900;color:var(--brand-primary);margin:34px 0 16px;text-transform:uppercase;letter-spacing:.2px;display:flex;align-items:center;gap:6px}
  table{width:100%;border-collapse:collapse;margin-bottom:35px;background:#fff !important}
  th{background:var(--brand-primary) !important;color:#fff !important;padding:12px 14px;text-align:left;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.3px;line-height:1.05}
  th:first-child{border-top-left-radius:9px}th:last-child{border-top-right-radius:9px}
  td{padding:12px 14px;border-bottom:1px solid #dbe3ec;vertical-align:middle;font-size:13px}
  .r{text-align:right}.b{font-weight:700}
  .site-name{color:var(--brand-primary) !important}
  .text-gift{color:var(--brand-primary) !important;font-weight:900}
  .text-star{color:#6d28d9 !important;font-weight:600}
  .time{font-family:ui-monospace,Menlo,Consolas,monospace;color:#64748b;font-size:13px}
  .product-pill{display:inline-block;background:#f1f5f9 !important;border-radius:8px;padding:4px 10px;font-weight:800;color:#475569;font-size:12px}
  .muted-row{color:#94a3b8 !important;padding:24px 26px !important;font-weight:700}
  .goodies-grid-cell{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}
  .goodie-detail-item{background:#f3e8ff !important;border:1px solid #e9d5ff;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center}
  .goodie-label{color:#581c87 !important;font-weight:600;font-size:11px}
  .goodie-qty{background:#7e22ce !important;color:#fff !important;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px}
  .tot-row td{background:var(--brand-primary) !important;color:#fff !important;font-weight:800;padding:14px;font-size:12px}
  .tot-row td.text-gift{color:#fef3c7 !important}.tot-row td.text-star{color:#f3e8ff !important}
  .page-break{break-before:page;page-break-before:always;padding-top:8px}
  .foot{margin-top:20px;text-align:center;color:#94a3b8;font-size:10px;border-top:1px dashed #e2e8f0;padding-top:15px}
  @media print{
    html,body{padding:0 !important;background:white !important;margin:0mm !important}
    body{padding:20mm 15mm !important}
    .action-bar{display:none !important}
    .report-wrapper{border:none !important;box-shadow:none !important;padding:0 !important;max-width:100% !important}
    .page-break{break-before:page;page-break-before:always}
    table{page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}
  }
</style></head>
<body>
<div class="action-bar">
  <button class="btn btn-download" onclick="generateDirectPDF()">⬇ PDF</button>
  <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer</button>
</div>
<div id="capture-zone" class="report-wrapper">
  <div class="hdr-container">
    <div class="hdr-logo-area">
      <div class="corporate-logo-wrapper">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="corporate-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />` : ""}
        <div class="corporate-logo-fallback" style="${logoUrl ? "display:none;" : "display:flex;"}">${esc(entrepriseNom.charAt(0))}</div>
      </div>
      <div class="hdr-text"><h1>Rapport de performance</h1><p>${esc(entrepriseNom)}</p>${campagneNom ? `<p style="font-size:13px;color:#0d9488;font-weight:800;margin-top:4px;letter-spacing:-.2px">Campagne : ${esc(campagneNom)}</p>` : ""}</div>
    </div>
    <div class="meta-date">Rapport du<br/><div class="date-box">${reportDateLabel}</div></div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="l">Clients servis / ventes</div><div class="v">${reportSales.filter(s => s.type_vente === "NORMAL").length}</div></div>
    <div class="kpi"><div class="l">Volume total vendu</div><div class="v">${totalVendu} u.</div></div>
    <div class="kpi"><div class="l">Volume total offert</div><div class="v text-gift">${totalOfferts} u.</div></div>
  </div>
  <h2 class="section-title">1. Performances par hôtesse &amp; site</h2>
  <table><thead><tr>
    <th>Hôtesse</th><th>Site d'affectation</th>
    <th class="r">Actes de vente</th><th class="r">Volume vendu</th><th class="r">Volume offert</th><th class="r">Goodies remis</th>
  </tr></thead><tbody>
    ${hostesseRows || `<tr><td colspan="6" class="muted-row">Aucune vente enregistrée pour cette période.</td></tr>`}
    <tr class="tot-row">
      <td colspan="2" class="b">TOTAL DU JOUR</td>
      <td class="r">${reportSales.filter(s => s.type_vente === "NORMAL").length}</td>
      <td class="r">${totalVendu} u.</td>
      <td class="r text-gift">${totalOfferts} u.</td>
      <td class="r text-star">${totalGoodies}</td>
    </tr>
  </tbody></table>
  <h2 class="section-title">2. Répartition des goodies distribués</h2>
  <table><thead><tr>
    <th>Hôtesse</th><th>Site d'activité</th><th>Détail des Dotations / Offre déclenchée</th><th class="r">Volume total</th>
  </tr></thead><tbody>${goodiesRowsHtml2}</tbody></table>
  <div class="page-break">
    <h2 class="section-title">3. Journal des transactions</h2>
    <table><thead><tr>
      <th>Heure</th><th>Hôtesse</th><th>Site</th><th>Client</th>
      <th>Produit ciblé</th><th class="r">Vol. vendu</th><th class="r">Vol. offert</th><th>Goodie / lot gagné</th>
    </tr></thead><tbody>${transactionRowsHtml}</tbody></table>
  </div>
  <div class="foot">Rapport généré automatiquement depuis MHedia BTL</div>
</div>
<script>
  function generateDirectPDF() {
    const element = document.getElementById('capture-zone');
    const opt = {
      margin: 10,
      filename: "Rapport_${safeNom}${safeCamp}_${reportDateLabel.replace(/\s+/g, "_")}.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }
</script>
</body></html>`;
  };

  const exportCompanyPDF = async (entrepriseNom: string) => {
    let latestSales = sales;
    try {
      invalidateCache("/ventes/");
      const res = await api.get<VenteEnrichie[]>("/ventes/");
      const fresh = Array.isArray(res.data)
        ? res.data
        : ((res.data as { results?: VenteEnrichie[] }).results ?? []);
      setSales(fresh);
      latestSales = fresh;
    } catch {
      // Utilise les données en mémoire en fallback
    }

    const companySales = latestSales.filter(s => s.entreprise_nom === entrepriseNom);
    const todayStr = new Date().toISOString().slice(0, 10);

    const firstSale = companySales[0];
    const logoUrl = firstSale?.entreprise_logo || "";
    const colorPrimary = firstSale?.entreprise_couleur_primaire || "#065f46";
    const colorSecondary = firstSale?.entreprise_couleur_secondaire || "#0d9488";

    const goodiesSiteMap = new Map<string, Map<string, number>>();
    const goodiesTotalsBySite = new Map<string, number>();
    let gainGoodies: GainGoodieReport[] = [];
    let gainPromotions: GainPromotionReport[] = [];

    try {
      const companyCampaignNames = new Set(companySales.map(s => s.campagne_nom));
      const companyCampaigns = campaigns.filter(c =>
        c.entreprise_nom === entrepriseNom && companyCampaignNames.has(c.nom)
      );
      const companySiteNames = new Set(companySales.map(s => s.site_nom));

      const rapports = await Promise.all(
        companyCampaigns.map(c =>
          api.get<CampagneRapportSites>(`/campagnes/${c.id}/rapport-sites/`).then(res => res.data).catch(() => null)
        )
      );

      rapports.forEach(rapport => {
        rapport?.sites.forEach(site => {
          let siteTotal = 0;
          (site.goodies ?? []).forEach(goodie => {
            const quantite = Number(goodie.quantite_distribuee ?? 0);
            if (quantite <= 0) return;
            if (!goodiesSiteMap.has(site.nom)) goodiesSiteMap.set(site.nom, new Map<string, number>());
            const sg = goodiesSiteMap.get(site.nom)!;
            sg.set(goodie.goodie_nom, (sg.get(goodie.goodie_nom) ?? 0) + quantite);
            siteTotal += quantite;
          });
          if (siteTotal === 0) siteTotal = Number(site.goodies_distribues_total ?? 0);
          if (siteTotal > 0) goodiesTotalsBySite.set(site.nom, (goodiesTotalsBySite.get(site.nom) ?? 0) + siteTotal);
        });
      });

      const gainsRes = await api
        .get<GainGoodieReport[] | { results?: GainGoodieReport[] }>("/gains-goodies/")
        .catch(() => ({ data: [] as GainGoodieReport[] }));
      const gainsData = Array.isArray(gainsRes.data) ? gainsRes.data : (gainsRes.data.results ?? []);
      gainGoodies = gainsData.filter(gain => companySiteNames.has(gain.site_nom));

      const gainPromosRes = await api
        .get<GainPromotionReport[] | { results?: GainPromotionReport[] }>("/gains-promotions/")
        .catch(() => ({ data: [] as GainPromotionReport[] }));
      const gainPromosData = Array.isArray(gainPromosRes.data) ? gainPromosRes.data : (gainPromosRes.data.results ?? []);
      gainPromotions = gainPromosData.filter(gp => companySiteNames.has(gp.site_nom));
    } catch {
      toast.error("Impossible de charger le détail des goodies pour le PDF.");
    }

    // Group all company sales by day
    const dayMap = new Map<string, VenteEnrichie[]>();
    companySales.forEach(s => {
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(s);
    });

    // Auto-archive past days not yet saved
    const existingArchiveIds = new Set(loadArchives().map(a => a.id));
    [...dayMap.entries()]
      .filter(([day]) => day < todayStr)
      .forEach(([day, daySales]) => {
        const archiveId = `${entrepriseNom}__${day}`;
        if (existingArchiveIds.has(archiveId)) return;
        const dayGoodies = gainGoodies.filter(g => new Date(g.created_at).toISOString().slice(0, 10) === day);
        const dayGainPromotions = gainPromotions.filter(gp => new Date(gp.created_at).toISOString().slice(0, 10) === day);
        const dayLabel = new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const html = buildReportHtml(daySales, entrepriseNom, logoUrl, colorPrimary, colorSecondary, goodiesSiteMap, goodiesTotalsBySite, dayGoodies, dayGainPromotions, dayLabel);
        saveArchive({ id: archiveId, entrepriseNom, generatedAt: `${day}T23:59:59.000Z`, label: dayLabel, htmlContent: html });
      });
    setArchives(loadArchives());

    // Generate and open today's report only
    const todaySales = dayMap.get(todayStr) ?? [];
    const todayGoodies = gainGoodies.filter(g => new Date(g.created_at).toISOString().slice(0, 10) === todayStr);
    const todayGainPromotions = gainPromotions.filter(gp => new Date(gp.created_at).toISOString().slice(0, 10) === todayStr);
    const todayLabel = new Date(todayStr).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    if (todaySales.length === 0) {
      toast.info(`Aucune vente enregistrée aujourd'hui pour ${entrepriseNom}. Les jours précédents ont été archivés.`);
      return;
    }

    const html = buildReportHtml(todaySales, entrepriseNom, logoUrl, colorPrimary, colorSecondary, goodiesSiteMap, goodiesTotalsBySite, todayGoodies, todayGainPromotions, todayLabel);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.document.title = `Rapport du jour — ${entrepriseNom}`;
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    toast.success(`Rapport du jour ouvert pour ${entrepriseNom}`);
  };

  const exportCampaignPDF = async (entrepriseNom: string, campagneNom: string) => {
    let latestSales = sales;
    try {
      invalidateCache("/ventes/");
      const res = await api.get<VenteEnrichie[]>("/ventes/");
      const fresh = Array.isArray(res.data) ? res.data : ((res.data as { results?: VenteEnrichie[] }).results ?? []);
      setSales(fresh);
      latestSales = fresh;
    } catch { /* utilise les données en mémoire */ }

    const campaignSales = latestSales.filter(s => s.entreprise_nom === entrepriseNom && s.campagne_nom === campagneNom);
    const todayStr = new Date().toISOString().slice(0, 10);

    const firstSale = campaignSales[0];
    const logoUrl = firstSale?.entreprise_logo || "";
    const colorPrimary = firstSale?.entreprise_couleur_primaire || "#065f46";
    const colorSecondary = firstSale?.entreprise_couleur_secondaire || "#0d9488";

    const goodiesSiteMap = new Map<string, Map<string, number>>();
    const goodiesTotalsBySite = new Map<string, number>();
    let gainGoodies: GainGoodieReport[] = [];
    let gainPromotions: GainPromotionReport[] = [];

    try {
      const campaign = campaigns.find(c => c.entreprise_nom === entrepriseNom && c.nom === campagneNom);
      const campaignSiteNames = new Set(campaignSales.map(s => s.site_nom));

      if (campaign) {
        const rapport = await api.get<CampagneRapportSites>(`/campagnes/${campaign.id}/rapport-sites/`).then(r => r.data).catch(() => null);
        rapport?.sites.forEach(site => {
          let siteTotal = 0;
          (site.goodies ?? []).forEach(goodie => {
            const quantite = Number(goodie.quantite_distribuee ?? 0);
            if (quantite <= 0) return;
            if (!goodiesSiteMap.has(site.nom)) goodiesSiteMap.set(site.nom, new Map<string, number>());
            const sg = goodiesSiteMap.get(site.nom)!;
            sg.set(goodie.goodie_nom, (sg.get(goodie.goodie_nom) ?? 0) + quantite);
            siteTotal += quantite;
          });
          if (siteTotal === 0) siteTotal = Number(site.goodies_distribues_total ?? 0);
          if (siteTotal > 0) goodiesTotalsBySite.set(site.nom, (goodiesTotalsBySite.get(site.nom) ?? 0) + siteTotal);
        });
      }

      const gainsRes = await api.get<GainGoodieReport[] | { results?: GainGoodieReport[] }>("/gains-goodies/").catch(() => ({ data: [] as GainGoodieReport[] }));
      const gainsData = Array.isArray(gainsRes.data) ? gainsRes.data : (gainsRes.data.results ?? []);
      gainGoodies = gainsData.filter(gain => campaignSales.some(s => s.site_nom === gain.site_nom));

      const gainPromosRes = await api.get<GainPromotionReport[] | { results?: GainPromotionReport[] }>("/gains-promotions/").catch(() => ({ data: [] as GainPromotionReport[] }));
      const gainPromosData = Array.isArray(gainPromosRes.data) ? gainPromosRes.data : (gainPromosRes.data.results ?? []);
      gainPromotions = gainPromosData.filter(gp => campaignSales.some(s => s.site_nom === gp.site_nom));
    } catch {
      toast.error("Impossible de charger le détail des goodies pour le PDF.");
    }

    const dayMap = new Map<string, VenteEnrichie[]>();
    campaignSales.forEach(s => {
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(s);
    });

    const existingArchiveIds = new Set(loadArchives().map(a => a.id));
    [...dayMap.entries()]
      .filter(([day]) => day < todayStr)
      .forEach(([day, daySales]) => {
        const archiveId = `${entrepriseNom}__${campagneNom}__${day}`;
        if (existingArchiveIds.has(archiveId)) return;
        const dayGoodies = gainGoodies.filter(g => new Date(g.created_at).toISOString().slice(0, 10) === day);
        const dayGainPromos = gainPromotions.filter(gp => new Date(gp.created_at).toISOString().slice(0, 10) === day);
        const dayLabel = new Date(day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const html = buildReportHtml(daySales, entrepriseNom, logoUrl, colorPrimary, colorSecondary, goodiesSiteMap, goodiesTotalsBySite, dayGoodies, dayGainPromos, dayLabel, campagneNom);
        saveArchive({ id: archiveId, entrepriseNom, generatedAt: `${day}T23:59:59.000Z`, label: `${campagneNom} — ${dayLabel}`, htmlContent: html });
      });
    setArchives(loadArchives());

    const todaySales = dayMap.get(todayStr) ?? [];
    const todayGoodies = gainGoodies.filter(g => new Date(g.created_at).toISOString().slice(0, 10) === todayStr);
    const todayGainPromos = gainPromotions.filter(gp => new Date(gp.created_at).toISOString().slice(0, 10) === todayStr);
    const todayLabel = new Date(todayStr).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    if (todaySales.length === 0) {
      toast.info(`Aucune vente aujourd'hui pour la campagne "${campagneNom}". Les jours précédents ont été archivés.`);
      return;
    }

    const html = buildReportHtml(todaySales, entrepriseNom, logoUrl, colorPrimary, colorSecondary, goodiesSiteMap, goodiesTotalsBySite, todayGoodies, todayGainPromos, todayLabel, campagneNom);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.document.title = `Rapport — ${campagneNom} — ${entrepriseNom}`;
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    toast.success(`Rapport ouvert : campagne "${campagneNom}"`);
  };

  return (
    <div className="space-y-6">

      {isAdmin ? (
        <>
          <PageHeader
            title="Ventes"
            description="Organisées par entreprise et campagne"
            icon={<ShoppingCart className="w-5 h-5" />}
            ctaSlot={
              <Button onClick={handleExport} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm">
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Exporter XLSX</span>
              </Button>
            }
          />

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: "🛒", label: "Total ventes",    value: stats.total,  sub: "filtrées"  },
              { icon: "📦", label: "Unités vendues",  value: stats.unites, sub: "produits" },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
                <div className="text-base mb-1">{s.icon}</div>
                <div className="text-xl font-bold leading-none text-foreground">
                  {s.value}{s.sub && <span className="text-xs font-normal text-muted-foreground ml-1">{s.sub}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setView('sales')}
              className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                view === 'sales' ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Ventes</span>
            </button>
            <button
              onClick={() => setView('archives')}
              className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all relative",
                view === 'archives' ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <span className="flex items-center gap-2">
                <Archive className="w-4 h-4" />Rapports archivés
                {archives.length > 0 && (
                  <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{archives.length}</span>
                )}
              </span>
            </button>
          </div>

          {/* Filter + export */}
          {view === 'sales' && <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-56 rounded-xl border-slate-200">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedSaleType} onValueChange={(value) => setSelectedSaleType(value as VenteTypeFilter)}>
              <SelectTrigger className="w-52 rounded-xl border-slate-200">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                {VENTE_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedHotesse} onValueChange={setSelectedHotesse}>
              <SelectTrigger className="w-48 rounded-xl border-slate-200">
                <SelectValue placeholder="Toutes les hôtesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les hôtesses</SelectItem>
                {hotesseOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger className="w-48 rounded-xl border-slate-200">
                <SelectValue placeholder="Tous les sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                {siteOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 px-2.5 text-xs text-muted-foreground" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 px-2.5 text-xs text-muted-foreground" />
            </div>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold transition-colors">
              <Download className="w-4 h-4" />Exporter tout (XLSX)
            </button>
          </div>}

          {view === 'sales' && missingPriceCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {missingPriceCount} vente{missingPriceCount > 1 ? "s" : ""} normale{missingPriceCount > 1 ? "s" : ""} sans prix configuré.
                </p>
                <p className="text-xs text-amber-800">
                  Renseigne un prix indicatif produit ou un prix par site pour les inclure dans le chiffre d'affaires.
                </p>
              </div>
            </div>
          )}

          {/* Archives view */}
          {view === 'archives' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Rapports archivés</h2>
                  <p className="text-sm text-muted-foreground">{archives.length} rapport{archives.length !== 1 ? 's' : ''} — cliquez sur une carte pour consulter</p>
                </div>
              </div>
              {archives.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
                  <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Archive className="w-8 h-8 text-violet-300" />
                  </div>
                  <p className="font-semibold text-foreground mb-1">Aucun rapport archivé</p>
                  <p className="text-sm text-muted-foreground">Les rapports des jours précédents sont archivés automatiquement lors du clic sur "PDF / Impression".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archives.map(archive => (
                    <div
                      key={archive.id}
                      onClick={() => {
                        const blob = new Blob([archive.htmlContent], { type: "text/html;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const win = window.open(url, "_blank");
                        if (win) win.document.title = `Rapport — ${archive.entrepriseNom} — ${archive.label}`;
                        setTimeout(() => URL.revokeObjectURL(url), 15000);
                      }}
                      className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all cursor-pointer p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 bg-violet-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition-colors">
                          <FileText className="w-5 h-5 text-violet-700" />
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); deleteArchive(archive.id); setArchives(loadArchives()); }}
                          className="p-1.5 rounded-lg border border-transparent hover:border-red-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-foreground text-sm truncate">{archive.entrepriseNom}</p>
                        <p className="text-violet-700 font-semibold text-xs truncate">{archive.label}</p>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <p className="text-xs">Archivé le {new Date(archive.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-violet-600 text-xs font-semibold group-hover:gap-2 transition-all">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Consulter le rapport</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Company sections */}
          {view === 'sales' && (loading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : companyGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Aucune vente</p>
              <p className="text-xs text-muted-foreground">Aucune vente ne correspond aux filtres sélectionnés</p>
            </div>
          ) : (
            <div className="space-y-5">
              {companyGroups.map(({ name: compName, campaigns: compCamps, totalRevenue, totalSales }) => (
                <div key={compName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-emerald-100 px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-foreground truncate">{compName}</h2>
                        <p className="text-xs text-muted-foreground">
                          {compCamps.length} campagne{compCamps.length > 1 ? "s" : ""} · {totalSales} vente{totalSales > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-700">{fmt(totalRevenue)}</p>
                      </div>
                      <button onClick={() => exportCompanyPDF(compName)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-xs font-semibold transition-colors shadow-sm">
                        <FileText className="w-3.5 h-3.5" />PDF / Impression
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {compCamps.map(({ name: campName, sales: campSales }) => {
                      const campRevenue = sumSaleRevenue(campSales);
                      return (
                        <div key={campName} className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                              <span className="font-semibold text-sm text-foreground">{campName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-emerald-700">{fmt(campRevenue)}</span>
                              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                                {campSales.length} vente{campSales.length > 1 ? "s" : ""}
                              </span>
                              <button
                                onClick={() => exportCampaignPDF(compName, campName)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white hover:bg-teal-50 text-teal-700 text-xs font-semibold transition-colors shadow-sm"
                                title={`Rapport PDF — ${campName}`}
                              >
                                <FileText className="w-3 h-3" />PDF
                              </button>
                            </div>
                          </div>
                          <SalesTable sales={campSales} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
          )}

        </>
      ) : (
        /* ── Non-admin (Hôtesse / Superviseur / Entreprise) ── */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Ventes</h1>
              <p className="text-muted-foreground mt-1">
                {isHostess ? "Mes ventes enregistrées" : "Ventes de vos campagnes"}
              </p>
            </div>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />Exporter
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: stats.total,    label: "Ventes",          color: "text-emerald-600" },
              { value: stats.unites,   label: "Unités vendues",  color: "text-blue-600"    },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-64 rounded-xl border-slate-200">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedSaleType} onValueChange={(value) => setSelectedSaleType(value as VenteTypeFilter)}>
              <SelectTrigger className="w-52 rounded-xl border-slate-200">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                {VENTE_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {missingPriceCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {missingPriceCount} vente{missingPriceCount > 1 ? "s" : ""} normale{missingPriceCount > 1 ? "s" : ""} sans prix configuré.
                </p>
                <p className="text-xs text-amber-800">
                  Le chiffre d'affaires ignore ces lignes tant qu'un prix produit ou site n'est pas renseigné.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                {isHostess ? "Mes ventes" : "Toutes les ventes"}
              </h3>
              <span className="text-xs text-muted-foreground bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune vente enregistrée</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(sale => (
                  <div key={sale.id}
                    className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{sale.produit_nom}</p>
                          <p className="text-xs text-muted-foreground truncate">{sale.campagne_nom}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <VenteTypeBadge type={sale.type_vente} />
                        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                          {sale.conditionnement_display}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className={cn(
                          "text-xl font-bold",
                          getSaleRevenueAmount(sale) === null ? "text-amber-700" : "text-foreground"
                        )}>
                          {formatSaleTotal(sale)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{sale.site_nom}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!isHostess && (
                      <p className="text-xs text-muted-foreground border-t pt-2">💃 {sale.hotesse_nom}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesPageContent />
    </Suspense>
  );
}
