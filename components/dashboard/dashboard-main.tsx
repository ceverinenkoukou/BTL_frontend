"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

export function DashboardMain({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isHostess = user?.role === "Hotesse";

  return (
    <main className={cn("lg:pl-64 pt-14 lg:pt-0", isHostess && "pb-16 lg:pb-0")}>
      <div className="p-4 md:p-6 lg:p-8 page-enter">{children}</div>
    </main>
  );
}
