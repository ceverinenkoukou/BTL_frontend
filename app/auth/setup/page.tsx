"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios, { isAxiosError } from "axios";
import api, { getAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8003/api";

export default function SetupPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isFirstSetup, setIsFirstSetup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/auth/setup/`)
      .then(({ data }) => {
        setIsFirstSetup(data.setup_required);
        setChecking(false);
      })
      .catch(() => {
        toast.error("Impossible de contacter le serveur.");
        setChecking(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const isAuthenticated = !!getAccessToken();
    const client = isAuthenticated ? api : axios.create({ baseURL: API_URL });

    try {
      // CORRECTION : On passe uniquement le chemin relatif car la baseURL est déjà configurée dans l'instance du client
      const { data } = await client.post("/auth/setup/", {
        name,
        email,
        password,
      });
      toast.success(data.detail);
      setName("");
      setEmail("");
      setPassword("");
      if (isFirstSetup) router.push("/auth/login");
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          toast.error("Vous devez être connecté en tant qu'administrateur.");
        } else {
          toast.error(err.response?.data?.detail ?? "Une erreur est survenue.");
        }
      } else {
        toast.error("Erreur inconnue.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-[#006776] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[#006776]/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">
            Mhedia BTL
          </h1>
          <p className="text-muted-foreground mt-2">
            {isFirstSetup ? "Configuration initiale" : "Gestion des administrateurs"}
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Créer un administrateur
            </CardTitle>
            <CardDescription className="text-center">
              {isFirstSetup
                ? "Aucun administrateur n'existe encore. Créez le premier compte."
                : "Vous devez être connecté en tant qu'administrateur pour ajouter un nouveau compte."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex : Marie Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 pr-12"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base bg-[#006776] hover:bg-[#005a66]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer l'administrateur"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {isFirstSetup
            ? "Cette page sera protégée après la création du premier compte."
            : "Accessible uniquement aux administrateurs connectés."}
        </p>
      </div>
    </div>
  );
}