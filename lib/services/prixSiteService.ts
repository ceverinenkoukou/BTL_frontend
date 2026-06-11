import api from "@/lib/api";
import type { SiteProduitPrix, CreateSiteProduitPrixPayload, PaginatedResponse } from "@/lib/types/backend";

function unwrap<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PaginatedResponse<T>).results ?? [];
}

export async function getPrixSites(params?: {
  site?: string;
  produit?: string;
}): Promise<SiteProduitPrix[]> {
  const { data } = await api.get<SiteProduitPrix[] | PaginatedResponse<SiteProduitPrix>>(
    "/prix-sites/",
    { params }
  );
  return unwrap(data);
}

export async function createPrixSite(payload: CreateSiteProduitPrixPayload): Promise<SiteProduitPrix> {
  const { data } = await api.post<SiteProduitPrix>("/prix-sites/", payload);
  return data;
}

export async function updatePrixSite(
  id: string,
  payload: Partial<CreateSiteProduitPrixPayload>
): Promise<SiteProduitPrix> {
  const { data } = await api.patch<SiteProduitPrix>(`/prix-sites/${id}/`, payload);
  return data;
}

export async function deletePrixSite(id: string): Promise<void> {
  await api.delete(`/prix-sites/${id}/`);
}
