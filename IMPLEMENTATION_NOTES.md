# Notes d'integration frontend

Branche de travail:

```bash
feature/rapport-ventes-optimise-and-sites-management
```

## Modifications principales

- Ajout d'un menu admin `Sites` sous `Goodies` dans la sidebar.
- Ajout de la page `app/dashboard/sites/page.tsx` pour gerer les sites:
  - recherche et filtres entreprise/campagne;
  - edition du nom, de la ville et de l'emplacement;
  - suppression de site;
  - gestion du ciblage des offres promotionnelles par site;
  - action `Cibler ce site` et retour en offre globale.
- Amelioration de la page `Ventes`:
  - filtre par type de vente: normale, offert promo, offert goodie;
  - pastilles visuelles par type de vente;
  - export XLSX avec colonne `Type`;
  - rapport PDF vente rapproche du modele `Rapport_Performances_33_EXPORT.pdf`;
  - sections du PDF: KPI, performances cumulees par hotesse/site, repartition des goodies, journal des transactions;
  - regroupement des transactions achat/offert sur une seule ligne.
- Correction du flux promotion cote degustation:
  - `produit_id` est envoye lors de l'enregistrement d'un gain promotionnel;
  - evite la double creation d'une vente normale quand une promotion est appliquee.
- Ajout de `nb_goodies`, `Promotion.sites` et champs de branding dans les types frontend.
- Correction TypeScript du composant legacy `components/Campaignreport.tsx`.
- Correction de l'import API dans `lib/services/goodie-service.ts`.

## Fichiers modifies

```text
app/dashboard/sales/page.tsx
app/dashboard/tastings/page.tsx
app/dashboard/sites/page.tsx
app/dashboard/rapports/page.tsx
components/Campaignreport.tsx
components/dashboard/sidebar.tsx
lib/services/goodie-service.ts
lib/services/promotionService.ts
lib/types/backend.ts
```

## Prerequis

- Node.js compatible Next.js 16.
- pnpm installe.
- Backend lance et joignable via `NEXT_PUBLIC_API_URL`.

Exemple `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8003/api
```

## Installation et verification

```bash
cd /Users/user/Downloads/BTL/BTL_frontend-git
pnpm install
pnpm exec tsc --noEmit
pnpm run dev
```

L'application frontend est ensuite disponible sur:

```text
http://localhost:3000
```

## Points a tester avant merge

- Connexion admin.
- Menu `Sites` visible uniquement pour l'admin.
- Ciblage d'une offre sur un site puis verification que les autres sites ne la voient plus.
- Creation d'une degustation avec achat + promotion.
- Page `Ventes`: filtre `Offerts promotion`.
- Rapport PDF ventes:
  - volume vendu et volume offert sur la meme ligne dans le journal;
  - goodies distribues visibles;
  - branding entreprise applique.

## Commit et push

```bash
git add app/dashboard/sales/page.tsx app/dashboard/tastings/page.tsx app/dashboard/sites/page.tsx app/dashboard/rapports/page.tsx components/Campaignreport.tsx components/dashboard/sidebar.tsx lib/services/goodie-service.ts lib/services/promotionService.ts lib/types/backend.ts IMPLEMENTATION_NOTES.md
git commit -m "Improve sales report promo tracking and site management"
git push -u origin feature/rapport-ventes-optimise-and-sites-management
```
