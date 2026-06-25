import type { RapportJournalierBulletin, RapportJournalierConfig, CampagneList, LivraisonGoodiesJour, GainGoodie, GainPromotion, Vente } from "@/lib/types/backend";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDateLong(value: string): string {
  return new Date(value + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtXOF(value: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(value);
}

/**
 * Construit un bulletin condensé : agrège plusieurs bulletins individuels
 * (un par hôtesse/site/jour) en un seul document brandé (logo + couleurs de
 * l'entreprise), pour une campagne et une sélection de dates donnée.
 * Respecte les mêmes toggles que le bulletin individuel (RapportJournalierConfig).
 */
export function buildCondensedBulletinHtml(
  bulletins: RapportJournalierBulletin[],
  config: RapportJournalierConfig,
  campagne: CampagneList,
  livraisons: LivraisonGoodiesJour[] = [],
  gainGoodies: GainGoodie[] = [],
  gainPromotions: GainPromotion[] = [],
  ventes: Vente[] = [],
): string {
  const colorPrimary = campagne.couleur_primaire || "#0f766e";
  const colorSecondary = campagne.couleur_secondaire || "#0d9488";
  const logoUrl = campagne.logo_url || "";

  const dates = [...new Set(bulletins.map(b => b.date))].sort();
  const dateLabel = dates.length === 0
    ? "—"
    : dates.length === 1
      ? fmtDateLong(dates[0])
      : `${fmtDateLong(dates[0])} — ${fmtDateLong(dates[dates.length - 1])}`;

  // Champs optionnels / défensif : si le backend déployé est plus ancien que
  // ce générateur (nouveaux champs pas encore renvoyés par l'API), on dégrade
  // proprement au lieu de planter en plein milieu de la génération.
  //
  // Une dégustation est toujours une vente (avec ou sans goodie) : chaque
  // enregistrement Degustation correspond à un client. On utilise donc
  // nb_degustations comme nombre de ventes (source la plus fiable), plutôt
  // que de sommer deux compteurs qui devraient déjà être égaux.
  const totalDeg = bulletins.reduce((s, b) => s + (b.nb_degustations ?? 0), 0);
  const totalCA = bulletins.reduce((s, b) => s + Number(b.chiffre_affaires || 0), 0);
  const totalPersonnesTouchees = bulletins.reduce((s, b) => s + (b.nombre_personnes_touchees ?? 0), 0);
  // totalHorsPromo : calculé plus bas directement depuis la table Vente
  // (relevantVentes), PAS depuis les bulletins individuels — même raison que
  // pour les goodies ci-dessous : un RapportJournalier manquant pour une
  // hôtesse (tâche nocturne non exécutée, affectation changée depuis...) ne
  // doit pas faire disparaître ses ventes hors promo du total condensé.

  const genreTotal = bulletins.reduce((acc, b) => {
    acc.hommes += b.genre_breakdown?.hommes ?? 0;
    acc.femmes += b.genre_breakdown?.femmes ?? 0;
    return acc;
  }, { hommes: 0, femmes: 0 });

  const trancheMap = new Map<string, { label: string; quantite: number }>();
  bulletins.forEach(b => (b.tranche_age_breakdown ?? []).forEach(t => {
    if (!trancheMap.has(t.tranche_age)) trancheMap.set(t.tranche_age, { label: t.label, quantite: 0 });
    trancheMap.get(t.tranche_age)!.quantite += t.quantite;
  }));

  const notesGout: number[] = [];
  const notesAmbiance: number[] = [];
  bulletins.forEach(b => {
    if (b.notes_moyennes?.note_gout != null) notesGout.push(b.notes_moyennes.note_gout);
    if (b.notes_moyennes?.note_ambiance != null) notesAmbiance.push(b.notes_moyennes.note_ambiance);
  });
  const avgGout = notesGout.length ? notesGout.reduce((a, v) => a + v, 0) / notesGout.length : null;
  const avgAmbiance = notesAmbiance.length ? notesAmbiance.reduce((a, v) => a + v, 0) / notesAmbiance.length : null;

  // UGs distribués / Goodies : comptés directement depuis GainGoodie (un gain
  // = un client gagnant), PAS depuis les bulletins individuels ni depuis
  // LivraisonGoodiesJour. Le bulletin individuel attribue chaque gain à une
  // hôtesse précise (pour éviter les doublons sur les sites à plusieurs
  // hôtesses) et exclut les gains sans dégustation liée dans ce cas — la
  // majorité des gains historiques disparaissent en sommant. Quant à
  // LivraisonGoodiesJour, il ne contient un goodie que si une livraison a
  // été explicitement enregistrée ce jour-là : si la campagne n'utilise pas
  // ce suivi (stock alloué une fois à la création), il reste vide même si
  // des gains existent réellement. GainGoodie (filtré par site + date) donne
  // le vrai total, comme sur la page Ventes.
  const siteIds = new Set(bulletins.map(b => b.site));
  const siteNoms = new Set(bulletins.map(b => b.site_nom));
  const dateSet = new Set(dates);
  // Site id → nom (pour relier les Vente, qui ne portent que site_nom, aux
  // clés par id utilisées par parSite/goodiesParSite).
  const siteNomToId = new Map(bulletins.map(b => [b.site_nom, b.site]));
  const relevantGains = gainGoodies.filter(g =>
    g.campagne_nom === campagne.nom &&
    (siteIds.has(g.site) || siteNoms.has(g.site_nom)) &&
    dateSet.has(g.created_at.slice(0, 10))
  );
  const relevantLivraisons = livraisons.filter(l => siteIds.has(l.site) && dateSet.has(l.date));
  // Ventes hors promo : directement depuis la table Vente (filtrée par
  // campagne/site/date), pas depuis les bulletins individuels — cf. note
  // plus haut sur totalHorsPromo.
  const relevantVentesHorsPromo = ventes.filter(v =>
    v.type_vente === "NORMAL" && v.campagne_nom === campagne.nom &&
    siteNoms.has(v.site_nom) && dateSet.has(v.created_at.slice(0, 10))
  );
  const totalHorsPromo = relevantVentesHorsPromo.reduce((s, v) => s + v.quantite, 0);

  // Goodies (UGs) reçus/distribués/restants — détaillés par site et par
  // jour (une ligne par site+date+goodie), plutôt qu'agrégés globalement
  // par nom de goodie : permet de voir où/quand chaque livraison et chaque
  // gain a eu lieu plutôt qu'un seul total opaque par goodie.
  type GoodieRow = { site: string; siteNom: string; date: string; goodieNom: string; recus: number; distribues: number };
  const goodieRows = new Map<string, GoodieRow>();
  relevantLivraisons.forEach(l => {
    const key = `${l.site}|${l.date}|${l.goodie_nom}`;
    if (!goodieRows.has(key)) {
      goodieRows.set(key, { site: l.site, siteNom: l.site_nom, date: l.date, goodieNom: l.goodie_nom, recus: 0, distribues: 0 });
    }
    goodieRows.get(key)!.recus += l.quantite_apportee;
  });
  relevantGains.forEach(g => {
    const date = g.created_at.slice(0, 10);
    const key = `${g.site}|${date}|${g.goodie_nom}`;
    if (!goodieRows.has(key)) {
      goodieRows.set(key, { site: g.site, siteNom: g.site_nom, date, goodieNom: g.goodie_nom, recus: 0, distribues: 0 });
    }
    goodieRows.get(key)!.distribues += 1;
  });
  const sortedGoodieRows = [...goodieRows.values()].sort((a, b) =>
    a.date === b.date ? (a.siteNom === b.siteNom ? a.goodieNom.localeCompare(b.goodieNom) : a.siteNom.localeCompare(b.siteNom)) : a.date.localeCompare(b.date)
  );

  const totalGoodies = relevantGains.length;

  const goodiesParSite = new Map<string, number>();
  relevantGains.forEach(g => {
    goodiesParSite.set(g.site, (goodiesParSite.get(g.site) ?? 0) + 1);
  });

  const stockParSite = new Map<string, { siteNom: string; stock: number | null; conditionnement: string; gratuites: number }>();
  bulletins.forEach(b => {
    if (!stockParSite.has(b.site)) {
      stockParSite.set(b.site, { siteNom: b.site_nom, stock: b.stock_boissons, conditionnement: b.conditionnement_boissons || "—", gratuites: 0 });
    }
    const entry = stockParSite.get(b.site)!;
    entry.gratuites += b.nombre_boissons_gratuites ?? 0;
  });

  const parSite = new Map<string, { siteNom: string; deg: number; horsPromo: number; ca: number }>();
  bulletins.forEach(b => {
    if (!parSite.has(b.site)) parSite.set(b.site, { siteNom: b.site_nom, deg: 0, horsPromo: 0, ca: 0 });
    const e = parSite.get(b.site)!;
    e.deg += b.nb_degustations ?? 0;
    e.ca += Number(b.chiffre_affaires || 0);
  });
  relevantVentesHorsPromo.forEach(v => {
    const siteId = siteNomToId.get(v.site_nom);
    if (!siteId) return;
    if (!parSite.has(siteId)) parSite.set(siteId, { siteNom: v.site_nom, deg: 0, horsPromo: 0, ca: 0 });
    parSite.get(siteId)!.horsPromo += v.quantite;
  });

  // Détail des ventes (promo / hors promo) — une ligne par vente ou par
  // gain promotionnel, avec le client, le produit (le cas échéant), le
  // conditionnement, la quantité achetée et — pour les gains promo —
  // l'offre appliquée et la quantité réellement offerte. Une promotion
  // n'est pas liée à un produit précis dans ce modèle de données (la règle
  // est générique : "achetez X, obtenez Y offerts"), donc Produit reste
  // vide sur ces lignes-là.
  type VenteRow = {
    site: string; date: string; client: string; produit: string;
    conditionnement: string; quantiteAchetee: number; offre: string; quantiteOfferte: number | null;
  };
  const relevantGainPromotions = gainPromotions.filter(g =>
    g.campagne === campagne.id && siteNoms.has(g.site_nom) && dateSet.has(g.created_at.slice(0, 10))
  );
  // Même filtre que totalHorsPromo/parSite plus haut — réutilisé ici pour le
  // détail ligne par ligne.
  const relevantVentes = relevantVentesHorsPromo;

  // Un gain promo et sa vente d'achat (Vente.gain_promotion / GainPromotion.vente_achat)
  // sont deux enregistrements distincts pour le même évènement client : on les
  // fusionne en une seule ligne plutôt que d'afficher l'achat et l'offre séparément.
  const ventesById = new Map(relevantVentes.map(v => [v.id, v]));
  const consumedVenteIds = new Set<string>();
  const venteRows: VenteRow[] = [];

  relevantGainPromotions.forEach(g => {
    const vente = g.vente_achat ? ventesById.get(g.vente_achat) : undefined;
    if (vente) {
      consumedVenteIds.add(vente.id);
      venteRows.push({
        site: vente.site_nom, date: vente.created_at.slice(0, 10), client: vente.nom_client || g.nom_client || "—",
        produit: vente.produit_nom, conditionnement: vente.conditionnement_display,
        quantiteAchetee: vente.quantite, offre: g.promotion_description, quantiteOfferte: g.quantite_offerte,
      });
    } else {
      // Pas de vente_achat liée (promo sans produit associé, ex: TIRAGE) :
      // on affiche le gain seul avec les données qu'il porte directement.
      venteRows.push({
        site: g.site_nom, date: g.created_at.slice(0, 10), client: g.nom_client || "—",
        produit: "—", conditionnement: g.conditionnement_display || g.conditionnement,
        quantiteAchetee: g.quantite_produits_concernes, offre: g.promotion_description, quantiteOfferte: g.quantite_offerte,
      });
    }
  });
  relevantVentes.forEach(v => {
    if (consumedVenteIds.has(v.id)) return;
    venteRows.push({
      site: v.site_nom, date: v.created_at.slice(0, 10), client: v.nom_client || "—",
      produit: v.produit_nom, conditionnement: v.conditionnement_display, quantiteAchetee: v.quantite,
      offre: "—", quantiteOfferte: null,
    });
  });
  venteRows.sort((a, b) => a.date === b.date ? a.site.localeCompare(b.site) : a.date.localeCompare(b.date));

  const avis = bulletins.filter(b => b.avis_consommateurs).map(b => ({ site: b.site_nom, hotesse: b.hotesse_nom, texte: b.avis_consommateurs! }));
  const observations = bulletins.filter(b => b.observation_generale).map(b => ({ site: b.site_nom, hotesse: b.hotesse_nom, texte: b.observation_generale! }));

  const sections: string[] = [];

  sections.push(`
    <div class="kpis">
      <div class="kpi"><div class="l">Dégustations / Ventes</div><div class="v">${totalDeg}</div></div>
      ${config.show_ventes_detail ? `<div class="kpi"><div class="l">Hors promo</div><div class="v">${totalHorsPromo}</div></div>` : ""}
      <div class="kpi"><div class="l">Goodies</div><div class="v">${totalGoodies}</div></div>
      <div class="kpi"><div class="l">Chiffre d'affaires</div><div class="v">${esc(fmtXOF(totalCA))}</div></div>
      ${config.show_personnes_touchees ? `<div class="kpi"><div class="l">Personnes touchées</div><div class="v">${totalPersonnesTouchees}</div></div>` : ""}
    </div>`);

  sections.push(`
    <h2 class="section-title">Détail par site</h2>
    <table><thead><tr><th>Site</th><th class="r">Dégustations / Ventes</th>${config.show_ventes_detail ? `<th class="r">Hors promo</th>` : ""}<th class="r">Goodies</th><th class="r">CA</th></tr></thead>
    <tbody>${[...parSite.entries()].map(([siteId, e]) => `<tr><td class="b">${esc(e.siteNom)}</td><td class="r">${e.deg}</td>${config.show_ventes_detail ? `<td class="r">${e.horsPromo}</td>` : ""}<td class="r">${goodiesParSite.get(siteId) ?? 0}</td><td class="r">${esc(fmtXOF(e.ca))}</td></tr>`).join("")}</tbody></table>`);

  if (config.show_ventes_detail && venteRows.length > 0) {
    sections.push(`
      <h2 class="section-title">Détail des ventes (promo / hors promo)</h2>
      <table><thead><tr><th>Site</th><th>Date</th><th>Client</th><th>Produit</th><th>Conditionnement</th><th class="r">Qté achetée</th><th>Offre appliquée</th><th class="r">Qté offerte</th></tr></thead>
      <tbody>${venteRows.map(r => `<tr><td class="b">${esc(r.site)}</td><td>${esc(fmtDateLong(r.date))}</td><td>${esc(r.client)}</td><td>${esc(r.produit)}</td><td>${esc(r.conditionnement)}</td><td class="r">${r.quantiteAchetee}</td><td>${esc(r.offre)}</td><td class="r">${r.quantiteOfferte ?? "—"}</td></tr>`).join("")}</tbody></table>`);
  }

  if (config.show_genre) {
    sections.push(`
      <h2 class="section-title">Répartition par genre</h2>
      <div class="row">
        <div class="field"><span class="label">Hommes</span><span class="value">${genreTotal.hommes}</span></div>
        <div class="field"><span class="label">Femmes</span><span class="value">${genreTotal.femmes}</span></div>
      </div>`);
  }

  if (config.show_tranche_age && [...trancheMap.values()].some(t => t.quantite > 0)) {
    sections.push(`
      <h2 class="section-title">Répartition par tranche d'âge</h2>
      <div class="row">${[...trancheMap.values()].filter(t => t.quantite > 0).map(t => `<div class="field"><span class="label">${esc(t.label)}</span><span class="value">${t.quantite}</span></div>`).join("")}</div>`);
  }

  if (config.show_notes_degustation && (avgGout != null || avgAmbiance != null)) {
    sections.push(`
      <h2 class="section-title">Notes moyennes</h2>
      <div class="row">
        <div class="field"><span class="label">Goût</span><span class="value">${avgGout != null ? avgGout.toFixed(1) : "—"}</span></div>
        <div class="field"><span class="label">Ambiance</span><span class="value">${avgAmbiance != null ? avgAmbiance.toFixed(1) : "—"}</span></div>
      </div>`);
  }

  if ((config.show_ugs_recus || config.show_ugs_distribues || config.show_ugs_restants) && sortedGoodieRows.length > 0) {
    sections.push(`
      <h2 class="section-title">UGs (goodies) par site et par jour</h2>
      <table><thead><tr><th>Site</th><th>Date</th><th>Goodie</th>${config.show_ugs_recus ? `<th class="r">Reçus</th>` : ""}${config.show_ugs_distribues ? `<th class="r">Distribués</th>` : ""}${config.show_ugs_restants ? `<th class="r">Restants</th>` : ""}</tr></thead>
      <tbody>${sortedGoodieRows.map(r => `<tr><td class="b">${esc(r.siteNom)}</td><td>${esc(fmtDateLong(r.date))}</td><td>${esc(r.goodieNom)}</td>${config.show_ugs_recus ? `<td class="r">${r.recus}</td>` : ""}${config.show_ugs_distribues ? `<td class="r">${r.distribues}</td>` : ""}${config.show_ugs_restants ? `<td class="r">${Math.max(0, r.recus - r.distribues)}</td>` : ""}</tr>`).join("")}</tbody></table>`);
  }

  if (config.show_stock_boissons && stockParSite.size > 0) {
    sections.push(`
      <h2 class="section-title">Stock de boissons par site</h2>
      <table><thead><tr><th>Site</th><th class="r">Stock</th><th>Conditionnement</th></tr></thead>
      <tbody>${[...stockParSite.values()].map(s => `<tr><td class="b">${esc(s.siteNom)}</td><td class="r">${s.stock ?? "—"}</td><td>${esc(s.conditionnement)}</td></tr>`).join("")}</tbody></table>`);
  }
  if (config.show_boissons_gratuites && stockParSite.size > 0) {
    sections.push(`
      <h2 class="section-title">Boissons gratuites par site (période)</h2>
      <table><thead><tr><th>Site</th><th class="r">Boissons gratuites</th></tr></thead>
      <tbody>${[...stockParSite.values()].map(s => `<tr><td class="b">${esc(s.siteNom)}</td><td class="r">${s.gratuites}</td></tr>`).join("")}</tbody></table>`);
  }

  if (config.show_avis_consommateurs && avis.length > 0) {
    sections.push(`
      <h2 class="section-title">Avis des consommateurs</h2>
      ${avis.map(a => `<p class="text"><strong>${esc(a.site)} (${esc(a.hotesse)})</strong> — ${esc(a.texte)}</p>`).join("")}`);
  }
  if (config.show_observation_generale && observations.length > 0) {
    sections.push(`
      <h2 class="section-title">Observations générales</h2>
      ${observations.map(o => `<p class="text"><strong>${esc(o.site)} (${esc(o.hotesse)})</strong> — ${esc(o.texte)}</p>`).join("")}`);
  }

  const safeNom = `${campagne.nom}_${dateLabel}`.replace(/\s+/g, "_");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>RAPPPORT JOURNALIER — ${esc(campagne.nom)} — ${esc(dateLabel)}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  :root{--brand-primary:${colorPrimary};--brand-secondary:${colorSecondary}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#1e293b;padding:90px 24px 40px;background:#f8fafc}
  .action-bar{position:fixed;top:0;left:0;right:0;height:60px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:flex-end;padding:0 24px;gap:10px;z-index:999}
  .btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none}
  .btn-download{background:var(--brand-primary);color:#fff}
  .btn-print{background:#f1f5f9;color:#334155;border:1px solid #cbd5e1}
  #capture-zone{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
  .hdr{background:var(--brand-primary);color:#fff;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .hdr-logo{width:52px;height:52px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
  .hdr-logo img{width:100%;height:100%;object-fit:contain}
  .hdr h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.3px}
  .hdr p{font-size:12px;opacity:.85;margin-top:4px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;padding:20px 28px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
  .kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:#64748b;font-weight:700}
  .kpi .v{font-size:18px;font-weight:900;color:#0f172a;margin-top:4px}
  .section-title{font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:var(--brand-primary);font-weight:800;padding:16px 28px 8px}
  table{width:100%;border-collapse:collapse;margin:0 0 8px}
  th{background:var(--brand-secondary);color:#fff;padding:8px 12px;text-align:left;font-size:11px;font-weight:700}
  td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
  .r{text-align:right}.b{font-weight:700}
  .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;padding:0 28px 16px}
  .field{display:flex;flex-direction:column;gap:2px}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:.3px;color:#64748b;font-weight:700}
  .value{font-size:16px;font-weight:800;color:#0f172a}
  .text{font-size:12px;line-height:1.5;color:#334155;padding:0 28px 8px}
  .foot{padding:16px 28px;text-align:center;color:#94a3b8;font-size:10px}
  @media print{ .action-bar{display:none !important} body{padding:0;background:#fff} #capture-zone{box-shadow:none;max-width:100%} }
</style></head>
<body>
<div class="action-bar">
  <button class="btn btn-download" onclick="generateDirectPDF()">⬇ PDF</button>
  <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer</button>
</div>
<div id="capture-zone">
  <div class="hdr">
    <div>
      <h1>RAPPORT JOURNALIER — ${esc(campagne.nom)}</h1>
      <p>${esc(campagne.entreprise_nom)} — ${esc(dateLabel)} — ${bulletins.length} rapport${bulletins.length > 1 ? "s" : ""}</p>
    </div>
    ${logoUrl ? `<div class="hdr-logo"><img src="${esc(logoUrl)}" alt="Logo" /></div>` : ""}
  </div>
  ${sections.join("\n")}
  <div class="foot">Rapport journalier généré depuis MHedia BTL</div>
</div>
<script>
  function generateDirectPDF() {
    const element = document.getElementById('capture-zone');
    const opt = {
      margin: 10,
      filename: "Bulletin_condense_${safeNom}.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }
</script>
</body></html>`;
}
