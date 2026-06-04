"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, TrendingUp } from "lucide-react";
import { isAxiosError } from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login({ email, password });
      toast.success("Connexion réussie !");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        toast.error("Email ou mot de passe incorrect.");
      } else {
        toast.error("Une erreur est survenue. Vérifiez que le serveur est démarré.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-[#006776] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[#006776]/30">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">Mhedia BTL</h1>
          <p className="text-muted-foreground mt-2">Agence Marketing Terrain</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Connexion</CardTitle>
            <CardDescription className="text-center">
              Entrez vos identifiants pour accéder à votre espace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Pas encore de compte? </span>
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                {"S'inscrire"}
              </Link>
            </div>

            {/* <div className="mt-6 border-t pt-4">
              <p className="text-xs text-muted-foreground text-center mb-3 font-medium uppercase tracking-wide">Comptes de démonstration</p>
              <div className="space-y-2">
                {[
                  { label: "🛡️ Admin",           email: "admin@example.com" },
                  { label: "🍺 33 Export (Sobraga)", email: "sobraga@33export.ga" },
                  { label: "👁️ Superviseur",       email: "supervisor@example.com" },
                  { label: "💃 Hôtesse",           email: "hostess@example.com" },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword("demo"); }}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium">{acc.label}</span>
                    <span className="text-muted-foreground font-mono">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
