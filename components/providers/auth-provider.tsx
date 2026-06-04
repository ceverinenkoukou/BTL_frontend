"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RemoteUser } from "@/lib/types/backend";
import {
  getCachedUser,
  logout as apiLogout,
  refreshUserProfile,
} from "@/lib/services/authService";
import { getAccessToken } from "@/lib/api";

interface AuthContextType {
  user: RemoteUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<RemoteUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const token = getAccessToken();
      if (!token) { setUser(null); return; }

      const cached = getCachedUser();
      if (cached) {
        setUser(cached);
      } else {
        const fresh = await refreshUserProfile();
        setUser(fresh);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await apiLogout();
    setUser(null);
    router.replace("/auth/login");
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
