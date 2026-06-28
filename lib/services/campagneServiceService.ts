import api from "@/lib/api";
import type {
  CampagneServiceList, CampagneServiceDetail, CreateCampagneServicePayload,
  ServicePromu, ObjectifCampagneService, RecompenseService, PaginatedResponse,
} from "@/lib/types/backend";

export async function getCampagnesServices(): Promise<CampagneServiceList[]> {
  const { data } = await api.get<CampagneServiceList[] | PaginatedResponse<CampagneServiceList>>("/campagnes-services/");
  return Array.isArray(data) ? data : data.results;
}

export async function getCampagneService(id: string): Promise<CampagneServiceDetail> {
  const { data } = await api.get<CampagneServiceDetail>(`/campagnes-services/${id}/`);
  return data;
}

export async function createCampagneService(payload: CreateCampagneServicePayload): Promise<CampagneServiceDetail> {
  const { data } = await api.post<CampagneServiceDetail>("/campagnes-services/", payload);
  return data;
}

export async function updateCampagneService(id: string, payload: Partial<CreateCampagneServicePayload>): Promise<CampagneServiceDetail> {
  const { data } = await api.patch<CampagneServiceDetail>(`/campagnes-services/${id}/`, payload);
  return data;
}

export async function deleteCampagneService(id: string): Promise<void> {
  await api.delete(`/campagnes-services/${id}/`);
}

export async function getServicesEntreprise(entrepriseId: string): Promise<ServicePromu[]> {
  const { data } = await api.get<ServicePromu[] | PaginatedResponse<ServicePromu>>("/services-promus/", {
    params: { entreprise: entrepriseId },
  });
  return Array.isArray(data) ? data : data.results;
}

export async function createServicePromu(payload: { entreprise: string; nom: string; description?: string }): Promise<ServicePromu> {
  const { data } = await api.post<ServicePromu>("/services-promus/", payload);
  return data;
}

export async function deleteServicePromu(id: string): Promise<void> {
  await api.delete(`/services-promus/${id}/`);
}

export async function getObjectifsCampagneService(campagneServiceId: string): Promise<ObjectifCampagneService[]> {
  const { data } = await api.get<ObjectifCampagneService[] | PaginatedResponse<ObjectifCampagneService>>(
    "/objectifs-campagnes-services/", { params: { campagne_service: campagneServiceId } }
  );
  return Array.isArray(data) ? data : data.results;
}

export async function createObjectifCampagneService(payload: {
  campagne_service: string; site?: string; nom: string; valeur_cible: number;
}): Promise<ObjectifCampagneService> {
  const { data } = await api.post<ObjectifCampagneService>("/objectifs-campagnes-services/", payload);
  return data;
}

export async function deleteObjectifCampagneService(id: string): Promise<void> {
  await api.delete(`/objectifs-campagnes-services/${id}/`);
}

export async function getRecompensesService(campagneServiceId: string): Promise<RecompenseService[]> {
  const { data } = await api.get<RecompenseService[] | PaginatedResponse<RecompenseService>>(
    "/recompenses-services/", { params: { campagne_service: campagneServiceId } }
  );
  return Array.isArray(data) ? data : data.results;
}

export async function createRecompenseService(payload: {
  campagne_service: string; nom: string; quantite_totale: number;
}): Promise<RecompenseService> {
  const { data } = await api.post<RecompenseService>("/recompenses-services/", payload);
  return data;
}

export async function deleteRecompenseService(id: string): Promise<void> {
  await api.delete(`/recompenses-services/${id}/`);
}
