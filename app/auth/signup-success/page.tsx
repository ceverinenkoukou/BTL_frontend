import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Mail, TrendingUp } from "lucide-react";

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">BTL FreshUp</h1>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="text-2xl">Inscription réussie!</CardTitle>
            <CardDescription>
              Un email de confirmation a été envoyé à votre adresse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Vérifiez votre boîte mail</p>
                <p>
                  Cliquez sur le lien de confirmation dans l&apos;email pour activer votre compte 
                  et accéder à l&apos;application.
                </p>
              </div>
            </div>
            <Button asChild className="w-full h-12">
              <Link href="/auth/login">Retour à la connexion</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
