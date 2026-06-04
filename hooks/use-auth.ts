"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  login as apiLogin,
  logout as apiLogout,
  getCachedUser,
  refreshUserProfile,
  type LoginPayload,
} from "@/lib/services/authService";
import type { RemoteUser } from "@/lib/types/backend";
import { getAccessToken } from "@/lib/api";

interface AuthState {
  user: RemoteUser | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  // Initialise depuis le cache au montage
  useEffect(() => {
    const token = getAccessToken();
    const cached = getCachedUser();
    if (token && cached) {
      setState({ user: cached, loading: false, isAuthenticated: true });
    } else {
      setState({ user: null, loading: false, isAuthenticated: false });
    }
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const { user } = await apiLogin(payload);
      setState({ user, loading: false, isAuthenticated: true });

      // Redirection selon le rôle + vérification mot de passe provisoire
      if (!user.is_password_changed) {
        router.push("/auth/change-password");
        return user;
      }

      const dest =
        user.role === "Hotesse"
          ? "/dashboard/campaigns"
          : user.role === "Entreprise"
          ? "/dashboard/company"
          : "/dashboard";
      router.push(dest);
      return user;
    },
    [router]
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, loading: false, isAuthenticated: false });
    router.push("/auth/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const user = await refreshUserProfile();
      setState((prev) => ({ ...prev, user }));
      return user;
    } catch {
      return null;
    }
  }, []);

  return {
    ...state,
    login,
    logout,
    refreshUser,
  };
}
