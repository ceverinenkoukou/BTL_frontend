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
  ShoppingCart, Download, Package, FileText, Building2, MapPin, User,
} from "lucide-react";
import * as XLSX from "xlsx";

interface VenteEnrichie extends Vente {
  produitsOfferts?: number;
  goodiesOfferts?: number;
  goodiesDetails?: string;
  entrepriseLogo?: string | null;
  entrepriseCouleurPrimaire?: string;
  entrepriseCouleurSecondaire?: string;
}

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
      toast.error("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = sales.filter(s =>
    selectedCampaign === "all" || s.campagne_nom === campaigns.find(c => c.id === selectedCampaign)?.nom
  );

  const stats = useMemo(() => {
    const ventesNormales = filtered.filter(s => s.type_vente !== "PROMOTION");
    return {
      total: ventesNormales.length,
      unites: ventesNormales.reduce((sum, s) => sum + s.quantite, 0),
    };
  }, [filtered]);

  const handleExport = () => {
    const data = filtered.map(s => ({
      Date: new Date(s.created_at).toLocaleDateString("fr-FR"),
      Heure: new Date(s.created_at).toLocaleTimeString("fr-FR"),
      Entreprise: s.entreprise_nom,
      Campagne: s.campagne_nom,
      Site: s.site_nom,
      Produit: s.produit_nom,
      Hôtesse: s.hotesse_nom,
      Client: s.nom_client || "Anonyme",
      Type: s.type_vente,
      Conditionnement: s.conditionnement_display,
      Quantité: s.quantite,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    XLSX.writeFile(wb, `rapport_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Export Excel téléchargé");
  };

  const companyGroups = useMemo(() => {
    const map = new Map<string, { name: string; campMap: Map<string, { name: string; sales: VenteEnrichie[] }> }>();
    filtered.forEach(s => {
      if (!map.has(s.entreprise_nom)) map.set(s.entreprise_nom, { name: s.entreprise_nom, campMap: new Map() });
      const cg = map.get(s.entreprise_nom)!;
      if (!cg.campMap.has(s.campagne_nom)) cg.campMap.set(s.campagne_nom, { name: s.campagne_nom, sales: [] });
      cg.campMap.get(s.campagne_nom)!.sales.push(s);
    });
    return [...map.values()].map(cg => {
      const toutesLesLignes = [...cg.campMap.values()].flatMap(c => c.sales);
      const lignesNormales = toutesLesLignes.filter(l => l.type_vente !== "PROMOTION");
      return {
        name: cg.name,
        campaigns: [...cg.campMap.values()],
        totalSales: lignesNormales.length,
      };
    });
  }, [filtered]);
  const stroke = "STROKE"

  const exportCompanyPDF = (entrepriseNom: string) => {
    const companySales = sales.filter(s => s.entreprise_nom === stroke || s.entreprise_nom === entrepriseNom);
    
    const firstSale = companySales[0];
    const logoUrl = firstSale?.entrepriseLogo || "";
    const colorPrimary   = firstSale?.entrepriseCouleurPrimaire   || "#065f46";
    const colorSecondary = firstSale?.entrepriseCouleurSecondaire || "#0d9488";

    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
      return { r: parseInt(full.slice(0,2),16), g: parseInt(full.slice(2,4),16), b: parseInt(full.slice(4,6),16) };
    };
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
      primaryBorder:  mixOnWhite(colorPrimary, 0.30),
      secondaryBg:    mixOnWhite(colorSecondary, 0.12),
      secondaryBorder:mixOnWhite(colorSecondary, 0.30),
      hotesseBg:      mixOnWhite(colorPrimary, 0.08),
      hotesseBorder:  mixOnWhite(colorPrimary, 0.22),
      logoGrad:       `linear-gradient(135deg, ${colorPrimary}, ${colorSecondary})`,
    };

    const performanceMap = new Map<string, {
      hotesse: string;
      site: string;
      ventesCount: number;
      unitesVendues: number;
      produitsOfferts: number;
      goodiesCount: number;
    }>();

    const goodiesPerformanceMap = new Map<string, Map<string, number>>();

    const clientsLogMap = new Map<string, {
      heure: string;
      hotesse: string;
      site: string;
      client: string;
      produit: string;
      volumeVendu: number;
      volumeOffert: number;
      goodieRemporte: string;
    }>();

    companySales.forEach((s, index) => {
      const uniqueKey = `${s.hotesse_nom} | ${s.site_nom}`;
      
      if (!performanceMap.has(uniqueKey)) {
        performanceMap.set(uniqueKey, {
          hotesse: s.hotesse_nom,
          site: s.site_nom,
          ventesCount: 0,
          unitesVendues: 0,
          produitsOfferts: 0, 
          goodiesCount: 0,
        });
      }
      
      const src = performanceMap.get(uniqueKey)!;

      if (s.type_vente === "PROMOTION") {
        src.produitsOfferts += s.quantite;
      } else {
        src.ventesCount += 1;
        src.unitesVendues += s.quantite;
      }

      src.goodiesCount += Number(s.goodiesOfferts ?? 0);
      if (s.goodiesDetails && Number(s.goodiesOfferts ?? 0) > 0) {
        if (!goodiesPerformanceMap.has(uniqueKey)) {
          goodiesPerformanceMap.set(uniqueKey, new Map<string, number>());
        }
        const currentGoodies = goodiesPerformanceMap.get(uniqueKey)!;
        const currentQty = currentGoodies.get(s.goodiesDetails) || 0;
        currentGoodies.set(s.goodiesDetails, currentQty + Number(s.goodiesOfferts));
      }

      const minuteId = new Date(s.created_at).toISOString().slice(0, 16);
      const clientKey = `${s.hotesse_nom}_${s.site_nom}_${s.nom_client || "Anonyme"}_${minuteId}`;

      if (!clientsLogMap.has(clientKey)) {
        clientsLogMap.set(clientKey, {
          heure: new Date(s.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          hotesse: s.hotesse_nom,
          site: s.site_nom,
          client: s.nom_client || `Client N ${index + 1}`,
          produit: s.produit_nom,
          volumeVendu: 0,
          volumeOffert: 0,
          goodieRemporte: "—",
        });
      }

      const clientLog = clientsLogMap.get(clientKey)!;
      if (s.type_vente === "PROMOTION") {
        clientLog.volumeOffert += s.quantite;
      } else {
        clientLog.volumeVendu += s.quantite;
      }

      if (s.goodiesDetails && Number(s.goodiesOfferts ?? 0) > 0) {
        clientLog.goodieRemporte = `${s.goodiesDetails} (x${s.goodiesOfferts})`;
      }
    });

    const globalTotalActesVentes = companySales.filter(s => s.type_vente !== "PROMOTION").length;
    const globalTotalUnites = companySales.filter(s => s.type_vente !== "PROMOTION").reduce((sum, s) => sum + s.quantite, 0);
    const globalTotalOfferts = companySales.filter(s => s.type_vente === "PROMOTION").reduce((sum, s) => sum + s.quantite, 0);
    const globalTotalGoodies = companySales.reduce((sum, s) => sum + Number(s.goodiesOfferts ?? 0), 0);

    const rowsHtml = [...performanceMap.values()].map(item => `
      <tr>
        <td class="b hotesse-name">${item.hotesse}</td>
        <td class="site-name">${item.site}</td>
        <td class="r b">${item.ventesCount}</td>
        <td class="r">${item.unitesVendues} u.</td>
        <td class="r text-gift">${item.produitsOfferts} u.</td>
        <td class="r b text-star">${item.goodiesCount}</td>
      </tr>
    `).join("");

    let goodiesRowsHtml = "";
    if (goodiesPerformanceMap.size === 0) {
      goodiesRowsHtml = `<tr><td colspan="4" class="text-center" style="color:#94a3b8; padding:20px;">Aucun détail de goodies enregistré pour cette période.</td></tr>`;
    } else {
      goodiesRowsHtml = [...goodiesPerformanceMap.entries()].map(([uniqueKey, goodiesDistribution]) => {
        const [hotesse, site] = uniqueKey.split(" | ");
        const itemsHtml = [...goodiesDistribution.entries()].map(([goodieNom, quantiteTotale]) => `
          <div class="goodie-detail-item">
            <span class="goodie-label">${goodieNom}</span>
            <span class="goodie-qty">x${quantiteTotale}</span>
          </div>
        `).join("");
        const totalSiteGoodies = [...goodiesDistribution.values()].reduce((a, b) => a + b, 0);
        return `
          <tr>
            <td class="b hotesse-name">${hotesse}</td>
            <td class="site-name">${site}</td>
            <td><div class="goodies-grid-cell">${itemsHtml}</div></td>
            <td class="r b text-star" style="font-size:13px;">${totalSiteGoodies} lot(s)</td>
          </tr>
        `;
      }).join("");
    }

    const clientsRowsHtml = [...clientsLogMap.values()].map(cLog => `
      <tr>
        <td style="color:#64748b; font-family: monospace;">${cLog.heure}</td>
        <td class="b">${cLog.hotesse}</td>
        <td style="color:${c.primary}; font-weight:500;">${cLog.site}</td>
        <td class="b text-slate-800">${cLog.client}</td>
        <td><span class="tag-produit">${cLog.produit}</span></td>
        <td class="r b" style="color:#0f172a;">${cLog.volumeVendu} u.</td>
        <td class="r b text-gift">${cLog.volumeOffert > 0 ? `+${cLog.volumeOffert} u.` : "—"}</td>
        <td class="r font-medium ${cLog.goodieRemporte !== "—" ? "text-star" : ""}" style="font-size:11px;">
          ${cLog.goodieRemporte}
        </td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport de Performance - ${entrepriseNom}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        @page{size:A4;margin:15mm 10mm 15mm 10mm;}
        html,body{background-color:#ffffff !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
        
        /* CORRECTION : padding géré uniquement à l'écran, pas sur le PDF */
        body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#334155;padding-top:75px;}
        
        .action-bar{position:fixed;top:0;left:0;right:0;height:60px;background:#ffffff !important;box-shadow:0 4px 20px rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:flex-end;padding:0 40px;gap:12px;z-index:99999;border-bottom:1px solid #e2e8f0;}
        .btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:none}
        .btn-download{background:${c.primary} !important;color:#fff !important;}
        
        /* CORRECTION : Pas de padding ni de margin sur le conteneur pour démarrer pile en haut de la page */
        .report-container{background:#ffffff !important;width:100%;margin:0;padding:0;}
        
        .hdr-container{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${c.primary};padding-bottom:20px;margin-bottom:30px}
        .hdr-logo-area{display:flex;align-items:center;gap:18px}
        .corporate-logo-wrapper{width:65px;height:65px;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8fafc !important;border:1px solid #e2e8f0}
        .corporate-logo-img{width:100%;height:100%;object-fit:contain}
        .corporate-logo-fallback{width:100%;height:100%;background:${c.logoGrad} !important;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:900;}
        .hdr-text h2{font-size:18px;font-weight:800;color:${c.primary};letter-spacing:-0.5px}
        .hdr-text h4{font-size:13px;color:#64748b;margin-top:3px}
        .meta-date{text-align:right;color:#64748b;font-size:11px}
        .meta-date .date-box{background:#f8fafc !important;padding:6px 12px;border-radius:8px;border:1px solid #e2e8f0;margin-top:5px;display:inline-block;font-weight:600;color:#334155}

        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:35px}
        .kpi{background:#f8fafc !important;border:1px solid #e2e8f0;border-radius:12px;padding:15px;}
        .kpi .l{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px}
        .kpi .v{font-size:20px;font-weight:800;color:#0f172a}

        h2.section-title{font-size:13px;font-weight:700;color:${c.primary};margin-bottom:15px;text-transform:uppercase;letter-spacing:0.3px;margin-top:25px;page-break-after:avoid;}
        table{width:100%;border-collapse:collapse;margin-bottom:30px;background:#fff !important;page-break-inside:auto;}
        tr{page-break-inside:avoid;page-break-after:auto;}
        th{background:${c.primary} !important;color:#fff !important;padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}
        th:first-child{border-top-left-radius:8px}
        th:last-child{border-top-right-radius:8px}
        td{padding:10px 14px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
        
        .r{text-align:right}.b{font-weight:700}
        .hotesse-name{color:#0f172a !important;}
        .site-name{color:${c.primary} !important;font-weight:600}
        .text-gift{color:${c.primary} !important;font-weight:700}
        .text-star{color:${c.secondary} !important;font-weight:700}
        .tag-produit{background:#f1f5f9; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600; color:#475569;}
        
        .goodies-grid-cell{display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:6px}
        .goodie-detail-item{background:${c.secondaryBg} !important;border:1px solid ${c.secondaryBorder} !important;border-radius:6px;padding:4px 10px;display:flex;justify-content:space-between;align-items:center;}
        .goodie-label{color:${c.secondary} !important;font-weight:600;font-size:11px}
        .goodie-qty{background:${c.secondary} !important;color:#fff !important;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;}
        
        .tot-row td{background:${c.primary} !important;color:#fff !important;font-weight:800;padding:14px;font-size:12px;}
        
        .page-break-before { page-break-before: always !important; margin-top: 20px; }

        @media print{
          html,body{padding:0 !important;background:white !important;margin:0mm !important;}
          
          /* CORRECTION : Force la suppression du décalage de 75px uniquement lors de l'impression PDF */
          body{padding-top:0px !important;} 
          .action-bar{display:none !important;}
          table{page-break-inside:auto}
          tr{page-break-inside:avoid;page-break-after:auto}
        }
      </style>
    </head>
    <body>

      <div class="action-bar">
        <button class="btn btn-download" onclick="generateDirectPDF()">Télécharger PDF Complet</button>
        <button class="btn btn-print" onclick="window.print()">Imprimer</button>
      </div>
      
      <div id="capture-zone" class="report-container">
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
              <h2>RAPPORT DE PERFORMANCE DETAILLES</h2>
              <h4>${entrepriseNom}</h4>
            </div>
          </div>
          <div class="meta-date">
            Rapport généré le<br/>
            <div class="date-box">${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi"><div class="l">Clients Servis / Ventes</div><div class="v">${globalTotalActesVentes}</div></div>
          <div class="kpi"><div class="l">Volume total Vendu</div><div class="v">${globalTotalUnites} u.</div></div>
          <div class="kpi"><div class="l">Volume total Offert</div><div class="v text-gift">${globalTotalOfferts} u.</div></div>
        </div>

        <h2 class="section-title">1. Performances Cumulées par Hôtesse & Site</h2>
        <table>
          <thead>
            <tr>
              <th>Hôtesse</th>
              <th>Site d'Affectation</th>
              <th class="r">Actes de Vente</th>
              <th class="r">Volume Vendu</th>
              <th class="r">Volume Offert</th>
              <th class="r">Goodies remis</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="tot-row">
              <td colspan="2" class="b">TOTAL GÉNÉRAL CUMULÉ</td>
              <td class="r">${globalTotalActesVentes}</td>
              <td class="r">${globalTotalUnites} u.</td>
              <td class="r">${globalTotalOfferts} u.</td>
              <td class="r">${globalTotalGoodies}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="section-title">2. Répartition Globale des Goodies Distribués</h2>
        <table>
          <thead>
            <tr>
              <th>Hôtesse</th>
              <th>Site d'activité</th>
              <th>Détail des Dotations / Lots distribués</th>
              <th class="r">Volume total</th>
            </tr>
          </thead>
          <tbody>
            ${goodiesRowsHtml}
          </tbody>
        </table>

        <div class="page-break-before"></div>

        <h2 class="section-title">3. Journal des Transactions et Détails par Client</h2>
        <table>
          <thead>
            <tr>
              <th>Heure</th>
              <th>Hôtesse</th>
              <th>Site</th>
              <th>Client</th>
              <th>Produit Ciblé</th>
              <th class="r">Vol. Vendu</th>
              <th class="r">Vol. Offert</th>
              <th class="r">Goodie / Lot gagné</th>
            </tr>
          </thead>
          <tbody>
            ${clientsRowsHtml}
          </tbody>
        </table>
      </div>

      <script>
        function generateDirectPDF() {
          const element = document.getElementById('capture-zone');
          const opt = {
            margin:       [15, 10, 15, 10], // CORRECTION : Marges pures et équilibrées pour html2pdf
            filename:     "Rapport_Performances_${entrepriseNom.replace(/\s+/g, '_')}.pdf",
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'] }
          };
          html2pdf().set(opt).from(element).save();
        }
      </script>
    </body>
    </html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    
    if (win) {
      win.document.title = `Rapport Détaillé - ${entrepriseNom}`;
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success(`Le rapport de ${entrepriseNom} est prêt`);
  };

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-xl">
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Suivi des Activités</h1>
                  <p className="text-white/65 text-sm mt-1">Données organisées par entreprise et campagne</p>
                </div>
                <button onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-white/90 text-sm font-bold transition-colors shadow-sm shrink-0">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exporter XLSX</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Actes de ventes", value: stats.total, sub: "facturés" },
                  { label: "Unités vendues", value: stats.unites, sub: "produits" },
                ].map((s, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/10">
                    <div className="text-xl font-bold leading-none">
                      {s.value}{s.sub && <span className="text-xs font-normal text-white/55 ml-1">{s.sub}</span>}
                    </div>
                    <div className="text-xs text-white/60 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors">
              <Download className="w-4 h-4" />Exporter tout (XLSX)
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-slate-50 rounded-2xl animate-pulse" />)}
            </div>
          ) : companyGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border p-14 text-center">
              <p className="text-sm font-medium text-foreground">Aucune donnée rattachée aux filtres sélectionnés</p>
            </div>
          ) : (
            <div className="space-y-5">
              {companyGroups.map(({ name: compName, campaigns: compCamps, totalSales }) => (
                <div key={compName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-slate-200 rounded-xl flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-slate-700" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-bold text-foreground truncate">{compName}</h2>
                        <p className="text-xs text-muted-foreground">
                          {compCamps.length} campagne{compCamps.length > 1 ? "s" : ""} · {totalSales} acte{totalSales > 1 ? "s" : ""} traité(s)
                        </p>
                      </div>
                    </div>
                    <button onClick={() => exportCompanyPDF(compName)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors shadow-sm">
                      <FileText className="w-3.5 h-3.5" />Rapport Détaillé (PDF)
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {compCamps.map(({ name: campName, sales: campSales }) => {
                      const lignesNormales = campSales.filter(l => l.type_vente !== "PROMOTION");
                      return (
                        <div key={campName} className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{campName}</span>
                            <span className="text-xs bg-slate-100 border px-2 py-0.5 rounded-full font-medium">
                              {lignesNormales.length} ligne{lignesNormales.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="rounded-xl border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b">
                                  {["Client / Produit", "Site / Hôtesse", "Type", "Qté"].map((h, i) => (
                                    <th key={h} className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground",
                                      i < 3 ? "text-left" : "text-right")}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {campSales.map(sale => (
                                  <tr key={sale.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-2.5">
                                      <div>
                                        <span className="font-bold text-slate-800 text-xs">{sale.nom_client || "Anonyme"}</span>
                                        <p className="text-xs text-muted-foreground">{sale.produit_nom} ({sale.conditionnement_display})</p>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                      <p>{sale.site_nom}</p>
                                      <p>{sale.hotesse_nom}</p>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs">
                                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", 
                                        sale.type_vente === "PROMOTION" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>
                                        {sale.type_vente === "PROMOTION" ? "OFFERT" : "VENTE"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-medium">{sale.quantite}</td>
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
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Activités</h1>
            </div>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border hover:bg-slate-50 text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />Exporter
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: stats.total, label: "Transactions Ventes" },
              { value: stats.unites, label: "Unités vendues" },
            ].map((s, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-slate-800">{s.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                {isHostess ? "Mes fiches" : "Toutes les lignes de ventes"}
              </h3>
              <span className="text-xs text-muted-foreground bg-slate-50 px-2.5 py-1 rounded-full border">
                {filtered.length} ligne{filtered.length !== 1 ? "s" : ""} au total
              </span>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Aucun enregistrement trouvé</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(sale => (
                  <div key={sale.id} className="p-4 rounded-xl border bg-card space-y-2">
                    <p className="font-bold text-xs">Client : {sale.nom_client || "Anonyme"}</p>
                    <p className="text-xs text-muted-foreground">{sale.produit_nom} - Qté: {sale.quantite}</p>
                    <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-full", sale.type_vente === "PROMOTION" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>
                      {sale.type_vente === "PROMOTION" ? "Offert" : "Vente"}
                    </span>
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
