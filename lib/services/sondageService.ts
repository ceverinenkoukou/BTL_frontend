import api from "@/lib/api";
import type { Sondage, CreateSondagePayload, MonSiteServiceInfo, PaginatedResponse } from "@/lib/types/backend";

export async function getSondages(): Promise<Sondage[]> {
  const { data } = await api.get<Sondage[] | PaginatedResponse<Sondage>>("/sondages/");
  return Array.isArray(data) ? data : data.results;
}

export async function createSondage(payload: CreateSondagePayload): Promise<Sondage> {
  const { data } = await api.post<Sondage>("/sondages/", payload);
  return data;
}

export async function getMonSiteService(siteId: string, campagneServiceId: string): Promise<MonSiteServiceInfo> {
  const { data } = await api.get<MonSiteServiceInfo>("/sondages/mon-site/", {
    params: { site_id: siteId, campagne_service_id: campagneServiceId },
  });
  return data;
}

export async function enregistrerGainRecompenseService(payload: {
  recompense_id: string;
  site_id: string;
  sondage_id?: string;
  nom_client?: string;
  hotesse_id?: string;
}): Promise<{ detail: string; stock_restant: number }> {
  const { data } = await api.post<{ detail: string; stock_restant: number }>(
    "/gains-recompenses-services/enregistrer/", payload
  );
  return data;
}
