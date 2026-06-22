## RÔLE
Tu es un UX/UI Designer Senior + Développeur Next.js/Tailwind 
expert. Tu interviens directement dans le repo local de 
l'application "MHédia" via Claude Code dans VS Code.

## OBJECTIF DE CETTE SESSION
Corriger l'expérience utilisateur et appliquer la charte 
graphique officielle MHédia sur l'ensemble de l'application, 
SANS toucher à la logique métier, aux modèles de données, 
ni à la structure des Produits/Campagnes actuelle. 
C'est une refonte UX/UI pure, pas une refonte fonctionnelle.

## NE PAS FAIRE
- Ne pas modifier les schémas de base de données
- Ne pas changer la logique des API/routes existantes
- Ne pas casser l'authentification par rôle
- Ne pas toucher aux données des campagnes actives 
  (ARMAND, EAU, CHR)
- Ne pas ajouter de dépendances lourdes (pas de Material UI, 
  Ant Design — rester sur Tailwind + composants légers)
- Ne pas supprimer ni modifier le champ "couleur de marque" 
  existant sur les entreprises (voir règle de branding 
  ci-dessous — c'est une fonctionnalité core, pas un bug)

---

## ⚠️ RÈGLE CRITIQUE À COMPRENDRE AVANT TOUTE MODIFICATION 
## DE COULEUR — LIRE EN PREMIER

Le système a DEUX niveaux de branding distincts qui ne 
doivent JAMAIS être confondus. C'est une exigence non 
négociable de la direction MHédia.

### 1. Branding MHédia (fixe, palette teal/turquoise)
S'applique UNIQUEMENT à :
- Le menu latéral (sidebar) sur TOUS les rôles, sans exception
- Les pages globales sans contexte d'entreprise précis : 
  liste des Entreprises, liste globale des Campagnes (avant 
  sélection d'une campagne), page Équipe terrain, page 
  Produits, page Prix par site, page Goodies (vues plateforme)

### 2. Branding Client (dynamique, par entreprise)
S'applique dès qu'on entre dans le contexte d'UNE entreprise/
campagne précise, à QUASI TOUT sauf le menu latéral :
- Header de la page détail de campagne
- Boutons CTA de cette page
- Graphiques et visualisations de cette page
- Cards et badges liés à cette campagne
- Rapports générés (PDF, emails) pour cette campagne
- L'interface Hôtesse terrain dans le contexte d'une campagne 
  (header, boutons, accents) — OUI le branding client 
  s'applique aussi sur mobile/terrain, exactement comme sur 
  Client/Admin
- Le dashboard du Client/Entreprise lui-même

Cette couleur vient d'un champ "couleur de marque" déjà 
existant, renseigné à la création de l'entreprise. NE PAS 
le retirer, NE PAS le remplacer par une couleur fixe.

### Comment trancher dans le code
Avant de toucher à une couleur de header/CTA, pose-toi la 
question : "Cette page affiche-t-elle des données liées à 
UNE entreprise/campagne déjà sélectionnée ?"
  → OUI : la couleur doit venir du champ company.brand_color 
    (ou équivalent existant dans le schéma) — ne jamais la 
    coder en dur ni la remplacer par du teal MHédia
  → NON : appliquer la palette MHédia unifiée définie plus bas

### Conséquence sur le composant PageHeader
Le composant PageHeader unifié (voir section Design) doit 
accepter une prop `brandColor` optionnelle qui, si fournie 
(contexte entreprise), override la couleur par défaut MHédia.

### Le watermark puzzle reste universel
Le motif puzzle en filigrane (voir plus bas) s'applique sur 
TOUTES les pages sans exception, y compris les pages brandées 
aux couleurs du client. Il doit être en teinte NEUTRE (gris 
très clair), jamais en teal MHédia, pour ne jamais entrer en 
conflit visuel avec une couleur de marque client (rouge, 
orange, etc.)

---

## ÉTAPE 0 — AUDIT OBLIGATOIRE (à faire en premier, avant tout code)

Explore le projet et réponds-moi avec ces informations avant 
de modifier le moindre fichier :

1. **Système de styling** : Tailwind config, CSS Modules, 
   styled-components ? Où se trouve le fichier de thème central ?

2. **Composants partagés existants** : liste les composants 
   Layout, Sidebar, Card, Button, Table, Modal, PageHeader 
   (s'il existe déjà) et leurs emplacements

3. **Mécanisme de branding dynamique existant** : trouve le 
   champ "couleur de marque" sur le modèle Entreprise/Company, 
   et identifie TOUS les endroits du code qui l'utilisent déjà 
   pour appliquer une couleur dynamique (header de campagne, 
   dashboard client, etc.) — liste ces fichiers précisément, 
   c'est la zone la plus sensible à ne pas casser

4. **Fichiers avec couleurs codées en dur** : liste tous les 
   fichiers où des gradients ou couleurs sont actuellement 
   codés en dur sur les headers de pages GLOBALES (Entreprises, 
   Produits, Goodies, Équipe terrain, Statistiques, Sites, 
   Objectifs, Rapports, Prix par site) — celles-ci seront 
   unifiées en palette MHédia

5. **Composant Modal/Dialog existant** : identifie le composant 
   utilisé pour la modale "Nouvelle campagne" et son fichier

6. **Formulaire hôtesse actuel** : localise le composant du 
   formulaire "Enregistrer une activation promo"

7. **Mode hors-ligne** : vérifie s'il existe déjà un mécanisme 
   de stockage local (IndexedDB, localStorage, service worker) 
   ou si c'est entièrement à créer

PRÉSENTE-MOI cette liste avant de continuer. N'écris aucun 
code à cette étape. J'attends ta synthèse pour valider avant 
de passer à la suite.

---

## 1. CHARTE GRAPHIQUE MHÉDIA — PAGES GLOBALES UNIQUEMENT

### Palette de couleurs (pages sans contexte client)
Crée ou mets à jour le fichier de thème central avec ces 
variables (couleurs à affiner par inspection du logo MHédia 
fourni séparément) :

  --color-primary-dark:    teal foncé      (#1B4F5C environ)
  --color-primary:         teal/bleu canard (#2E7A8C environ)
  --color-secondary-light: turquoise clair (#7FD4D9 environ)
  --color-accent:          cyan vif        (#00C9D4 environ)
  --color-neutral-gray:    gris moyen      (#8C8C8C environ)
  --color-background:      bleu très clair (#EAF7F8 environ)
  --color-text:             teal très foncé (#1A3A40 environ)

Applique cette palette UNIQUEMENT sur :
- Le menu latéral (toujours, sur tous les rôles)
- Les headers des pages globales listées dans l'audit 
  (Entreprises, Produits, Goodies, Équipe terrain, 
  Statistiques, Sites, Objectifs, Rapports, Prix par site)

NE PAS toucher aux couleurs des pages contextuelles à une 
entreprise (voir règle de branding ci-dessus).

### Logo
Le logo MHédia ne doit jamais être déformé, recoloré 
différemment, ou compressé de façon disproportionnée.

### Composant PageHeader unifié [PRIORITAIRE]
Crée UN seul composant `PageHeader` réutilisable :
- Props : `title`, `description`, `icon`, `ctaSlot`, 
  `brandColor` (optionnelle)
- Si `brandColor` n'est pas fournie → applique la palette 
  MHédia par défaut
- Si `brandColor` est fournie (contexte entreprise) → 
  applique cette couleur au fond/accent du header
- Style : titre en gras, icône à gauche, description courte 
  en dessous, zone CTA à droite
- Utilise ce composant sur TOUTES les pages, globales ET 
  contextuelles (seule la couleur change selon le contexte, 
  pas la structure)

### Watermark puzzle en arrière-plan [NOUVEAU]
- Génère un pattern SVG de pièces de puzzle assemblées, 
  coins arrondis, en monochrome gris très clair (neutre, 
  jamais en teal ni en couleur de marque client)
- Opacité finale : 5 à 8% maximum
- Applique-le en `background-image` CSS sur le wrapper 
  principal du layout — UN SEUL point d'intégration global
- Taille de tuile répétée : environ 250-300px
- Z-index le plus bas : cards, tableaux, textes doivent avoir 
  un fond opaque qui le masque ; visible seulement dans les 
  espaces vides entre sections
- Ne jamais l'appliquer sur boutons, inputs, zones de texte dense
- SVG léger uniquement (pas de PNG/JPG répété), pour ne pas 
  ralentir le scroll mobile
- S'applique sur TOUTES les pages sans exception, y compris 
  celles brandées aux couleurs du client

---

## 2. CORRECTIONS UX — PAR RÔLE

### 👤 ADMINISTRATEUR

#### Page Ventes [CRITIQUE]
- Pagination 25 lignes/page au lieu du scroll infini
- Tri cliquable sur chaque en-tête de colonne
- Ligne TOTAL fixe en bas de tableau
- Groupement visuel par date
- Filtres : hôtesse, site, campagne, période
- Vue mobile : liste condensée (hôtesse + quantité + date)

#### Page Dégustations [CRITIQUE]
- Vue liste par défaut au lieu de la grille dense 3 colonnes
- Toggle Vue liste / Vue grille
- Corriger l'incohérence de thème de la sidebar (actuellement 
  sombre sur cette page, claire ailleurs — uniformiser sur 
  la palette MHédia partout)

#### Page Objectifs
- "—" au lieu de "0" en bleu quand aucun objectif n'est défini
- Mini barre de progression colorée par ligne (rouge <50%, 
  orange <80%, vert ≥80%)

#### Page Rapports journaliers
- Modale de confirmation avant envoi d'emails : "Envoyer les 
  rapports du [date] à [N] destinataires ?"
- "—" au lieu de "0 F CFA" avec tooltip explicatif quand 
  aucun prix n'est configuré
- Rappel : le PDF/email généré reste branded aux couleurs 
  du client concerné — ne pas uniformiser ce point

#### Page Prix par site
- Bouton "+ Nouveau prix" ajouté directement sous le message 
  d'état vide (en plus du bouton déjà en haut à droite)

#### Page Équipe terrain
- Réduire à 2 actions visibles max par carte : "Modifier" + 
  menu "..." (Désactiver/Supprimer/Renvoyer identifiants)
- Vue mobile : cards en liste verticale

#### Page Entreprises
- Corriger le scroll de la sidebar qui coupe actuellement 
  l'élément actif "Entreprises"

#### Formulaire "Nouvelle campagne" [NOUVEAU — CRITIQUE]
- Modale avec hauteur max 90vh, header et footer (boutons 
  Annuler/Suivant/Créer) sticky, scroll uniquement sur le 
  corps de la modale — actuellement la liste des hôtesses 
  est tronquée et le bouton de validation est invisible 
  sans scroller
- Validation inline sur les champs obligatoires (bordure 
  rouge + message si champ vide quitté)
- Compteur dynamique sur "Superviseurs (0)" / "Hôtesses (0)" 
  qui s'incrémente en temps réel à la sélection
- Champ de recherche rapide au-dessus de la liste si elle 
  dépasse 5-6 personnes
- Si plusieurs sites ajoutés : transformer chaque bloc "SITE 1", 
  "SITE 2"... en accordéon repliable, avec le nom du site saisi 
  affiché dans l'en-tête de l'accordéon une fois rempli

#### Toutes les pages Admin
- Fil d'Ariane sur les pages secondaires
- Filtres mémorisés dans l'URL (query params)
- Corriger le dropdown "Toutes les campagnes" tronqué sur 
  Statistiques (largeur minimale fixe)

---

### 🏢 CLIENT / ENTREPRISE

#### Dashboard global
- Graphique "Progression journalière" : passer d'un fond 
  noir/sombre à un fond clair cohérent (la couleur du tracé/
  accent peut rester celle de la marque client, mais le fond 
  du graphique doit être clair comme le reste de la page)
- Filtres de période : Aujourd'hui / 7 jours / 30 jours / 
  Personnalisé
- Objectif à 0% alors que campagne active depuis +2 jours 
  → alerte visuelle rouge

#### Page Campagne individuelle [CRITIQUE]
Restructurer le scroll infini en onglets sticky :
  [Vue globale] [Sites] [Actions] [Rapports]
- "Vue globale" : KPIs, objectifs, graphique 14 jours, offres
- "Sites" : tableau comparatif (une ligne par site)
- "Actions" : 10 dernières actions + lien "Voir tout"
- "Rapports" : téléchargements avec période indiquée
- Le header de ces onglets et leurs accents restent dans la 
  couleur de marque du client (voir règle de branding)

- Corriger TOUTES les occurrences de "NaN" → "—"
- Graphique "Évolution sur 14 jours" : hauteur min 200px, 
  espacer les labels d'axe X, scrollable horizontalement 
  sur mobile
- Libellés d'offres complets : "Achetez 10 produits → 1 
  goodie offert" au lieu de "Acheter 10 produits → 1"
- Bouton "Exporter" → préciser "Exporter (Excel)" avec icône

---

### 👷 HÔTESSE TERRAIN
Mobile first — utilisation debout, une main, face au client.
Rappel : le branding client (couleur de marque) s'applique 
ici aussi, exactement comme sur les vues Client/Admin — 
seule la structure de navigation change, pas la couleur.

#### Navigation [CRITIQUE]
- Bottom navigation mobile à 4 icônes : 🏠 Accueil | 
  📋 Campagnes | 🎯 Objectifs | 🎡 Roue
- Masquer les items non pertinents (Statistiques, vues admin)
- Header minimal : logo + nom hôtesse + indicateur réseau, 
  dans la couleur de marque de la campagne en cours

#### Formulaire "Enregistrer une activation promo" [CRITIQUE]
Stepper 3 étapes :
1. Client (prénom + tranche d'âge)
2. Achat (produit + quantité avec boutons +/-)
3. Offre (suggestion auto selon quantité + boutons radio, 
   "aucune promotion" non cochée par défaut)
- Remplacer les 6 checkboxes par des boutons radio
- Bouton final "Enregistrer le client" pleine largeur, dans 
  la couleur d'accent de la marque client

#### Après soumission
- Confirmation plein écran (1 seconde) + vibration mobile
- Réinitialisation automatique à l'étape 1
- Compteur d'objectifs incrémenté en temps réel

#### Indicateur hors-ligne
- Bandeau jaune hors réseau : "Mode hors-ligne — données 
  sauvegardées localement"
- Bandeau vert à la reconnexion : "Synchronisation réussie"
- Sauvegarde locale (IndexedDB/localStorage), sync auto au 
  retour réseau

#### Liste des campagnes
- Campagne "Planifiée" : bouton "Voir détails" désactivé, 
  afficher "Disponible le [date]"

#### Objectifs
- Supprimer la duplication actuelle (objectifs affichés 2 fois)
- "Aucun objectif défini" → "Objectif libre"
- Transition animée (0.3s) sur la progression de la barre

#### Corrections de texte (fautes dans les offres)
- "30 achetés=10 fferts" → "30 achetés → 10 offerts"
- "20 achetés = 6 offert" → "20 achetés → 6 offerts"
- "5 achetés = 3 offert" → "5 achetés → 3 offerts"
Uniformiser le format partout : "X achetés → Y offerts"

#### Roue à cadeaux
- Bouton flottant (FAB) sur la page campagne, icône 🎡, 
  couleur accent de la marque client, position fixed 
  bottom-right

---

## 3. RÈGLES TRANSVERSALES (toutes pages, tous rôles)

- Tout bouton d'action → état loading pendant l'exécution
- Toute action réussie → toast de confirmation (3 secondes)
- Toute erreur → toast avec message explicite (jamais 
  "Erreur 500" brut)
- Toute action irréversible (suppression, envoi d'email) 
  → modale de confirmation obligatoire
- Toutes les cards → style unifié (radius 12px, ombre douce, 
  padding cohérent) — la couleur de fond peut varier selon 
  le branding, mais la forme/structure reste identique
- Tous les éléments cliquables ≥ 44x44px
- Contraste texte/fond ≥ 4.5:1 partout, y compris avec le 
  watermark puzzle et peu importe la couleur de marque 
  appliquée (vérifier le contraste dynamiquement si la 
  couleur client est très claire ou très foncée)

---

## MÉTHODE DE TRAVAIL AVEC CLAUDE CODE

### Ordre d'exécution strict
1. **ÉTAPE 0 — Audit** : exécuter uniquement l'audit décrit 
   plus haut, présenter la synthèse, ATTENDRE ma validation
2. **Fondations visuelles** : palette MHédia (pages globales 
   uniquement) + composant PageHeader avec prop brandColor + 
   watermark puzzle → tester sur 2-3 pages de chaque catégorie 
   (une globale, une contextuelle) avant de propager partout
3. **Formulaire Nouvelle campagne** : corriger la modale 
   (hauteur, sticky, validation, accordéons)
4. **Corrections Admin** (Ventes, Dégustations, Objectifs, 
   Rapports, Prix par site, Équipe terrain, Entreprises)
5. **Corrections Client** (Dashboard, page Campagne en onglets, 
   NaN, graphiques)
6. **Corrections Hôtesse** (bottom nav, formulaire stepper, 
   hors-ligne, roue à cadeaux)
7. **Règles transversales** (peuvent être faites en parallèle 
   si elles touchent des composants déjà génériques)

### Pendant la session
- Demander un diff avant chaque modification de fichier 
  partagé important (theme, layout, composants communs, et 
  SURTOUT tout fichier lié au branding dynamique identifié 
  à l'audit)
- Lancer `npm run dev` après chaque étape pour vérifier 
  visuellement avant de continuer
- Utiliser `/clear` entre les grandes phases

### Commits (format strict)
type(scope): description
- style(theme): appliquer palette MHédia sur pages globales
- style(layout): ajouter watermark puzzle en arrière-plan
- style(headers): créer composant PageHeader avec brandColor
- fix(admin/campagne-modal): corriger hauteur et sticky footer
- fix(admin/ventes): ajouter pagination et tri colonnes
- fix(admin/rapports): ajouter modale confirmation envoi email
- fix(client/campagne): restructurer en onglets sticky
- fix(client/campagne): corriger affichage NaN
- fix(hotesse/nav): remplacer sidebar par bottom navigation
- fix(hotesse/formulaire): transformer en stepper 3 étapes
- fix(hotesse/offline): ajouter mode hors-ligne avec sync

---

## DÉFINITION DE "TERMINÉ"

### Branding (vérification prioritaire)
✅ Le branding dynamique par couleur client fonctionne encore 
   exactement comme avant sur toutes les pages contextuelles
✅ Le menu latéral reste en couleurs MHédia sur tous les rôles
✅ Les pages globales utilisent la palette MHédia unifiée
✅ Le watermark puzzle est neutre (gris) et ne clashe avec 
   aucune couleur de marque client testée

### Design global
✅ Logo jamais déformé ni recoloré
✅ Composant PageHeader unique utilisé partout, avec couleur 
   dynamique fonctionnelle
✅ Watermark puzzle visible en filigrane (5-8%) sans nuire 
   à la lisibilité, sur toutes les pages

### Admin
✅ Modale "Nouvelle campagne" : tout son contenu accessible 
   sans frustration, bouton de validation toujours visible
✅ Page Ventes : pagination + tri + total
✅ Page Dégustations : vue liste par défaut + toggle grille
✅ Sidebar cohérente partout
✅ "—" au lieu de "0" quand pas de donnée/objectif défini
✅ Modale de confirmation avant envoi d'emails
✅ Fil d'Ariane sur les pages secondaires

### Client
✅ Page campagne restructurée en 4 onglets sticky, toujours 
   dans la couleur de marque du client
✅ Plus aucun "NaN" visible
✅ Graphique 14 jours lisible sur mobile

### Hôtesse
✅ Bottom navigation mobile fonctionnelle, dans la couleur 
   de marque de la campagne en cours
✅ Formulaire en 3 étapes avec stepper visible
✅ Mode hors-ligne avec sauvegarde et sync automatique
✅ Toutes les fautes de libellés corrigées
✅ Objectifs affichés une seule fois, sans duplication