import api from "@/lib/api";
import type {
  Goodie,
  GoodieDetail,
  CreateGoodiePayload,
  UpdateGoodiePayload,
  AllouerGoodiePayload,
  PaginatedResponse,
} from "@/lib/types/backend";

export async function getGoodies(campagneId?: string): Promise<PaginatedResponse<Goodie>> {
  const params = campagneId ? { campagne: campagneId } : {};
  const { data } = await api.get<PaginatedResponse<Goodie>>("/goodies/", { params });
  return data;
}

export async function getGoodie(id: string): Promise<GoodieDetail> {
  const { data } = await api.get<GoodieDetail>(`/goodies/${id}/`);
  return data;
}

export async function createGoodie(payload: CreateGoodiePayload): Promise<Goodie> {
  const { data } = await api.post<Goodie>("/goodies/", payload);
  return data;
}

export async function updateGoodie(
  id: string,
  payload: UpdateGoodiePayload
): Promise<Goodie> {
  const { data } = await api.patch<Goodie>(`/goodies/${id}/`, payload);
  return data;
}

export async function deleteGoodie(id: string): Promise<void> {
  await api.delete(`/goodies/${id}/`);
}

export async function allouerGoodie(
  goodieId: string,
  payload: AllouerGoodiePayload
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(`/goodies/${goodieId}/allouer/`, payload);
  return data;
}

export async function getGoodiesByCampagne(campagneId: string): Promise<Goodie[]> {
  const { data } = await api.get<PaginatedResponse<Goodie>>("/goodies/", { params: { campagne: campagneId } });
  return data.results ?? (data as unknown as Goodie[]);
}
