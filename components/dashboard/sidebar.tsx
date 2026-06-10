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
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/company", label: "Mon tableau de bord", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["Entreprise"] },
  { href: "/dashboard/campaigns", label: "Campagnes", icon: <Target className="w-5 h-5" /> },
  { href: "/dashboard/tastings", label: "Dégustations", icon: <UtensilsCrossed className="w-5 h-5" /> },
  { href: "/dashboard/sales", label: "Ventes", icon: <ShoppingCart className="w-5 h-5" /> },
  { href: "/dashboard/stats", label: "Statistiques", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/dashboard/wheel", label: "Roue à cadeaux", icon: <Gift className="w-5 h-5" />, roles: ["Hotesse", "Superviseur"] },
  { href: "/dashboard/goodies", label: "Goodies", icon: <Gift className="w-5 h-5" />, roles: ["Administrateur"] },
];

const adminNavItems: NavItem[] = [
  { href: "/dashboard/companies", label: "Entreprises", icon: <Building2 className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/products", label: "Produits", icon: <Package className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/team", label: "Équipe terrain", icon: <Users className="w-5 h-5" />, roles: ["Administrateur"] },
  // { href: "/dashboard/zones", label: "Zones", icon: <MapPin className="w-5 h-5" />, roles: ["Administrateur"] },
  // { href: "/dashboard/reports", label: "Rapports", icon: <FileText className="w-5 h-5" />, roles: ["Administrateur", "Superviseur"] },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userRole = user?.role || "Non defini";
  const filteredAdminItems = adminNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

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
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
          Menu principal
        </p>
        {navItems.filter(item => !item.roles || item.roles.includes(userRole)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
              pathname === item.href
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/30"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <span className={cn(
              "transition-transform duration-200",
              pathname === item.href ? "" : "group-hover:scale-110"
            )}>
              {item.icon}
            </span>
            {item.label}
            {pathname === item.href && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
            )}
          </Link>
        ))}
      </div>

      {filteredAdminItems.length > 0 && (
        <div className="space-y-1 mt-6">
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
            Administration
          </p>
          {filteredAdminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                pathname === item.href
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/30"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span className={cn(
                "transition-transform duration-200",
                pathname === item.href ? "" : "group-hover:scale-110"
              )}>
                {item.icon}
              </span>
              {item.label}
              {pathname === item.href && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img src="/LOGO-MHEDIA-01.svg" alt="Mhedia BTL" className="h-8 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-sidebar-foreground"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
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
          <UserMenu user={user} signOut={signOut} getInitials={getInitials} />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center px-6 py-5 border-b border-sidebar-border">
          <img src="/LOGO-MHEDIA-01.svg" alt="Mhedia BTL" className="h-12 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <UserMenu user={user} signOut={signOut} getInitials={getInitials} />
        </div>
      </aside>
    </>
  );
}

function UserMenu({
  user,
  signOut,
  getInitials,
}: {
  user: { name: string; email: string; role: string; role_display?: string } | null;
  signOut: () => Promise<void>;
  getInitials: (name: string) => string;
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
