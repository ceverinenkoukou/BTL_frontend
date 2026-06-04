import api from "@/lib/api";
import type {
  Degustation,
  CreateDegustationPayload,
  MonSiteInfo,
  PaginatedResponse,
} from "@/lib/types/backend";

/**
 * Récupère les infos du site pour la saisie (produits de l'entreprise + goodies).
 * À appeler en premier quand l'hôtesse ouvre le formulaire de dégustation.
 */
export async function getMonSiteInfo(siteId: string): Promise<MonSiteInfo> {
  const { data } = await api.get<MonSiteInfo>("/degustations/mon-site/", {
    params: { site_id: siteId },
  });
  return data;
}

export async function getDegustations(params?: {
  campagne_id?: string;
  site_id?: string;
}): Promise<PaginatedResponse<Degustation>> {
  const { data } = await api.get<PaginatedResponse<Degustation>>(
    "/degustations/",
    { params }
  );
  return data;
}

export async function getDegustation(id: string): Promise<Degustation> {
  const { data } = await api.get<Degustation>(`/degustations/${id}/`);
  return data;
}

/**
 * Crée une dégustation.
 * Si a_achete=true, la vente est créée automatiquement côté backend.
 * La réponse contient le champ `vente` avec les détails de la vente créée.
 */
export async function createDegustation(
  payload: CreateDegustationPayload
): Promise<Degustation> {
  const { data } = await api.post<Degustation>("/degustations/", payload);
  return data;
}
