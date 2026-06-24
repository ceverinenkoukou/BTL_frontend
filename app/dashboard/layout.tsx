import { AuthProvider } from "@/components/providers/auth-provider";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardMain } from "@/components/dashboard/dashboard-main";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <BrandingProvider>
        <div className="min-h-screen bg-background">
          <DashboardSidebar />
          <DashboardMain>{children}</DashboardMain>
        </div>
      </BrandingProvider>
    </AuthProvider>
  );
}
