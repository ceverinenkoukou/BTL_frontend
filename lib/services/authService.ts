import api, { clearTokens, setTokens, TOKEN_KEYS } from "@/lib/api";
import type { RemoteUser, TokenPair } from "@/lib/types/backend";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  user: RemoteUser;
  tokens: TokenPair;
}

/**
 * Authentifie l'utilisateur, stocke les tokens et retourne le profil.
 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data: tokens } = await api.post<TokenPair>("/auth/login/", payload);
  setTokens(tokens.access, tokens.refresh);

  const { data: user } = await api.get<RemoteUser>("/users/me/");
  localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(user));

  return { user, tokens };
}

/**
 * Déconnecte l'utilisateur en blacklistant le refresh token côté serveur.
 */
export async function logout(): Promise<void> {
  const refresh = localStorage.getItem(TOKEN_KEYS.refresh);
  if (refresh) {
    try {
      await api.post("/auth/logout/", { refresh });
    } catch {
      // On nettoie quand même même si l'appel échoue
    }
  }
  clearTokens();
}

/**
 * Change le mot de passe (provisoire → définitif).
 * Met à jour le flag is_password_changed côté backend.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await api.post("/users/change-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  // Mettre à jour le user en cache
  const cached = localStorage.getItem(TOKEN_KEYS.user);
  if (cached) {
    const user: RemoteUser = JSON.parse(cached);
    user.is_password_changed = true;
    localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(user));
  }
}

/**
 * Retourne l'utilisateur connecté depuis le cache local.
 * Utile pour éviter un appel réseau à chaque render.
 */
export function getCachedUser(): RemoteUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKEN_KEYS.user);
  return raw ? (JSON.parse(raw) as RemoteUser) : null;
}

/**
 * Rafraîchit le profil depuis l'API et met à jour le cache.
 */
export async function refreshUserProfile(): Promise<RemoteUser> {
  const { data: user } = await api.get<RemoteUser>("/users/me/");
  localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(user));
  return user;
}
