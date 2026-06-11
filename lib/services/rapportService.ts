import api from "@/lib/api";
import type { RapportJournalier, PaginatedResponse } from "@/lib/types/backend";

function unwrap<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PaginatedResponse<T>).results ?? [];
}

export async function getRapports(params?: {
  site?: string;
  hotesse?: string;
  date?: string;
}): Promise<RapportJournalier[]> {
  const { data } = await api.get<RapportJournalier[] | PaginatedResponse<RapportJournalier>>(
    "/rapports-journaliers/",
    { params }
  );
  return unwrap(data);
}

export async function genererRapports(date?: string): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>(
    "/rapports-journaliers/generer/",
    date ? { date } : {}
  );
  return data;
}
