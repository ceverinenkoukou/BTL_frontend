"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Target,
  UtensilsCrossed,
  ShoppingCart,
  BarChart3,
  FileText,
  Gift,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Tag,
  Download,
  Wifi,
  WifiOff,
  ClipboardEdit,
  Headset,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import type { CampagneList } from "@/lib/types/backend";
import { HostessBottomNav } from "@/components/dashboard/bottom-nav";


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/company", label: "Mon tableau de bord", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["Entreprise"] },
  { href: "/dashboard/campaigns", label: "Campagnes", icon: <Target className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/tastings", label: "Dégustations", icon: <UtensilsCrossed className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/saisie-manuelle", label: "Saisie manuelle", icon: <ClipboardEdit className="w-5 h-5" />, roles: ["Administrateur", "Superviseur"] },
  { href: "/dashboard/campagnes-services", label: "Campagnes service", icon: <Headset className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/sondages", label: "Sondages", icon: <Headset className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/sales", label: "Ventes", icon: <ShoppingCart className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/stats", label: "Statistiques", icon: <BarChart3 className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/wheel", label: "Roue à cadeaux", icon: <Gift className="w-5 h-5" />, roles: ["Hotesse", "Superviseur"] },
  { href: "/dashboard/goodies", label: "Goodies", icon: <Gift className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/sites", label: "Sites", icon: <MapPin className="w-5 h-5" />, roles: ["Administrateur", "Superviseur"] },
  { href: "/dashboard/objectifs", label: "Objectifs", icon: <Target className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/rapports", label: "Rapports journaliers", icon: <FileText className="w-5 h-5" />, roles: ["Administrateur", "Superviseur"] },
];

const adminNavItems: NavItem[] = [
  { href: "/dashboard/companies", label: "Entreprises", icon: <Building2 className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/products", label: "Produits", icon: <Package className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/team", label: "Équipe terrain", icon: <Users className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/prix-sites", label: "Prix par site", icon: <Tag className="w-5 h-5" />, roles: ["Administrateur"] },
  // { href: "/dashboard/zones", label: "Zones", icon: <MapPin className="w-5 h-5" />, roles: ["Administrateur"] },
  // { href: "/dashboard/reports", label: "Rapports", icon: <FileText className="w-5 h-5" />, roles: ["Administrateur", "Superviseur"] },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [entrepriseCampaigns, setEntrepriseCampaigns] = useState<CampagneList[]>([]);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const userRole = user?.role || "Non defini";
  const isEntreprise = userRole === "Entreprise";
  const isHostess = userRole === "Hotesse";
  const filteredAdminItems = adminNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const fetchEntrepriseCampaigns = useCallback(async () => {
    try {
      const { data } = await api.get<CampagneList[]>("/campagnes/");
      setEntrepriseCampaigns(Array.isArray(data) ? data : (data as { results?: CampagneList[] }).results ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (isEntreprise) fetchEntrepriseCampaigns();
  }, [isEntreprise, fetchEntrepriseCampaigns]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const NavLinks = () => (
    <>
      <div className="space-y-0.5">
        <p className="px-3 text-[10px] font-bold text-sidebar-foreground/35 uppercase tracking-widest mb-3">
          Menu principal
        </p>
        {navItems.filter(item => !item.roles || item.roles.includes(userRole)).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 rounded-full" />
              )}
              <span className={cn(
                "transition-all duration-150 shrink-0",
                isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100 group-hover:scale-110"
              )}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {isEntreprise && entrepriseCampaigns.length > 0 && (
        <div className="space-y-0.5 mt-6">
          <p className="px-3 text-[10px] font-bold text-sidebar-foreground/35 uppercase tracking-widest mb-3">
            Mes Campagnes
          </p>
          {entrepriseCampaigns.map((camp) => {
            const campHref = `/dashboard/company/campaigns/${camp.id}`;
            const isActive = pathname === campHref;
            return (
              <Link
                key={camp.id}
                href={campHref}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 rounded-full" />
                )}
                <span className={cn(
                  "transition-all duration-150 shrink-0",
                  isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100 group-hover:scale-110"
                )}>
                  <Target className="w-5 h-5" />
                </span>
                <span className="truncate">{camp.nom}</span>
              </Link>
            );
          })}
        </div>
      )}

      {filteredAdminItems.length > 0 && (
        <div className="space-y-0.5 mt-6">
          <div className="mx-3 mb-3 h-px bg-sidebar-border/60" />
          <p className="px-3 text-[10px] font-bold text-sidebar-foreground/35 uppercase tracking-widest mb-3">
            Administration
          </p>
          {filteredAdminItems.map((item) => {
            const isActive = pathname === item.href;
            return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 rounded-full" />
              )}
              <span className={cn(
                "transition-all duration-150 shrink-0",
                isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100 group-hover:scale-110"
              )}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Header — minimal pour l'hôtesse (logo + nom + réseau + menu utilisateur compact) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/LOGO-MHEDIA-01.svg" alt="Mhedia BTL" className="h-8 w-auto shrink-0" style={{ filter: 'brightness(0) invert(1)' }} />
            {isHostess && (
              <span className="text-sidebar-foreground/80 text-xs font-medium truncate">{user?.name}</span>
            )}
          </div>

          {isHostess ? (
            <div className="flex items-center gap-3 shrink-0">
              <span title={isOnline ? "Connecté" : "Hors ligne"}>
                {isOnline
                  ? <Wifi className="w-4 h-4 text-emerald-400" />
                  : <WifiOff className="w-4 h-4 text-amber-400" />}
              </span>
              <UserMenu user={user} signOut={signOut} getInitials={getInitials} compact />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-sidebar-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          )}
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && !isHostess && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <aside
        className={cn(
          "lg:hidden fixed top-14 left-0 bottom-0 z-40 w-72 bg-sidebar transform transition-transform duration-200 ease-in-out overflow-y-auto",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4">
          <NavLinks />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
          {installPrompt && (
            <button onClick={handleInstall} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150 mb-2">
              <Download className="w-5 h-5 opacity-60 shrink-0" />
              <span>Installer l&apos;application</span>
            </button>
          )}
          <UserMenu user={user} signOut={signOut} getInitials={getInitials} />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center px-6 py-5 border-b border-sidebar-border/60">
          <img src="/LOGO-MHEDIA-01.svg" alt="Mhedia BTL" className="h-10 w-auto" style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-4">
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {installPrompt && (
            <button onClick={handleInstall} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150 mb-2">
              <Download className="w-5 h-5 opacity-60 shrink-0" />
              <span>Installer l&apos;application</span>
            </button>
          )}
          <UserMenu user={user} signOut={signOut} getInitials={getInitials} />
        </div>
      </aside>

      {isHostess && <HostessBottomNav />}
    </>
  );
}

function UserMenu({
  user,
  signOut,
  getInitials,
  compact = false,
}: {
  user: { name: string; email: string; role: string; role_display?: string } | null;
  signOut: () => Promise<void>;
  getInitials: (name: string) => string;
  compact?: boolean;
}) {
  const roleLabels: Record<string, string> = {
    Hotesse: "Hôtesse",
    Superviseur: "Superviseur",
    Entreprise: "Entreprise",
    Administrateur: "Administrateur",
    "Non defini": "Utilisateur",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-sidebar-accent"
            aria-label="Menu utilisateur"
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {user ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto py-2 px-3 hover:bg-sidebar-accent"
          >
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                {user ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || "Utilisateur"}
              </p>
              <p className="text-xs text-sidebar-foreground/50">
                {user?.role_display || (user?.role ? roleLabels[user.role] : "")}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-sidebar-foreground/50" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div>
            <p className="font-medium font-heading">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2" />
            Paramètres
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
