// Types correspondant exactement aux réponses de l'API Django backend

export type BackendRole =
  | "Hotesse"
  | "Entreprise"
  | "Superviseur"
  | "Administrateur"
  | "Non defini";

export type TrancheAge =
  | "MOINS_18"
  | "18_25"
  | "26_35"
  | "36_50"
  | "PLUS_50";

export type IntentionAchat = "FAIBLE" | "MOYENNE" | "ELEVEE";
export type Genre = "HOMME" | "FEMME";
export type TypeConditionnement = "UNITE" | "PACK";

export type TypeCampagne = "DEGUSTATION" | "VENTE" | "DEGUSTATION_VENTE";
export type TypeRecompense = "AUCUNE" | "GOODIES" | "PROMOTIONS";
export type TypePromotion = "OFFERT" | "GAGNE" | "TIRAGE";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TokenPair {
  access: string;
  refresh: string;
}

// ---------------------------------------------------------------------------
// Utilisateur
// ---------------------------------------------------------------------------

export interface RemoteUser {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: BackendRole;
  role_display: string;
  is_active: boolean;
  is_password_changed: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Produit
// ---------------------------------------------------------------------------

export interface Produit {
  id: string;
  nom: string;
  description: string | null;
  type_conditionnement: TypeConditionnement;
  type_conditionnement_display: string;
  prix_indicatif: string | null;
  created_at: string;
}

export interface ProduitCreatePayload {
  nom: string;
  description?: string;
  type_conditionnement?: TypeConditionnement;
  prix_indicatif?: number | null;
}

export interface ServiceCreatePayload {
  nom: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Entreprise
// ---------------------------------------------------------------------------

export interface Entreprise {
  id: string;
  nom_commercial: string;
  telephone: string | null;
  adresse: string | null;
  couleur_primaire: string;
  couleur_secondaire: string;
  logo_url: string | null;
  email: string;
  nom_utilisateur: string;
  is_password_changed: boolean;
  produits: Produit[];
  // Services (app "services" — campagnes service, indépendant des produits).
  services: ServicePromu[];
  created_at: string;
  /** Présent après création : indique si l'e-mail d'identifiants a été envoyé */
  email_sent?: boolean;
  email_error?: string;
}

export interface CreateEntreprisePayload {
  email: string;
  nom_commercial: string;
  name?: string;
  telephone?: string;
  adresse?: string;
  couleur_primaire?: string;
  couleur_secondaire?: string;
  logo_url?: string;
  produits?: ProduitCreatePayload[];
  services?: ServiceCreatePayload[];
}

// ---------------------------------------------------------------------------
// Campagne
// ---------------------------------------------------------------------------

export interface CampagneList {
  id: string;
  nom: string;
  entreprise: string;
  entreprise_nom: string;
  couleur_primaire: string;
  couleur_secondaire: string;
  logo_url: string | null;
  type_campagne: TypeCampagne;
  type_campagne_display: string;
  type_recompense: TypeRecompense;
  type_recompense_display: string;
  date_debut: string;
  date_fin: string;
  description: string | null;
  objectif_degustations: number | null;
  objectif_ventes: number | null;
  objectif_gratuites: number | null;
  objectif_goodies: number | null;
  note_gout_active: boolean;
  note_gout_max: 5 | 10;
  note_ambiance_active: boolean;
  note_ambiance_max: 5 | 10;
  nb_sites: number;
  nb_hotesses: number;
  nb_superviseurs: number;
  created_at: string;
}

export interface Promotion {
  id: string;
  campagne: string;
  sites: string[];
  sites_noms: string[];
  type_promotion: TypePromotion;
  type_promotion_display: string;
  conditionnement: TypeConditionnement;
  conditionnement_display: string;
  quantite_requise: number;
  quantite_offerte: number;
  recompense_description: string;
  produit_cible: string | null;
  produit_cible_nom: string | null;
  is_active: boolean;
  goodies: string[];
  goodies_details: { id: string; nom: string }[];
  created_at: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  role: "Hotesse" | "Superviseur";
  username?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: BackendRole;
  role_display: string;
}

export interface CampagneDetail extends Omit<CampagneList, "nb_sites" | "nb_hotesses" | "nb_superviseurs"> {
  superviseurs: TeamMember[];
  hotesses: TeamMember[];
  promotions: Promotion[];
}

export interface CampagneSiteProduitStat {
  produit_nom: string;
  degustations: number;
  ventes: number;
}

export interface CampagneSiteGoodieStat {
  goodie_id: string;
  goodie_nom: string;
  quantite_initiale: number;
  quantite_restante: number;
  quantite_distribuee: number;
}

export interface CampagneSiteRapport {
  id: string;
  nom: string;
  ville: string;
  emplacement_precis: string | null;
  nb_hotesses: number;
  nb_superviseurs: number;
  degustations: number;
  acheteurs: number;
  ventes: number;
  taux_conversion: number;
  chiffre_affaires: string;
  produits: CampagneSiteProduitStat[];
  goodies?: CampagneSiteGoodieStat[];
  goodies_distribues_total?: number;
 promotions_stats?: {
    promotion_id: string;
    recompense_description: string;
    quantite_requise: number;
    gains_count: number;
    produits_concernes: number;
  }[];
}

export interface CampagneRapportSites {
  campagne_id: string;
  campagne_nom: string;
  sites: CampagneSiteRapport[];
  totaux: {
    sites: number;
    degustations?: number;
    ventes?: number;
    goodies_distribues?: number;
    gains_promotions?: number;
    produits_concernes?: number;
  };
}

export interface CreateCampagnePayload {
  nom: string;
  entreprise: string;
  date_debut: string;
  date_fin: string;
  description?: string;
  type_campagne?: TypeCampagne;
  type_recompense?: TypeRecompense;
  note_gout_active?: boolean;
  note_gout_max?: 5 | 10;
  note_ambiance_active?: boolean;
  note_ambiance_max?: 5 | 10;
  objectif_degustations?: number | null;
  objectif_ventes?: number | null;
  objectif_gratuites?: number | null;
  objectif_goodies?: number | null;
}

export interface CreatePromotionPayload {
  campagne: string;
  sites?: string[];
  type_promotion: TypePromotion;
  conditionnement?: TypeConditionnement;
  quantite_requise: number;
  quantite_offerte: number;
  recompense_description: string;
  produit_cible?: string | null;
  goodies?: string[];
  is_active?: boolean;
}

export interface ManageTeamPayload {
  superviseurs_ids: string[];
  hotesses_ids: string[];
  notify?: boolean;
}

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export interface SiteList {
  id: string;
  nom: string;
  ville: string;
  emplacement_precis: string | null;
  // null = site sans campagne produit (site service uniquement).
  campagne: string | null;
  campagne_nom: string | null;
  entreprise_nom: string | null;
  nb_hotesses: number;
  nb_superviseurs: number;
  created_at: string;
}

export interface SiteDetail extends Omit<SiteList, "nb_hotesses" | "nb_superviseurs"> {
  superviseurs: TeamMember[];
  hotesses: TeamMember[];
}

export interface CreateSitePayload {
  nom: string;
  ville?: string;
  emplacement_precis?: string;
  // L'un des deux est requis (validé côté backend) : une campagne produit
  // classique, ou une campagne service pour un site sans activité produit.
  campagne?: string;
  campagne_service?: string;
}

// ---------------------------------------------------------------------------
// Dégustation
// ---------------------------------------------------------------------------

export interface VenteLight {
  id: string;
  conditionnement: TypeConditionnement;
  conditionnement_display: string;
  quantite: number;
  prix_total: string | null;
}

export interface Degustation {
  id: string;
  site: string;
  site_nom: string;
  campagne_nom: string;
  hotesse: string;
  hotesse_nom: string;
  produit: string;
  produit_nom: string;
  nom_client: string | null;
  tranche_age: TrancheAge;
  tranche_age_display: string;
  genre: Genre;
  genre_display: string;
  note_gout: number | null;
  note_ambiance: number | null;
  intention_achat: IntentionAchat;
  intention_achat_display: string;
  a_achete: boolean;
  vente: VenteLight | null;
  created_at: string;
}

export interface CreateDegustationPayload {
  site: string;
  produit: string;
  nom_client?: string;
  tranche_age: TrancheAge;
  genre: Genre;
  note_gout?: number | null;
  note_ambiance?: number | null;
  intention_achat: IntentionAchat;
  a_achete: boolean;
  conditionnement?: TypeConditionnement;
  quantite?: number;
  // true si un gain promotionnel va être enregistré juste après (POST
  // /promotions/{id}/enregistrer-gain/) — évite que le backend crée une
  // Vente NORMAL en double en l'absence de conditionnement.
  promotion_appliquee?: boolean;
  // Requis uniquement pour une saisie manuelle par un Admin/Superviseur
  // pour le compte d'une hôtesse (cf. /dashboard/saisie-manuelle).
  hotesse_id?: string;
}

export interface MonSiteInfo {
  site_id: string;
  site_nom: string;
  campagne_id: string;
  campagne_nom: string;
  entreprise_nom: string;
  // Pilote la variante de formulaire affichée côté hôtesse (dégustation
  // seule / vente seule / dégustation + vente).
  type_campagne: TypeCampagne;
  type_campagne_display: string;
  type_recompense: TypeRecompense;
  type_recompense_display: string;
  note_gout_active: boolean;
  note_gout_max: 5 | 10;
  note_ambiance_active: boolean;
  note_ambiance_max: 5 | 10;
  auto_select_produit: boolean;
  produits: { id: string; nom: string; prix_indicatif: string | null }[];
  goodies_disponibles: { id: string; nom: string; quantite_restante: number }[];
  promotions: {
    id: string;
    type_promotion: TypePromotion;
    type_promotion_display: string;
    quantite_requise: number;
    recompense_description: string;
  }[];
  // Hôtesses assignées à ce site — utilisé par l'écran de saisie manuelle
  // (Admin/Superviseur) pour choisir pour le compte de qui la saisie est faite.
  hotesses_disponibles: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Vente
// ---------------------------------------------------------------------------

export interface Vente {
  id: string;
  hotesse: string;
  hotesse_nom: string;
  site_nom: string;
  campagne_nom: string;
  entreprise_nom: string;
  entreprise_logo: string | null;
  entreprise_couleur_primaire: string;
  entreprise_couleur_secondaire: string;
  produit: string;
  produit_nom: string;
  conditionnement: TypeConditionnement;
  conditionnement_display: string;
  quantite: number;
  prix_total: string | null;
  type_vente: 'NORMAL' | 'GRATUIT' | 'PROMOTION';
  nom_client: string | null;
  tranche_age: TrancheAge | null;
  genre: Genre | null;
  note_gout: number | null;
  note_ambiance: number | null;
  est_achat_promo: boolean;
  created_at: string;
}

export interface VenteStats {
  total_ventes: number;
  total_unites_vendues: number;
  ventes_en_pack: number;
  ventes_a_lunite: number;
}

export interface GainGoodie {
  id: string;
  campagne_nom: string;
  site: string;
  site_nom: string;
  goodie: string;
  goodie_nom: string;
  hotesse: string | null;
  hotesse_nom: string;
  nom_client: string | null;
  created_at: string;
}

export interface JourAnimation {
  id: string;
  campagne: string;
  campagne_nom: string;
  site: string | null;
  site_nom: string | null;
  date: string;
  heure_ouverture: string;
  heure_fermeture: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Goodie
// ---------------------------------------------------------------------------

export interface Goodie {
  id: string;
  nom: string;
  description: string | null;
  campagne: string;
  campagne_nom: string;
  entreprise_nom: string;
  quantite_total: number;
  quantite_restante: number;
  quantite_distribuee: number;
  created_at: string;
}

export interface GoodieStockSite {
  site_id: string;
  site_nom: string;
  quantite_allouee: number;
  quantite_restante: number;
  quantite_distribuee: number;
}

export interface GoodieDetail extends Goodie {
  stocks_sites: GoodieStockSite[];
}

export interface CreateGoodiePayload {
  nom: string;
  description?: string;
  campagne: string;
  quantite_total: number;
}

export interface UpdateGoodiePayload {
  nom?: string;
  description?: string;
  quantite_total?: number;
}

export interface AllouerGoodiePayload {
  site_id: string;
  quantite: number;
}

// ---------------------------------------------------------------------------
// GainPromotion
// ---------------------------------------------------------------------------

export interface GainPromotion {
  id: string;
  promotion: string;
  promotion_description: string;
  type_promotion: TypePromotion;
  quantite_requise: number;
  quantite_offerte: number;
  conditionnement: TypeConditionnement;
  conditionnement_display: string;
  hotesse_nom: string;
  site_nom: string;
  campagne: string;
  quantite_produits_concernes: number;
  nom_client: string | null;
  vente_achat: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ObjectifSite
// ---------------------------------------------------------------------------

export interface ObjectifSite {
  id: string;
  site: string;
  site_nom: string;
  hotesse: string;
  hotesse_nom: string;
  date: string;
  objectif_degustations: number;
  objectif_ventes: number;
  created_at: string;
}

export interface CreateObjectifSitePayload {
  site: string;
  hotesse: string;
  date: string;
  objectif_degustations: number;
  objectif_ventes: number;
}

// ---------------------------------------------------------------------------
// RapportJournalier
// ---------------------------------------------------------------------------

export interface RapportJournalier {
  id: string;
  site: string;
  site_nom: string;
  hotesse: string;
  hotesse_nom: string;
  date: string;
  // Calculé automatiquement (Celery, chaque soir)
  nb_degustations: number;
  nb_ventes: number;
  nb_goodies: number;
  chiffre_affaires: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  // Saisi manuellement (superviseur / admin)
  stock_initial_magasin: number | null;
  nombre_personnes_touchees: number | null;
  avis_consommateurs: string | null;
  observation_generale: string | null;
  created_at: string;
}

export type RapportJournalierUpdatePayload = Partial<
  Pick<RapportJournalier, "stock_initial_magasin" | "nombre_personnes_touchees" | "avis_consommateurs" | "observation_generale">
>;

export interface RapportJournalierBulletin extends RapportJournalier {
  genre_breakdown: { hommes: number; femmes: number };
  tranche_age_breakdown: { tranche_age: string; label: string; quantite: number }[];
  notes_moyennes: { note_gout: number | null; note_ambiance: number | null };
  ugs_recus: { goodie: string; quantite: number }[];
  ugs_distribues: { goodie: string; quantite: number }[];
  ugs_restants: { goodie: string; quantite: number }[];
  ventes_hors_promo: number;
  ventes_promo_detail: {
    quantite_requise: number;
    quantite_offerte: number;
    occurrences: number;
    total_offert: number;
  }[];
  // Saisies par site/jour (indépendantes de l'hôtesse), voir DonneesSiteJour
  stock_boissons: number | null;
  nombre_boissons_gratuites: number | null;
  conditionnement_stock: string | null;
  conditionnement_gratuites: string | null;
}

// ---------------------------------------------------------------------------
// DonneesSiteJour
// ---------------------------------------------------------------------------

export interface DonneesSiteJour {
  id: string;
  site: string;
  site_nom: string;
  campagne: string;
  campagne_nom: string;
  date: string;
  conditionnement_stock: TypeConditionnement;
  conditionnement_stock_display: string;
  conditionnement_gratuites: TypeConditionnement;
  conditionnement_gratuites_display: string;
  stock_boissons: number | null;
  nombre_boissons_gratuites: number | null;
  quantite_gratuites_recue: number | null;
  est_report_gratuites: boolean;
  restants_gratuites_du_jour: number | null;
  enregistre_par: string | null;
  enregistre_par_nom: string | null;
  created_at: string;
}

export interface UpsertDonneesSiteJourPayload {
  site: string;
  date: string;
  conditionnement_stock?: TypeConditionnement;
  conditionnement_gratuites?: TypeConditionnement;
  stock_boissons?: number | null;
  nombre_boissons_gratuites?: number | null;
  quantite_gratuites_recue?: number | null;
}

// ---------------------------------------------------------------------------
// RapportJournalierConfig
// ---------------------------------------------------------------------------

export interface RapportJournalierConfig {
  id: string;
  campagne: string;
  configure_par: string | null;
  configure_par_nom: string | null;
  show_pointage: boolean;
  show_stock: boolean;
  show_stock_boissons: boolean;
  show_boissons_gratuites: boolean;
  show_ventes_detail: boolean;
  show_ugs_recus: boolean;
  show_ugs_distribues: boolean;
  show_ugs_restants: boolean;
  show_degustation: boolean;
  show_genre: boolean;
  show_tranche_age: boolean;
  show_notes_degustation: boolean;
  show_personnes_touchees: boolean;
  show_avis_consommateurs: boolean;
  show_observation_generale: boolean;
  created_at: string;
  updated_at: string;
}

export type RapportJournalierConfigPayload = Omit<
  RapportJournalierConfig, "id" | "campagne" | "configure_par" | "configure_par_nom" | "created_at" | "updated_at"
>;

export const DEFAULT_RAPPORT_JOURNALIER_CONFIG: RapportJournalierConfig = {
  id: "",
  campagne: "",
  configure_par: null,
  configure_par_nom: null,
  show_pointage: true,
  show_stock: true,
  show_stock_boissons: true,
  show_boissons_gratuites: true,
  show_ventes_detail: true,
  show_ugs_recus: true,
  show_ugs_distribues: true,
  show_ugs_restants: true,
  show_degustation: true,
  show_genre: true,
  show_tranche_age: true,
  show_notes_degustation: true,
  show_personnes_touchees: true,
  show_avis_consommateurs: true,
  show_observation_generale: true,
  created_at: "",
  updated_at: "",
};

// ---------------------------------------------------------------------------
// SiteProduitPrix
// ---------------------------------------------------------------------------

export interface SiteProduitPrix {
  id: string;
  site: string;
  site_nom: string;
  produit: string;
  produit_nom: string;
  prix: string;
  created_at: string;
}

export interface CreateSiteProduitPrixPayload {
  site: string;
  produit: string;
  prix: number;
}

// ---------------------------------------------------------------------------
// RapportConfig
// ---------------------------------------------------------------------------

export interface RapportConfig {
  id: string;
  campagne: string;
  configure_par: string | null;
  configure_par_nom: string | null;
  // En-tête
  titre_personnalise: string | null;
  sous_titre_personnalise: string | null;
  // KPIs
  show_kpi_degustations: boolean;
  show_kpi_ventes: boolean;
  show_kpi_ventes_hors_promo: boolean;
  show_kpi_ca: boolean;
  show_kpi_goodies: boolean;
  show_kpi_sites: boolean;
  show_kpi_personnes_touchees: boolean;
  // Sections
  show_section_offres_promo: boolean;
  show_section_gains_goodies: boolean;
  show_section_perf_hotesses: boolean;
  show_section_perf_sites: boolean;
  show_section_goodies_par_site: boolean;
  show_section_offres_par_hotesse: boolean;
  show_section_detail_degustations: boolean;
  show_section_horaires_sites: boolean;
  show_section_stock_boissons: boolean;
  show_section_ugs_livraisons: boolean;
  show_section_graphiques: boolean;
  // Colonnes
  show_col_ca: boolean;
  show_col_goodies: boolean;
  show_col_promo_details: boolean;
  show_col_performance: boolean;
  // Colonnes du détail des dégustations (formulaire hôtesse)
  show_col_nom_client: boolean;
  show_col_tranche_age: boolean;
  show_col_intention_achat: boolean;
  // Options générales
  show_logo: boolean;
  show_equipe_hotesses: boolean;
  inclure_notes_sensorielles: boolean;
  // Observations manuelles
  show_observations: boolean;
  observations_manuelles: string | null;
  created_at: string;
  updated_at: string;
}

export type RapportConfigPayload = Omit<RapportConfig, "id" | "campagne" | "configure_par" | "configure_par_nom" | "created_at" | "updated_at">;

export const DEFAULT_RAPPORT_CONFIG: RapportConfig = {
  id: "",
  campagne: "",
  configure_par: null,
  configure_par_nom: null,
  titre_personnalise: null,
  sous_titre_personnalise: null,
  show_kpi_degustations: true,
  show_kpi_ventes: true,
  show_kpi_ventes_hors_promo: true,
  show_kpi_ca: true,
  show_kpi_goodies: true,
  show_kpi_sites: true,
  show_kpi_personnes_touchees: true,
  show_section_offres_promo: true,
  show_section_gains_goodies: true,
  show_section_perf_hotesses: true,
  show_section_perf_sites: true,
  show_section_goodies_par_site: true,
  show_section_offres_par_hotesse: true,
  show_section_detail_degustations: false,
  show_section_horaires_sites: true,
  show_section_stock_boissons: true,
  show_section_ugs_livraisons: true,
  show_section_graphiques: true,
  show_col_ca: true,
  show_col_goodies: true,
  show_col_promo_details: true,
  show_col_performance: true,
  show_col_nom_client: true,
  show_col_tranche_age: true,
  show_col_intention_achat: true,
  show_logo: true,
  show_equipe_hotesses: true,
  inclure_notes_sensorielles: false,
  show_observations: true,
  observations_manuelles: null,
  created_at: "",
  updated_at: "",
};

// ---------------------------------------------------------------------------
// Pointage hôtesse
// ---------------------------------------------------------------------------

export interface Pointage {
  id: string;
  hotesse: string;
  hotesse_nom: string;
  site: string;
  site_nom: string;
  campagne: string;
  campagne_nom: string;
  jour: string | null;
  date: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  heure_ouverture_prevue: string | null;
  heure_fermeture_prevue: string | null;
  created_at: string;
}

export interface PointerPayload {
  site_id: string;
}

// ---------------------------------------------------------------------------
// Livraison goodies (jour)
// ---------------------------------------------------------------------------

export interface LivraisonGoodiesJour {
  id: string;
  site: string;
  site_nom: string;
  goodie: string;
  goodie_nom: string;
  campagne: string;
  campagne_nom: string;
  date: string;
  quantite_apportee: number;
  gains_du_jour: number;
  restants_du_jour: number;
  est_report: boolean;
  enregistre_par: string | null;
  enregistre_par_nom: string | null;
  created_at: string;
}

export interface CreateLivraisonGoodiesJourPayload {
  site: string;
  goodie: string;
  date: string;
  quantite_apportee: number;
}

// ---------------------------------------------------------------------------
// Campagnes Service (app "services" — promotion d'un service, pas d'un
// produit physique. Indépendant de Campagne/Produit, réutilise
// Entreprise/Site/RemoteUser de btl).
// ---------------------------------------------------------------------------

export type TypeCampagneService = "SONDAGE";

export interface CampagneServiceList {
  id: string;
  nom: string;
  entreprise: string;
  entreprise_nom: string;
  type_campagne_service: TypeCampagneService;
  type_campagne_service_display: string;
  description: string | null;
  date_debut: string;
  date_fin: string;
  campagne_produit_liee: string | null;
  campagne_produit_liee_nom: string | null;
  is_active: boolean;
  nb_sites: number;
  nb_hotesses: number;
  nb_superviseurs: number;
  created_at: string;
}

export interface CampagneServiceDetail extends Omit<CampagneServiceList, "nb_sites" | "nb_hotesses" | "nb_superviseurs"> {
  sites: string[];
  superviseurs: TeamMember[];
  hotesses: TeamMember[];
  // Services réellement disponibles pour cette campagne (sélection si
  // renseignée, sinon tous les services de l'entreprise).
  services: ServicePromu[];
}

export interface CreateCampagneServicePayload {
  nom: string;
  entreprise: string;
  type_campagne_service: TypeCampagneService;
  description?: string;
  date_debut: string;
  date_fin: string;
  sites?: string[];
  superviseurs?: string[];
  hotesses?: string[];
  // Vide = tous les services de l'entreprise sont disponibles.
  services?: string[];
  campagne_produit_liee?: string | null;
  is_active?: boolean;
}

export interface ServicePromu {
  id: string;
  entreprise: string;
  entreprise_nom: string;
  nom: string;
  description: string | null;
  created_at: string;
}

export interface ObjectifCampagneService {
  id: string;
  campagne_service: string;
  site: string | null;
  site_nom: string | null;
  nom: string;
  valeur_cible: number;
  created_at: string;
}

export interface RecompenseService {
  id: string;
  campagne_service: string;
  campagne_service_nom: string;
  nom: string;
  quantite_totale: number;
  quantite_distribuee: number;
  quantite_restante: number;
  created_at: string;
}

export interface GainRecompenseService {
  id: string;
  sondage: string | null;
  recompense: string;
  recompense_nom: string;
  site: string;
  site_nom: string;
  hotesse: string;
  hotesse_nom: string;
  nom_client: string | null;
  created_at: string;
}

export interface Sondage {
  id: string;
  campagne_service: string;
  campagne_service_nom: string;
  site: string;
  site_nom: string;
  hotesse: string;
  hotesse_nom: string;
  service: string;
  service_nom: string;
  nom_client: string | null;
  tranche_age: TrancheAge | null;
  tranche_age_display: string | null;
  genre: Genre | null;
  genre_display: string | null;
  possede_deja: boolean;
  a_souscrit: boolean;
  created_at: string;
}

export interface CreateSondagePayload {
  campagne_service: string;
  site: string;
  service: string;
  nom_client?: string;
  tranche_age?: TrancheAge;
  genre?: Genre;
  possede_deja: boolean;
  a_souscrit: boolean;
  hotesse_id?: string;
}

export interface MonSiteServiceInfo {
  site_id: string;
  site_nom: string;
  campagne_service_id: string;
  campagne_service_nom: string;
  type_campagne_service: TypeCampagneService;
  type_campagne_service_display: string;
  entreprise_nom: string;
  services: { id: string; nom: string }[];
  auto_select_service: boolean;
  recompenses_disponibles: { id: string; nom: string; quantite_restante: number }[];
  hotesses_disponibles: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// Pagination DRF standard
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
