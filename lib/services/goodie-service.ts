/**
 * Utilitaire pour gérer les gains de goodies via la roue de la fortune
 * 
 * Intégration avec l'API /api/gains-goodies/enregistrer/
 */

import { api } from "./api";

export interface Goodie {
  id: string;
  nom: string;
  description?: string;
  campagne: string;
  produit_associe?: string;
  produit_associe_nom?: string;
  quantite_produit_associe: number;
  quantite_total: number;
  quantite_restante: number;
  quantite_distribuee: number;
}

export interface ProduitAssocieSummary {
  nom: string | null;
  quantite_remise: number;
}

export interface GainGoodieResponse {
  detail: string;
  gain: {
    id: string;
    goodie: string;
    goodie_nom: string;
    site: string;
    site_nom: string;
    produit_associe?: string;
    produit_nom?: string;
    quantite_produit: number;
    nom_client?: string;
    created_at: string;
  };
  stock_restant: number;
  produit_associe?: ProduitAssocieSummary;
}

export interface EnregistrerGainPayload {
  goodie_id: string;
  site_id: string;
  nom_client?: string;
  quantite_produit?: number;
}

/**
 * Enregistre un gain de goodie via la roue de la fortune
 * 
 * @param payload - Les données du gain à enregistrer
 * @returns La réponse du serveur avec les détails du gain
 * @throws Une erreur si l'enregistrement échoue
 * 
 * Exemple d'utilisation:
 * ```typescript
 * try {
 *   const response = await enregistrerGainGoodie({
 *     goodie_id: goodie.id,
 *     site_id: site.id,
 *     nom_client: "Jean Dupont",
 *     quantite_produit: 1
 *   });
 *   
 *   console.log(response.detail); // "Goodie 'T-shirt' remporté avec succès."
 *   console.log(response.stock_restant); // Nombre de goodies restants
 *   console.log(response.produit_associe); // Produit remis (ex: Canette)
 * } catch (error) {
 *   console.error("Erreur lors de l'enregistrement du gain:", error);
 * }
 * ```
 */
export async function enregistrerGainGoodie(
  payload: EnregistrerGainPayload
): Promise<GainGoodieResponse> {
  try {
    const response = await api.post<GainGoodieResponse>(
      "/gains-goodies/enregistrer/",
      payload
    );
    return response.data;
  } catch (error) {
    console.error("Erreur API:", error);
    throw error;
  }
}

/**
 * Récupère les goodies d'une campagne avec leurs produits associés
 * 
 * @param campagneId - L'ID de la campagne
 * @returns Liste des goodies avec leurs détails
 */
export async function fetchGoodiesByCampagne(campagneId: string): Promise<Goodie[]> {
  try {
    const response = await api.get<Goodie[]>("/goodies/", {
      params: { campagne: campagneId }
    });
    
    // Gérer les réponses paginées
    if (Array.isArray(response.data)) {
      return response.data;
    } else if ((response.data as any).results) {
      return (response.data as any).results;
    }
    return [];
  } catch (error) {
    console.error("Erreur lors du chargement des goodies:", error);
    throw error;
  }
}

/**
 * Formatte un goodie pour l'affichage dans la roue
 * Inclut le produit associé dans le label si disponible
 * 
 * @param goodie - Le goodie à formater
 * @returns Un label formaté pour la roue
 */
export function formatGoodieLabel(goodie: Goodie): string {
  if (!goodie.produit_associe_nom) {
    return goodie.nom;
  }
  
  // Ex: "T-shirt + Canette" ou "T-shirt + 2x Canette"
  const quantiteStr = goodie.quantite_produit_associe > 1 
    ? `${goodie.quantite_produit_associe}x ` 
    : "";
  
  return `${goodie.nom} + ${quantiteStr}${goodie.produit_associe_nom}`;
}

/**
 * Crée un résumé du gain pour affichage
 * 
 * @param response - La réponse du serveur
 * @returns Un résumé formaté
 */
export function createGainSummary(response: GainGoodieResponse): string {
  let summary = `🎁 ${response.gain.goodie_nom}`;
  
  if (response.produit_associe?.nom) {
    summary += ` + ${response.produit_associe.quantite_remise}x ${response.produit_associe.nom}`;
  }
  
  if (response.gain.nom_client) {
    summary += ` (pour ${response.gain.nom_client})`;
  }
  
  return summary;
}
