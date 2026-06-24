"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, LayoutGrid, Target, FerrisWheel } from "lucide-react";

const HOSTESS_NAV_ITEMS = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/dashboard/campaigns", label: "Campagnes", icon: LayoutGrid },
  { href: "/dashboard/objectifs", label: "Objectifs", icon: Target },
  { href: "/dashboard/wheel", label: "Roue", icon: FerrisWheel },
];

/**
 * Navigation mobile dédiée au rôle Hôtesse — remplace le menu burger/drawer
 * desktop par 4 raccourcis directs (utilisation terrain debout, une main).
 */
export function HostessBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="grid grid-cols-4">
        {HOSTESS_NAV_ITEMS.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors relative",
                isActive ? "text-white" : "text-sidebar-foreground/50"
              )}
            >
              {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-sidebar-primary" />}
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
