import api from "@/lib/api";
import type { Promotion, PaginatedResponse } from "@/lib/types/backend";

/**
 * Récupère la liste des promotions (filtrable par campagne)
 */
export async function getPromotions(campagneId?: string): Promise<PaginatedResponse<Promotion>> {
  const { data } = await api.get<PaginatedResponse<Promotion>>("/promotions/", {
    params: campagneId ? { campagne: campagneId } : {},
  });
  return data;
}

/**
 * Enregistre un gain de promotion (quand une hôtesse déclenche une règle promo)
 */
export async function enregistrerGainPromotion(
  promotionId: string,
  payload: {
    site_id: string;
    nom_client?: string;
  }
): Promise<{
  detail: string;
  gain_id: string;
  recompense: string;
  quantite_produits_concernes: number;
}> {
  const { data } = await api.post<{
    detail: string;
    gain_id: string;
    recompense: string;
    quantite_produits_concernes: number;
  }>(`/promotions/${promotionId}/enregistrer-gain/`, payload);
  return data;
}
