"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">BTL FreshUp</h1>
          <p className="text-muted-foreground mt-2">Marketing Terrain</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Inscription</CardTitle>
            <CardDescription className="text-center">
              Les comptes sont créés par un administrateur BTL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              L&apos;accès à la plateforme BTL FreshUp est sur invitation uniquement.
              Votre responsable vous enverra vos identifiants par email.
            </p>
            <Button asChild className="w-full h-12 text-base">
              <Link href="/auth/login">Se connecter</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
