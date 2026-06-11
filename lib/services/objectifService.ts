import api from "@/lib/api";
import type { ObjectifSite, CreateObjectifSitePayload, PaginatedResponse } from "@/lib/types/backend";

function unwrap<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PaginatedResponse<T>).results ?? [];
}

export async function getObjectifs(params?: {
  site?: string;
  hotesse?: string;
  date?: string;
}): Promise<ObjectifSite[]> {
  const { data } = await api.get<ObjectifSite[] | PaginatedResponse<ObjectifSite>>(
    "/objectifs-sites/",
    { params }
  );
  return unwrap(data);
}

export async function createObjectif(payload: CreateObjectifSitePayload): Promise<ObjectifSite> {
  const { data } = await api.post<ObjectifSite>("/objectifs-sites/", payload);
  return data;
}

export async function updateObjectif(
  id: string,
  payload: Partial<CreateObjectifSitePayload>
): Promise<ObjectifSite> {
  const { data } = await api.patch<ObjectifSite>(`/objectifs-sites/${id}/`, payload);
  return data;
}

export async function deleteObjectif(id: string): Promise<void> {
  await api.delete(`/objectifs-sites/${id}/`);
}

export async function genererObjectifsCampagne(
  campagneId: string,
  date?: string
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(
    `/campagnes/${campagneId}/generer-objectifs/`,
    date ? { date } : {}
  );
  return data;
}
