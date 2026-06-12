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
export type TypeConditionnement = "UNITE" | "PACK";

export type TypeCampagne = "DEGUSTATION" | "VENTE" | "DEGUSTATION_VENTE";
export type TypeRecompense = "AUCUNE" | "GOODIES" | "PROMOTIONS";
export type TypePromotion = "OFFERT" | "GAGNE";

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
  nb_sites: number;
  nb_hotesses: number;
  nb_superviseurs: number;
  created_at: string;
}

export interface Promotion {
  id: string;
  campagne: string;
  type_promotion: TypePromotion;
  type_promotion_display: string;
  quantite_requise: number;
  recompense_description: string;
  is_active: boolean;
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
  objectif_degustations?: number | null;
  objectif_ventes?: number | null;
}

export interface CreatePromotionPayload {
  campagne: string;
  type_promotion: TypePromotion;
  quantite_requise: number;
  recompense_description: string;
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
  campagne: string;
  campagne_nom: string;
  entreprise_nom: string;
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
  campagne: string;
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
  hotesse_nom: string;
  produit: string;
  produit_nom: string;
  nom_client: string | null;
  tranche_age: TrancheAge;
  tranche_age_display: string;
  note_gout: number;
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
  note_gout: number;
  intention_achat: IntentionAchat;
  a_achete: boolean;
  conditionnement?: TypeConditionnement;
  quantite?: number;
}

export interface MonSiteInfo {
  site_id: string;
  site_nom: string;
  campagne_id: string;
  campagne_nom: string;
  entreprise_nom: string;
  type_recompense: TypeRecompense;
  type_recompense_display: string;
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
}

// ---------------------------------------------------------------------------
// Vente
// ---------------------------------------------------------------------------

export interface Vente {
  id: string;
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
  created_at: string;
}

export interface VenteStats {
  total_ventes: number;
  total_unites_vendues: number;
  ventes_en_pack: number;
  ventes_a_lunite: number;
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
  hotesse_nom: string;
  site_nom: string;
  campagne: string;
  quantite_produits_concernes: number;
  nom_client: string | null;
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
  nb_degustations: number;
  nb_ventes: number;
  chiffre_affaires: string;
  email_envoye: boolean;
  created_at: string;
}

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
// Pagination DRF standard
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
