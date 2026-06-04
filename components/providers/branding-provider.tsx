"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { buildCssVars, type BrandingConfig } from "@/lib/utils/branding";
import { getCachedUser } from "@/lib/services/authService";
import { getEntreprise, getMyEntreprise } from "@/lib/services/entrepriseService";
import type { Entreprise } from "@/lib/types/backend";

interface BrandingContextType {
  branding: BrandingConfig | null;
  setBranding: (config: BrandingConfig | null) => void;
  loadBrandingForEntreprise: (id: string) => Promise<void>;
}

const DEFAULT_BRANDING: BrandingConfig = {
  couleur_primaire: "#006776",
  couleur_secondaire: "#00899b",
  logo_url: null,
  nom_commercial: "Mhedia BTL",
};

const BrandingContext = createContext<BrandingContextType>({
  branding: null,
  setBranding: () => {},
  loadBrandingForEntreprise: async () => {},
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  const loadBrandingForEntreprise = useCallback(async (id: string) => {
    try {
      const entreprise: Entreprise = await getEntreprise(id);
      setBranding({
        couleur_primaire: entreprise.couleur_primaire,
        couleur_secondaire: entreprise.couleur_secondaire,
        logo_url: entreprise.logo_url,
        nom_commercial: entreprise.nom_commercial,
      });
    } catch {
      setBranding(DEFAULT_BRANDING);
    }
  }, []);

  // Au montage : si l'utilisateur est une Entreprise, charger son propre branding
  useEffect(() => {
    const user = getCachedUser();
    if (!user) return;

    if (user.role === "Entreprise") {
      getMyEntreprise()
        .then((entreprise) => {
          if (entreprise) {
            setBranding({
              couleur_primaire: entreprise.couleur_primaire,
              couleur_secondaire: entreprise.couleur_secondaire,
              logo_url: entreprise.logo_url,
              nom_commercial: entreprise.nom_commercial,
            });
          } else {
            setBranding(DEFAULT_BRANDING);
          }
        })
        .catch(() => setBranding(DEFAULT_BRANDING));
    }
  }, []);

  const cssVars = branding ? buildCssVars(branding) : {};

  return (
    <BrandingContext.Provider
      value={{ branding, setBranding, loadBrandingForEntreprise }}
    >
      <div style={cssVars} className="contents">
        {children}
      </div>
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
