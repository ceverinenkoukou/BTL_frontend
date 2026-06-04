import api from "@/lib/api";
import type { RemoteUser, PaginatedResponse } from "@/lib/types/backend";

export interface CreateUserPayload {
  email: string;
  name: string;
  role: "Hotesse" | "Superviseur";
  username?: string;
}

export async function getUsers(): Promise<PaginatedResponse<RemoteUser>> {
  const { data } = await api.get<PaginatedResponse<RemoteUser>>("/users/");
  return data;
}

export async function getUser(id: string): Promise<RemoteUser> {
  const { data } = await api.get<RemoteUser>(`/users/${id}/`);
  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<RemoteUser> {
  const { data } = await api.post<RemoteUser>("/users/", payload);
  return data;
}

export async function updateUser(
  id: string,
  payload: Partial<RemoteUser>
): Promise<RemoteUser> {
  const { data } = await api.patch<RemoteUser>(`/users/${id}/`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}/`);
}

export async function getTerrainStaff(): Promise<RemoteUser[]> {
  const { data } = await api.get<RemoteUser[]>("/users/terrain-staff/");
  return data;
}
