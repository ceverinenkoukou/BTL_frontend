"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import api from "@/lib/api";
import type { Vente, VenteStats, CampagneList } from "@/lib/types/backend";
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
import {
  ShoppingCart, Download, Package, FileText, Building2, MapPin,
} from "lucide-react";
import * as XLSX from "xlsx";

interface VenteEnrichie extends Vente {
  produits_offerts?: number;
  goodies_offerts?: number;
  goodies_details?: string;
  entreprise_logo?: string;
  entreprise_couleur_primaire?: string;
  entreprise_couleur_secondaire?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

export default function SalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<VenteEnrichie[]>([]);
  const [apiStats, setApiStats] = useState<VenteStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampagneList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  const isHostess = user?.role === "Hotesse";
  const isAdmin = user?.role === "Administrateur";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ventesRes, statsRes, campRes] = await Promise.all([
        api.get<VenteEnrichie[]>("/ventes/"),
        api.get<VenteStats>("/ventes/stats/"),
        api.get<CampagneList[]>("/campagnes/"),
      ]);
      setSales(Array.isArray(ventesRes.data) ? ventesRes.data : ((ventesRes.data as { results?: VenteEnrichie[] }).results ?? []));
      setApiStats(statsRes.data);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : ((campRes.data as { results?: CampagneList[] }).results ?? []));
    } catch {
      toast.error("Erreur lors du chargement des ventes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = sales.filter(s =>
    selectedCampaign === "all" || s.campagne_nom === campaigns.find(c => c.id === selectedCampaign)?.nom
  );

  const stats = {
    total: filtered.length,
    revenue: filtered.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0),
    unites: filtered.reduce((sum, s) => sum + s.quantite, 0),
  };

  const handleExport = () => {
    const data = filtered.map(s => ({
      Date: new Date(s.created_at).toLocaleDateString("fr-FR"),
      Heure: new Date(s.created_at).toLocaleTimeString("fr-FR"),
      Entreprise: s.entreprise_nom,
      Campagne: s.campagne_nom,
      Site: s.site_nom,
      Produit: s.produit_nom,
      Hôtesse: s.hotesse_nom,
      Conditionnement: s.conditionnement_display,
      Quantité: s.quantite,
      Total: s.prix_total ?? 0,
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
      totalRevenue: [...cg.campMap.values()].flatMap(c => c.sales).reduce((s, v) => s + Number(v.prix_total ?? 0), 0),
      totalSales: [...cg.campMap.values()].flatMap(c => c.sales).length,
    }));
  }, [filtered]);

  const exportCompanyPDF = (entrepriseNom: string) => {
    const companySales = sales.filter(s => s.entreprise_nom === entrepriseNom);
    const totalRevenue = companySales.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0);
    
    const firstSale = companySales[0];
    const logoUrl = firstSale?.entreprise_logo || "";
    const colorPrimary   = firstSale?.entreprise_couleur_primaire   || "#065f46";
    const colorSecondary = firstSale?.entreprise_couleur_secondaire || "#0d9488";

    // Calcul des teintes dérivées en JS pour éviter color-mix() (non supporté en impression/html2pdf)
    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
      return { r: parseInt(full.slice(0,2),16), g: parseInt(full.slice(2,4),16), b: parseInt(full.slice(4,6),16) };
    };
    const mix = (hex: string, alpha: number) => { const {r,g,b} = hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; };
    const mixOnWhite = (hex: string, alpha: number) => {
      const {r,g,b} = hexToRgb(hex);
      const R = Math.round(r * alpha + 255 * (1 - alpha));
      const G = Math.round(g * alpha + 255 * (1 - alpha));
      const B = Math.round(b * alpha + 255 * (1 - alpha));
      return `rgb(${R},${G},${B})`;
    };

    const c = {
      primary:        colorPrimary,
      secondary:      colorSecondary,
      primaryBg:      mixOnWhite(colorPrimary, 0.08),
      primaryBgMed:   mixOnWhite(colorPrimary, 0.15),
      primaryBorder:  mixOnWhite(colorPrimary, 0.30),
      primaryText:    colorPrimary,
      secondaryBg:    mixOnWhite(colorSecondary, 0.12),
      secondaryBorder:mixOnWhite(colorSecondary, 0.30),
      secondaryText:  colorSecondary,
      kpiCaBg:        mixOnWhite(colorPrimary, 0.06),
      kpiCaBorder:    mixOnWhite(colorPrimary, 0.25),
      hotesseBg:      mixOnWhite(colorPrimary, 0.08),
      hotesseBorder:  mixOnWhite(colorPrimary, 0.22),
      logoGrad:       `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})`,
      brandGrad:      `linear-gradient(135deg, ${colorPrimary} 0%, ${colorSecondary} 100%)`,
    };

    const siteMap = new Map<string, {
      nom: string;
      ventesCount: number;
      unitesVendues: number;
      produitsOfferts: number;
      goodiesCount: number;
      chiffreAffaires: number;
      hotesses: Set<string>;
    }>();

    const goodiesSiteMap = new Map<string, Map<string, number>>();

    companySales.forEach(s => {
      if (!siteMap.has(s.site_nom)) {
        siteMap.set(s.site_nom, {
          nom: s.site_nom,
          ventesCount: 0,
          unitesVendues: 0,
          produitsOfferts: 0, 
          goodiesCount: 0,
          chiffreAffaires: 0,
          hotesses: new Set<string>(),
        });
      }
      const src = siteMap.get(s.site_nom)!;
      src.ventesCount += 1;
      src.unitesVendues += s.quantite;
      src.produitsOfferts += Number(s.produits_offerts ?? 0); 
      src.goodiesCount += Number(s.goodies_offerts ?? 0);
      src.chiffreAffaires += Number(s.prix_total ?? 0);
      if (s.hotesse_nom) src.hotesses.add(s.hotesse_nom);

      if (s.goodies_details && Number(s.goodies_offerts ?? 0) > 0) {
        if (!goodiesSiteMap.has(s.site_nom)) {
          goodiesSiteMap.set(s.site_nom, new Map<string, number>());
        }
        const currentSiteGoodies = goodiesSiteMap.get(s.site_nom)!;
        const currentQty = currentSiteGoodies.get(s.goodies_details) || 0;
        currentSiteGoodies.set(s.goodies_details, currentQty + Number(s.goodies_offerts));
      }
    });

    const globalTotalUnites = companySales.reduce((sum, s) => sum + s.quantite, 0);
    const globalTotalOfferts = companySales.reduce((sum, s) => sum + Number(s.produits_offerts ?? 0), 0);
    const globalTotalGoodies = companySales.reduce((sum, s) => sum + Number(s.goodies_offerts ?? 0), 0);

    const siteRowsHtml = [...siteMap.values()].map(site => `
      <tr>
        <td class="b site-name">📍 ${site.nom}</td>
        <td>
          <div class="tag-container">
            ${[...site.hotesses].map(h => `<span class="tag hotesse-tag">💃 ${h}</span>`).join("")}
          </div>
        </td>
        <td class="r b">${site.ventesCount}</td>
        <td class="r">${site.unitesVendues} u.</td>
        <td class="r text-gift">${site.produitsOfferts}</td>
        <td class="r b text-star">${site.goodiesCount}</td>
      </tr>
    `).join("");

    let goodiesRowsHtml = "";
    if (goodiesSiteMap.size === 0) {
      goodiesRowsHtml = `<tr><td colspan="3" class="text-center" style="color:#94a3b8; padding:20px;">Aucun détail de goodies enregistré pour cette période.</td></tr>`;
    } else {
      goodiesRowsHtml = [...goodiesSiteMap.entries()].map(([siteNom, goodiesDistribution]) => {
        const itemsHtml = [...goodiesDistribution.entries()].map(([goodieNom, quantiteTotale]) => `
          <div class="goodie-detail-item">
            <span class="goodie-label">🎁 ${goodieNom}</span>
            <span class="goodie-qty">x${quantiteTotale}</span>
          </div>
        `).join("");

        const totalSiteGoodies = [...goodiesDistribution.values()].reduce((a, b) => a + b, 0);

        return `
          <tr>
            <td class="b site-name">📍 ${siteNom}</td>
            <td>
              <div class="goodies-grid-cell">${itemsHtml}</div>
            </td>
            <td class="r b text-star" style="font-size:13px;">${totalSiteGoodies} lot(s)</td>
          </tr>
        `;
      }).join("");
    }

    const html = `<!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport de Performance - ${entrepriseNom}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        @page{size:auto;margin:0mm}
        html,body{background-color:#f8fafc !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#334155;padding:20mm 15mm;padding-top:85px}
        
        .action-bar{position:fixed;top:0;left:0;right:0;height:60px;background:#ffffff !important;box-shadow:0 4px 20px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:flex-end;padding:0 40px;gap:12px;z-index:99999;border-bottom:1px solid #e2e8f0;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        .btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:none}
        .btn-download{background:${c.primary} !important;color:#fff !important;}
        .btn-download:hover{opacity:0.9}
        .btn-print{background:#f1f5f9 !important;color:#334155 !important;border:1px solid #cbd5e1 !important;}
        
        .report-wrapper{background:#ffffff !important;max-width:1024px;margin:0 auto;padding:40px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.02);-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        
        .hdr-container{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${c.primary};padding-bottom:20px;margin-bottom:30px}
        .hdr-logo-area{display:flex;align-items:center;gap:18px}
        .corporate-logo-wrapper{width:65px;height:65px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8fafc !important;border:1px solid #e2e8f0}
        .corporate-logo-img{width:100%;height:100%;object-fit:contain}
        .corporate-logo-fallback{width:100%;height:100%;background:${c.logoGrad} !important;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:900;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        .hdr-text h2{font-size:18px;font-weight:800;color:${c.primary};letter-spacing:-0.5px}
        .hdr-text h4{font-size:13px;color:#64748b;margin-top:3px}
        .meta-date{text-align:right;color:#64748b;font-size:11px}
        .meta-date .date-box{background:#f8fafc !important;padding:6px 12px;border-radius:8px;border:1px solid #e2e8f0;margin-top:5px;display:inline-block;font-weight:600;color:#334155}

        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:35px}
        .kpi{background:#f8fafc !important;border:1px solid #e2e8f0;border-radius:12px;padding:15px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        .kpi.primary{background:${c.kpiCaBg} !important;border-color:${c.kpiCaBorder} !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        .kpi .l{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px}
        .kpi .v{font-size:20px;font-weight:800;color:#0f172a}
        .kpi.primary .v{color:${c.primary} !important}

        h2.section-title{font-size:13px;font-weight:700;color:${c.primary};margin-bottom:12px;text-transform:uppercase;letter-spacing:0.3px;display:flex;align-items:center;gap:6px}
        table{width:100%;border-collapse:collapse;margin-bottom:35px;background:#fff !important;}
        th{background:${c.primary} !important;color:#fff !important;padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        th:first-child{border-top-left-radius:8px}
        th:last-child{border-top-right-radius:8px}
        td{padding:12px 14px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
        
        .r{text-align:right}.b{font-weight:700}.text-center{text-align:center}
        .site-name{color:${c.primary} !important;width:25%;font-weight:700}
        .text-gift{color:${c.primary} !important;font-weight:600}
        .text-star{color:${c.secondary} !important;font-weight:600}
        
        .tag-container{display:flex;flex-wrap:wrap;gap:4px}
        .tag{padding:2px 8px;border-radius:6px;font-size:10px;font-weight:500;display:inline-block}
        .hotesse-tag{background:${c.hotesseBg} !important;border:1px solid ${c.hotesseBorder} !important;color:${c.primary} !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        
        .goodies-grid-cell{display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:6px}
        .goodie-detail-item{background:${c.secondaryBg} !important;border:1px solid ${c.secondaryBorder} !important;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        .goodie-label{color:${c.secondary} !important;font-weight:600;font-size:11px}
        .goodie-qty{background:${c.secondary} !important;color:#fff !important;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        
        .tot-row td{background:${c.primary} !important;color:#fff !important;font-weight:800;padding:14px;font-size:12px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        .tot-row td.text-gift{color:rgba(255,255,255,0.9) !important}
        .tot-row td.text-star{color:rgba(255,255,255,0.9) !important}
        
        .foot{margin-top:20px;text-align:center;color:#94a3b8;font-size:10px;border-top:1px dashed #e2e8f0;padding-top:15px}
        
        @media print{
          html,body{padding:0 !important;background:white !important;margin:0mm !important;}
          body{padding:20mm 15mm !important;}
          .action-bar{display:none !important;}
          .report-wrapper{border:none !important;box-shadow:none !important;padding:0 !important;max-width:100% !important;}
          table{page-break-inside:auto}
          tr{page-break-inside:avoid;page-break-after:auto}
        }
      </style>
    </head>
    <body>

      <div class="action-bar">
        <button class="btn btn-download" onclick="generateDirectPDF()"> PDF</button>
        <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer</button>
      </div>
      <div class="report-wrapper">


      <div id="capture-zone" class="report-wrapper">
        <div class="hdr-container">
          <div class="hdr-logo-area">
            <div class="corporate-logo-wrapper">
              ${logoUrl 
                ? `<img src="${logoUrl}" alt="Logo" class="corporate-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />` 
                : ""
              }
              <div class="corporate-logo-fallback" style="${logoUrl ? "display:none;" : "display:flex;"}">
                ${entrepriseNom.charAt(0)}
              </div>
            </div>
            <div class="hdr-text">
            <h2 text-align="center">RAPPORT JOURNALIER</h2>
              <h4>${entrepriseNom}</h4>
            </div>
          </div>
          <div class="meta-date">
            Rapport généré le<br/>
            <div class="date-box">${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="l">Produits Vendus</div><div class="v">${globalTotalUnites} u.</div></div>
          <div class="kpi"><div class="l">Produits Offerts</div><div class="v text-gift">${globalTotalOfferts}</div></div>
          <div class="kpi"><div class="l">Goodies Distribués</div><div class="v text-star">${globalTotalGoodies}</div></div>
        </div>

        <h2 class="section-title"> 1. Performances globales et Cumuls par site</h2>
        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Hôtesses</th>
              <th class="r">Actes de Vente</th>
              <th class="r">Vendus / Consommés</th>
              <th class="r">Offerts</th>
              <th class="r">Goodies (Total)</th>
            </tr>
          </thead>
          <tbody>
            ${siteRowsHtml}
            <tr class="tot-row">
              <td colspan="2" class="b">TOTAL GÉNÉRAL</td>
              <td class="r">${companySales.length}</td>
              <td class="r">${globalTotalUnites} u.</td>
              <td class="r text-gift">${globalTotalOfferts}</td>
              <td class="r text-star">${globalTotalGoodies}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="section-title"> 2. Répartition détaillée des goodies gagnés par site</h2>
        <table>
          <thead>
            <tr>
              <th>Site d'activité</th>
              <th>Détail des Dotations / Lots distribués</th>
              <th class="r">Volume total</th>
            </tr>
          </thead>
          <tbody>
            ${goodiesRowsHtml}
          </tbody>
        </table>

        
      </div>

      <script>
        function generateDirectPDF() {
          const element = document.getElementById('capture-zone');
          const opt = {
            margin:       10,
            filename:     "Rapport_Performance_${entrepriseNom.replace(/\s+/g, '_')}.pdf",
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          
          // Lancement du téléchargement direct sans ouvrir la boîte de dialogue d'impression
          html2pdf().set(opt).from(element).save();
        }
      </script>
    </body>
    </html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    
    if (win) {
      win.document.title = `Rapport de Performance - ${entrepriseNom}`;
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success(`Aperçu du rapport de ${entrepriseNom} disponible`);
  };

  return (
    <div className="space-y-6">

      {isAdmin ? (
        <>
          {/* ── Admin hero banner ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 text-white shadow-2xl shadow-emerald-200">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-28 -bottom-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ventes</h1>
                  </div>
                  <p className="text-white/65 text-sm ml-12">Organisées par entreprise et campagne</p>
                </div>
                <button onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-700 hover:bg-white/90 text-sm font-bold transition-colors shadow-sm shrink-0">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exporter XLSX</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { icon: "🛒", label: "Total ventes",    value: apiStats?.total_ventes ?? stats.total,         sub: "enregistrées" },
                  { icon: "📦", label: "Unités vendues",  value: apiStats?.total_unites_vendues ?? stats.unites, sub: "produits"     },
                ].map((s, i) => (
                  <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                    <div className="text-base mb-1">{s.icon}</div>
                    <div className="text-xl font-bold leading-none">
                      {s.value}{s.sub && <span className="text-xs font-normal text-white/55 ml-1">{s.sub}</span>}
                    </div>
                    <div className="text-xs text-white/60 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter + export */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-56 rounded-xl border-slate-200">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold transition-colors">
              <Download className="w-4 h-4" />Exporter tout (XLSX)
            </button>
          </div>

          {/* Company sections */}
          {loading ? (
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
                      const campRevenue = campSales.reduce((sum, s) => sum + Number(s.prix_total ?? 0), 0);
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
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  {["Produit", "Site", "Hôtesse", "Qté", "Total"].map((h, i) => (
                                    <th key={h} className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground",
                                      i < 3 ? "text-left" : "text-right")}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {campSales.map(sale => (
                                  <tr key={sale.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                                          <Package className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                        <div>
                                          <span className="font-medium text-foreground text-xs">{sale.produit_nom}</span>
                                          <p className="text-xs text-muted-foreground">{sale.conditionnement_display}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />{sale.site_nom}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{sale.hotesse_nom}</td>
                                    <td className="px-3 py-2.5 text-right font-medium">{sale.quantite}</td>
                                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700 text-xs">
                                      {fmt(Number(sale.prix_total ?? 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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

          <div className="flex items-center gap-4">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
                      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        {sale.conditionnement_display}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xl font-bold text-foreground">{fmt(Number(sale.prix_total ?? 0))}</p>
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