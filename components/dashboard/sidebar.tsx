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
  ChevronUp,
  Archive,
  Eye,
  Trash2,
  Download,
  Tag,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import type { CampagneList } from "@/lib/types/backend";

interface ArchivedReport {
  id: string;
  entrepriseNom: string;
  generatedAt: string;
  label: string;
  htmlContent: string;
}

const ARCHIVE_KEY = "btl_rapport_archives";

function loadArchives(): ArchivedReport[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? "[]"); }
  catch { return []; }
}

function deleteArchive(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(loadArchives().filter(a => a.id !== id)));
}

function ArchivePanel() {
  const [open, setOpen] = useState(false);
  const [archives, setArchives] = useState<ArchivedReport[]>([]);

  useEffect(() => {
    if (open) setArchives(loadArchives());
  }, [open]);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Archive className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-left">Rapports archivés</span>
        {archives.length > 0 && !open && (
          <span className="text-[10px] font-bold bg-violet-500 text-white rounded-full px-1.5 py-0.5 leading-none">{archives.length}</span>
        )}
        {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>

      {open && (
        <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-0.5 max-h-72 overflow-y-auto">
          {archives.length === 0 ? (
            <p className="px-2 py-3 text-xs text-sidebar-foreground/40 italic">Aucun rapport archivé.</p>
          ) : (
            archives.map(archive => (
              <div key={archive.id} className="group flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-sidebar-accent/60 transition-colors">
                <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{archive.entrepriseNom}</p>
                  <p className="text-[11px] text-violet-300 truncate">{archive.label}</p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Consulter"
                    onClick={() => {
                      const blob = new Blob([archive.htmlContent], { type: "text/html;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                      setTimeout(() => URL.revokeObjectURL(url), 15000);
                    }}
                    className="p-1 rounded hover:bg-violet-500/20 text-violet-300 hover:text-violet-200 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    title="Télécharger"
                    onClick={() => {
                      const blob = new Blob([archive.htmlContent], { type: "text/html;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Rapport_${archive.entrepriseNom.replace(/\s+/g, "_")}_${archive.generatedAt.slice(0, 10)}.html`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                    }}
                    className="p-1 rounded hover:bg-slate-500/20 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    title="Supprimer"
                    onClick={() => { deleteArchive(archive.id); setArchives(loadArchives()); }}
                    className="p-1 rounded hover:bg-red-500/20 text-sidebar-foreground/30 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
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
  { href: "/dashboard/sales", label: "Ventes", icon: <ShoppingCart className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/stats", label: "Statistiques", icon: <BarChart3 className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/wheel", label: "Roue à cadeaux", icon: <Gift className="w-5 h-5" />, roles: ["Hotesse", "Superviseur"] },
  { href: "/dashboard/goodies", label: "Goodies", icon: <Gift className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/sites", label: "Sites", icon: <MapPin className="w-5 h-5" />, roles: ["Administrateur"] },
  { href: "/dashboard/objectifs", label: "Objectifs", icon: <Target className="w-5 h-5" />, roles: ["Administrateur", "Superviseur", "Hotesse"] },
  { href: "/dashboard/rapports", label: "Rapports journaliers", icon: <FileText className="w-5 h-5" />, roles: ["Administrateur", "Superviseur"] },
  { href: "__archive_panel__", label: "__archive_panel__", icon: null, roles: ["Administrateur"] },
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

  const userRole = user?.role || "Non defini";
  const isEntreprise = userRole === "Entreprise";
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
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
          Menu principal
        </p>
        {navItems.filter(item => !item.roles || item.roles.includes(userRole)).map((item) => {
          if (item.href === "__archive_panel__") return <ArchivePanel key="archive-panel" />;
          return (
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
          );
        })}
      </div>

      {isEntreprise && entrepriseCampaigns.length > 0 && (
        <div className="space-y-1 mt-6">
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2">
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/30"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <span className={cn(
                  "transition-transform duration-200",
                  isActive ? "" : "group-hover:scale-110"
                )}>
                  <Target className="w-5 h-5" />
                </span>
                <span className="truncate">{camp.nom}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
                )}
              </Link>
            );
          })}
        </div>
      )}

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
