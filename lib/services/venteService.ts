import api from "@/lib/api";
import type { Vente, VenteStats, PaginatedResponse, TypeConditionnement } from "@/lib/types/backend";

export async function getVentes(params?: {
  campagne_id?: string;
  site_id?: string;
}): Promise<PaginatedResponse<Vente>> {
  const { data } = await api.get<PaginatedResponse<Vente>>("/ventes/", {
    params,
  });
  return data;
}

export async function getVente(id: string): Promise<Vente> {
  const { data } = await api.get<Vente>(`/ventes/${id}/`);
  return data;
}

export async function getVenteStats(params?: {
  campagne_id?: string;
  site_id?: string;
}): Promise<VenteStats> {
  const { data } = await api.get<VenteStats>("/ventes/stats/", { params });
  return data;
}

/**
 * Crée une vente directe (sans dégustation, sans promo) — réservé aux
 * campagnes de type VENTE sans mécanique promotionnelle.
 */
export async function creerVenteDirecte(payload: {
  site_id: string;
  produit_id: string;
  conditionnement: TypeConditionnement;
  quantite: number;
  nom_client?: string;
  // Requis uniquement pour une saisie manuelle par un Admin/Superviseur
  // pour le compte d'une hôtesse.
  hotesse_id?: string;
}): Promise<Vente> {
  const { data } = await api.post<Vente>("/ventes/creer-directe/", payload);
  return data;
}
