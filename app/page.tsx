import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Users, 
  BarChart3, 
  Target,
  ArrowRight,
  CheckCircle2,
  Smartphone
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center">
            <img src="/LOGO-MHEDIA-01.svg" alt="Mhedia BTL" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Connexion</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Commencer</Link>
            </Button>
          </div>
        </nav>

        <div className="relative z-10 px-6 py-20 md:py-32 max-w-7xl mx-auto">
          <div className="max-w-3xl">
            {/* <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Smartphone className="w-4 h-4" />
              Application PWA - Fonctionne hors ligne
            </div> */}
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight text-balance">
              Gérez vos campagnes <span className="text-primary">BTL</span> en temps réel
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl text-pretty">
              Suivi instantané des dégustations, ventes et performances. 
              Optimisez vos actions terrain avec des données précises et exploitables.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-14 px-8 text-base" asChild>
                <Link href="/auth/signup">
                  Démarrer gratuitement
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base" asChild>
                <Link href="/auth/login">
                  Se connecter
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Tout ce dont vous avez besoin
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Une solution complète pour gérer vos équipes terrain et suivre vos performances
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Target className="w-6 h-6" />}
              title="Suivi des campagnes"
              description="Créez et gérez vos campagnes avec objectifs, équipes et zones assignées"
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="Gestion des équipes"
              description="Assignez hôtesses et superviseurs, suivez leurs performances en direct"
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6" />}
              title="Statistiques temps réel"
              description="Visualisez conversions, ventes et dégustations avec des graphiques détaillés"
            />
            <FeatureCard 
              icon={<TrendingUp className="w-6 h-6" />}
              title="Rapports exportables"
              description="Exportez vos données en Excel pour analyses approfondies"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Optimisez chaque interaction terrain
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Notre plateforme vous permet de capturer chaque donnée importante 
                et de transformer vos campagnes en succès mesurables.
              </p>
              <ul className="mt-8 space-y-4">
                <BenefitItem text="Saisie rapide des dégustations avec profil client" />
                <BenefitItem text="Conversion automatique dégustation vers vente" />
                <BenefitItem text="Roue interactive pour fidéliser les clients" />
                <BenefitItem text="Tableau de bord par rôle (admin, superviseur, hôtesse)" />
                <BenefitItem text="Import/export Excel pour produits et équipes" />
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8 lg:p-12">
              <div className="grid grid-cols-2 gap-4">
                <StatCard value="98%" label="Taux de saisie" />
                <StatCard value="+45%" label="Conversion" />
                <StatCard value="2min" label="Temps moyen" />
                <StatCard value="24/7" label="Disponibilité" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
            Prêt à transformer vos campagnes?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Rejoignez les équipes qui utilisent Mhedia BTL pour maximiser leur impact terrain
          </p>
          <Button size="lg" variant="secondary" className="mt-8 h-14 px-8 text-base" asChild>
            <Link href="/auth/signup">
              Créer un compte gratuit
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/LOGO-MHEDIA-01.svg" alt="Mhedia BTL" className="h-10 w-auto" />
          </div>
          <p className="text-sm text-muted-foreground">
            2024 Mhedia BTL. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-2xl p-6 border border-border hover:border-primary/30 transition-colors">
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
      <span className="text-foreground">{text}</span>
    </li>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card rounded-xl p-6 text-center">
      <div className="text-3xl font-bold text-primary">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
