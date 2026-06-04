import api from "@/lib/api";
import type {
  Entreprise,
  CreateEntreprisePayload,
  CampagneList,
  PaginatedResponse,
} from "@/lib/types/backend";

export type EntrepriseListResponse = Entreprise[] | PaginatedResponse<Entreprise> | Entreprise;

/** Extrait la première entreprise d'une réponse liste (tableau ou pagination DRF). */
export function firstEntrepriseFromList(data: EntrepriseListResponse): Entreprise | null {
  if (Array.isArray(data)) return data[0] ?? null;
  if (data && typeof data === "object" && "results" in data && Array.isArray(data.results)) {
    return data.results[0] ?? null;
  }
  if (data && typeof data === "object" && "id" in data) return data as Entreprise;
  return null;
}

export async function getEntreprises(): Promise<PaginatedResponse<Entreprise>> {
  const { data } = await api.get<PaginatedResponse<Entreprise>>("/entreprises/");
  return data;
}

/** Profil de l'entreprise connectée (rôle Entreprise). */
export async function getMyEntreprise(): Promise<Entreprise | null> {
  const { data } = await api.get<EntrepriseListResponse>("/entreprises/");
  return firstEntrepriseFromList(data);
}

export async function getEntreprise(id: string): Promise<Entreprise> {
  const { data } = await api.get<Entreprise>(`/entreprises/${id}/`);
  return data;
}

export async function createEntreprise(
  payload: CreateEntreprisePayload
): Promise<Entreprise> {
  const { data } = await api.post<Entreprise>("/entreprises/", payload);
  return data;
}

export async function updateEntreprise(
  id: string,
  payload: Partial<CreateEntreprisePayload>
): Promise<Entreprise> {
  const { data } = await api.patch<Entreprise>(`/entreprises/${id}/`, payload);
  return data;
}

export async function deleteEntreprise(id: string): Promise<void> {
  await api.delete(`/entreprises/${id}/`);
}

export async function getCampagnesEntreprise(
  id: string
): Promise<CampagneList[]> {
  const { data } = await api.get<CampagneList[]>(`/entreprises/${id}/campagnes/`);
  return data;
}
