import api from "@/lib/api";
import type {
  CampagneList,
  CampagneDetail,
  CreateCampagnePayload,
  ManageTeamPayload,
  PaginatedResponse,
} from "@/lib/types/backend";

export async function getCampagnes(): Promise<PaginatedResponse<CampagneList>> {
  const { data } = await api.get<PaginatedResponse<CampagneList>>("/campagnes/");
  return data;
}

export async function getCampagne(id: string): Promise<CampagneDetail> {
  const { data } = await api.get<CampagneDetail>(`/campagnes/${id}/`);
  return data;
}

export async function createCampagne(
  payload: CreateCampagnePayload
): Promise<CampagneDetail> {
  const { data } = await api.post<CampagneDetail>("/campagnes/", payload);
  return data;
}

export async function updateCampagne(
  id: string,
  payload: Partial<CreateCampagnePayload>
): Promise<CampagneDetail> {
  const { data } = await api.patch<CampagneDetail>(`/campagnes/${id}/`, payload);
  return data;
}

export async function deleteCampagne(id: string): Promise<void> {
  await api.delete(`/campagnes/${id}/`);
}

/**
 * Assigne (ou remplace) l'équipe d'une campagne.
 * Si notify=true, un email est envoyé aux nouveaux membres.
 */
export async function manageCampagneTeam(
  id: string,
  payload: ManageTeamPayload
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(
    `/campagnes/${id}/manage-team/`,
    payload
  );
  return data;
}
