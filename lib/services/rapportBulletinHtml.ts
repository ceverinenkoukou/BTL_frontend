import type { RapportJournalierBulletin, RapportJournalierConfig } from "@/lib/types/backend";

function esc(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtHeure(value: string | null): string {
  return value ? value.slice(0, 5) : "—";
}

function fmtDateLong(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Construit le bulletin journalier imprimable (HTML), au format "fiche site/jour". */
export function buildBulletinHtml(
  bulletin: RapportJournalierBulletin,
  config: RapportJournalierConfig,
  campagneNom: string,
): string {
  const safeNom = `${bulletin.site_nom}_${bulletin.date}`.replace(/\s+/g, "_");

  const ugsListHtml = (items: { goodie: string; quantite: number }[]) =>
    items.length === 0
      ? `<p class="muted">Aucune donnée.</p>`
      : `<ul class="ugs-list">${items.map(i => `<li><span>${esc(i.goodie)}</span><strong>${i.quantite}</strong></li>`).join("")}</ul>`;

  const ventesPromoHtml = bulletin.ventes_promo_detail.length === 0
    ? `<p class="muted">Aucune vente promo.</p>`
    : `<ul class="promo-list">${bulletin.ventes_promo_detail.map(p =>
        `<li>${p.occurrences} × ${p.quantite_offerte} = <strong>${p.total_offert}</strong> (achat de ${p.quantite_requise})</li>`
      ).join("")}</ul>`;

  const sections: string[] = [];

  if (config.show_pointage) {
    sections.push(`
      <div class="row">
        <div class="field"><span class="label">Heure d'arrivée</span><span class="value">${fmtHeure(bulletin.heure_arrivee)}</span></div>
        <div class="field"><span class="label">Heure de départ</span><span class="value">${fmtHeure(bulletin.heure_depart)}</span></div>
      </div>`);
  }

  if (config.show_stock) {
    sections.push(`
      <div class="section">
        <h2>Stock magasin</h2>
        <p class="big">${bulletin.stock_initial_magasin ?? "—"}</p>
      </div>`);
  }

  if (config.show_stock_boissons) {
    sections.push(`
      <div class="section">
        <h2>Stock de boissons du site</h2>
        <p class="big">${bulletin.stock_boissons ?? "—"}${bulletin.conditionnement_boissons ? ` <span class="label" style="font-size:11px;">(${esc(bulletin.conditionnement_boissons)})</span>` : ""}</p>
      </div>`);
  }

  if (config.show_boissons_gratuites) {
    sections.push(`
      <div class="section">
        <h2>Boissons gratuites</h2>
        <p class="big">${bulletin.nombre_boissons_gratuites ?? "—"}${bulletin.conditionnement_boissons ? ` <span class="label" style="font-size:11px;">(${esc(bulletin.conditionnement_boissons)})</span>` : ""}</p>
      </div>`);
  }

  if (config.show_ventes_detail) {
    sections.push(`
      <div class="section">
        <h2>Ventes</h2>
        <div class="row">
          <div class="field"><span class="label">Hors promo</span><span class="value">${bulletin.ventes_hors_promo}</span></div>
          <div class="field"><span class="label">Total ventes</span><span class="value">${bulletin.nb_ventes}</span></div>
          <div class="field"><span class="label">Chiffre d'affaires</span><span class="value">${esc(bulletin.chiffre_affaires)}</span></div>
        </div>
        <p class="label" style="margin-top:10px;">Ventes promo</p>
        ${ventesPromoHtml}
      </div>`);
  }

  if (config.show_ugs_recus) {
    sections.push(`<div class="section"><h2>UGs reçus</h2>${ugsListHtml(bulletin.ugs_recus)}</div>`);
  }

  if (config.show_ugs_distribues) {
    sections.push(`<div class="section"><h2>UGs distribués</h2>${ugsListHtml(bulletin.ugs_distribues)}</div>`);
  }

  if (config.show_degustation) {
    sections.push(`
      <div class="section">
        <h2>Dégustation</h2>
        <div class="row">
          <div class="field"><span class="label">Total</span><span class="value">${bulletin.nb_degustations}</span></div>
          ${config.show_genre ? `
          <div class="field"><span class="label">Hommes</span><span class="value">${bulletin.genre_breakdown.hommes}</span></div>
          <div class="field"><span class="label">Femmes</span><span class="value">${bulletin.genre_breakdown.femmes}</span></div>` : ""}
        </div>
      </div>`);
  } else if (config.show_genre) {
    sections.push(`
      <div class="section">
        <h2>Répartition par genre</h2>
        <div class="row">
          <div class="field"><span class="label">Hommes</span><span class="value">${bulletin.genre_breakdown.hommes}</span></div>
          <div class="field"><span class="label">Femmes</span><span class="value">${bulletin.genre_breakdown.femmes}</span></div>
        </div>
      </div>`);
  }

  if (config.show_tranche_age) {
    const trancheRows = bulletin.tranche_age_breakdown
      .filter(t => t.quantite > 0)
      .map(t => `<div class="field"><span class="label">${esc(t.label)}</span><span class="value">${t.quantite}</span></div>`)
      .join("");
    sections.push(`
      <div class="section">
        <h2>Répartition par tranche d'âge</h2>
        <div class="row">${trancheRows || `<p class="muted">Aucune donnée.</p>`}</div>
      </div>`);
  }

  if (config.show_notes_degustation) {
    sections.push(`
      <div class="section">
        <h2>Notes moyennes</h2>
        <div class="row">
          <div class="field"><span class="label">Goût</span><span class="value">${bulletin.notes_moyennes.note_gout != null ? bulletin.notes_moyennes.note_gout.toFixed(1) : "—"}</span></div>
          <div class="field"><span class="label">Ambiance</span><span class="value">${bulletin.notes_moyennes.note_ambiance != null ? bulletin.notes_moyennes.note_ambiance.toFixed(1) : "—"}</span></div>
        </div>
      </div>`);
  }

  if (config.show_ugs_restants) {
    sections.push(`<div class="section"><h2>UGs restants</h2>${ugsListHtml(bulletin.ugs_restants)}</div>`);
  }

  if (config.show_personnes_touchees) {
    sections.push(`
      <div class="section">
        <h2>Personnes touchées</h2>
        <p class="big">${bulletin.nombre_personnes_touchees ?? "—"}</p>
      </div>`);
  }

  if (config.show_avis_consommateurs) {
    sections.push(`
      <div class="section">
        <h2>Avis des consommateurs</h2>
        <p class="text">${esc(bulletin.avis_consommateurs) || "<span class=\"muted\">Aucun avis renseigné.</span>"}</p>
      </div>`);
  }

  if (config.show_observation_generale) {
    sections.push(`
      <div class="section">
        <h2>Observation générale</h2>
        <p class="text">${esc(bulletin.observation_generale) || "<span class=\"muted\">Aucune observation renseignée.</span>"}</p>
      </div>`);
  }

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Bulletin — ${esc(bulletin.site_nom)} — ${bulletin.date}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#1e293b;padding:90px 20px 30px;background:#f8fafc}
  .action-bar{position:fixed;top:0;left:0;right:0;height:60px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:flex-end;padding:0 24px;gap:10px;z-index:999}
  .btn{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none}
  .btn-download{background:#0f766e;color:#fff}
  .btn-print{background:#f1f5f9;color:#334155;border:1px solid #cbd5e1}
  #capture-zone{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden}
  .hdr{background:#0f766e;color:#fff;padding:22px 24px}
  .hdr h1{font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.3px}
  .hdr p{font-size:12px;opacity:.85;margin-top:4px}
  .meta{padding:16px 24px;border-bottom:1px solid #e2e8f0;display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field{display:flex;flex-direction:column;gap:2px}
  .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}
  .value{font-size:15px;font-weight:800;color:#0f172a}
  .section{padding:16px 24px;border-bottom:1px solid #e2e8f0}
  .section h2{font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#0f766e;font-weight:800;margin-bottom:10px}
  .big{font-size:22px;font-weight:900;color:#0f172a}
  .text{font-size:13px;line-height:1.5;color:#334155}
  .muted{color:#94a3b8;font-style:italic;font-size:12px}
  .ugs-list, .promo-list{list-style:none;display:flex;flex-direction:column;gap:6px}
  .ugs-list li{display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;font-size:12px}
  .promo-list li{font-size:12px}
  .foot{padding:14px 24px;text-align:center;color:#94a3b8;font-size:10px}
  @media print{ .action-bar{display:none !important} body{padding:0;background:#fff} #capture-zone{box-shadow:none;max-width:100%} }
</style></head>
<body>
<div class="action-bar">
  <button class="btn btn-download" onclick="generateDirectPDF()">⬇ PDF</button>
  <button class="btn btn-print" onclick="window.print()">🖨️ Imprimer</button>
</div>
<div id="capture-zone">
  <div class="hdr">
    <h1>Rapport ${esc(campagneNom)}</h1>
    <p>${fmtDateLong(bulletin.date)} — Site : ${esc(bulletin.site_nom)} — BA : ${esc(bulletin.hotesse_nom)}</p>
  </div>
  ${sections.join("\n")}
  <div class="foot">Bulletin généré depuis MHedia BTL</div>
</div>
<script>
  function generateDirectPDF() {
    const element = document.getElementById('capture-zone');
    const opt = {
      margin: 10,
      filename: "Bulletin_${safeNom}.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }
</script>
</body></html>`;
}
