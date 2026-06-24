"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Persiste une valeur de filtre (Select, date...) dans le query string de l'URL,
 * pour que les filtres survivent à un rafraîchissement ou un partage de lien.
 * Ne pas utiliser pour des champs de recherche texte saisis en direct (trop de
 * réécritures d'URL par frappe) — réservé aux filtres discrets (Select, date).
 */
export function useUrlState(key: string, defaultValue: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!v || v === defaultValue) params.delete(key);
    else params.set(key, v);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return [value, setValue] as const;
}
