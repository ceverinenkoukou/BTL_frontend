import api from "@/lib/api";
import type {
  SiteList,
  SiteDetail,
  CreateSitePayload,
  ManageTeamPayload,
  PaginatedResponse,
} from "@/lib/types/backend";

export async function getSites(campagneId?: string): Promise<PaginatedResponse<SiteList>> {
  const params = campagneId ? { campagne: campagneId } : {};
  const { data } = await api.get<PaginatedResponse<SiteList>>("/sites/", { params });
  return data;
}

export async function getSite(id: string): Promise<SiteDetail> {
  const { data } = await api.get<SiteDetail>(`/sites/${id}/`);
  return data;
}

export async function createSite(payload: CreateSitePayload): Promise<SiteDetail> {
  const { data } = await api.post<SiteDetail>("/sites/", payload);
  return data;
}

export async function updateSite(
  id: string,
  payload: Partial<CreateSitePayload>
): Promise<SiteDetail> {
  const { data } = await api.patch<SiteDetail>(`/sites/${id}/`, payload);
  return data;
}

export async function deleteSite(id: string): Promise<void> {
  await api.delete(`/sites/${id}/`);
}

/**
 * Assigne (ou remplace) l'équipe d'un site spécifique.
 * Si notify=true, un email est envoyé aux nouveaux membres avec les détails campagne + site.
 */
export async function manageSiteTeam(
  id: string,
  payload: ManageTeamPayload
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(
    `/sites/${id}/manage-team/`,
    payload
  );
  return data;
}
