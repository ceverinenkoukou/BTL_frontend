import api from "@/lib/api";
import type { Vente, VenteStats, PaginatedResponse } from "@/lib/types/backend";

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
