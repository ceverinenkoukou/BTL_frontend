/**
 * Utilitaires de branding dynamique.
 * Convertit une couleur HEX en variables CSS compatibles avec le thème Tailwind.
 */

/** Décompose un hex (#RRGGBB) en [r, g, b] 0-255 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Calcule la luminance relative (WCAG) */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Retourne '#ffffff' ou '#000000' selon le contraste optimal avec la couleur donnée.
 */
export function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = relativeLuminance(r, g, b);
  return lum > 0.179 ? "#000000" : "#ffffff";
}

/**
 * Éclaircit ou assombrit un hex d'un pourcentage (-100 à +100).
 * Positif = plus clair, négatif = plus sombre.
 */
export function adjustBrightness(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const adj = (c: number) => clamp(Math.round(c + (255 - c) * (percent / 100)));
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
}

export interface BrandingConfig {
  couleur_primaire: string;
  couleur_secondaire: string;
  logo_url?: string | null;
  nom_commercial?: string;
}

/**
 * Génère un objet de CSS variables à appliquer en `style` sur un wrapper.
 * Surcharge les variables Tailwind --primary, --ring, --sidebar-primary, etc.
 */
export function buildCssVars(
  branding: BrandingConfig
): React.CSSProperties & Record<string, string> {
  const primary = branding.couleur_primaire || "#6366f1";
  const secondary = branding.couleur_secondaire || "#8b5cf6";
  const primaryFg = contrastColor(primary);
  const secondaryFg = contrastColor(secondary);
  const primaryLight = adjustBrightness(primary, 40);

  return {
    "--primary": primary,
    "--primary-foreground": primaryFg,
    "--ring": primary,
    "--accent": secondary,
    "--accent-foreground": secondaryFg,
    "--chart-1": primary,
    "--chart-2": secondary,
    "--brand-primary": primary,
    "--brand-secondary": secondary,
    "--brand-primary-light": primaryLight,
  } as React.CSSProperties & Record<string, string>;
}
