"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/services/authService";
import { getCachedUser } from "@/lib/services/authService";
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
import { isAxiosError } from "axios";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success("Mot de passe mis à jour avec succès !");

      const user = getCachedUser();
      const dest =
        user?.role === "Hotesse"
          ? "/dashboard/campaigns"
          : user?.role === "Entreprise"
          ? "/dashboard/company"
          : "/dashboard";
      router.push(dest);
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        const data = err.response.data as Record<string, string[]>;
        const msg =
          data.old_password?.[0] ||
          data.new_password?.[0] ||
          data.detail ||
          "Erreur lors du changement de mot de passe.";
        toast.error(msg);
      } else {
        toast.error("Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">BTL FreshUp</h1>
          <p className="text-muted-foreground mt-2">Sécurité du compte</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <KeyRound className="w-5 h-5" />
              Changer votre mot de passe
            </CardTitle>
            <CardDescription className="text-center">
              Votre compte utilise un mot de passe provisoire.
              Vous devez le changer pour continuer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="old">Mot de passe provisoire</Label>
                <Input
                  id="old"
                  type="password"
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">Nouveau mot de passe</Label>
                <Input
                  id="new"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer le nouveau mot de passe"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
