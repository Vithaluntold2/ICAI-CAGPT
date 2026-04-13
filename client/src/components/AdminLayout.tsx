import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { LayoutDashboard, Users, CreditCard, Tag, BarChart3, LogOut, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard, testId: "link-admin-dashboard" },
  { name: "Training Data", href: "/admin/training-data", icon: Sparkles, testId: "link-admin-training-data" },
  { name: "Coupons", href: "/admin/coupons", icon: Tag, testId: "link-admin-coupons" },
  { name: "Users", href: "/admin/users", icon: Users, testId: "link-admin-users" },
  { name: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard, testId: "link-admin-subscriptions" },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3, testId: "link-admin-analytics" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface SuperAdminCheckResponse {
  isSuperAdmin: boolean;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  subscriptionTier?: string;
}

interface UserDataResponse {
  user?: User;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  
  // Force light mode for Admin portal to match UI guidelines
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    
    // Restore previous theme when leaving Admin
    return () => {
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);
  
  const { data: userData } = useQuery<UserDataResponse>({
    queryKey: ["/api/auth/user"],
  });

  // Check super admin status via API
  const { data: superAdminData } = useQuery<SuperAdminCheckResponse>({
    queryKey: ["/api/admin/super-admin-check"],
    retry: false,
  });

  const user = userData?.user;
  const isSuperAdmin = superAdminData?.isSuperAdmin || false;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    window.location.href = "/";
  };

  const initials = user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "AD";

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r flex flex-col" data-testid="admin-sidebar">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            CA GPT Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Platform Management</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  data-testid={item.testId}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover-elevate active-elevate-2 cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{user?.name || "Admin"}</p>
                {isSuperAdmin && (
                  <Shield className="w-3.5 h-3.5 text-green-500" aria-label="Super Admin" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {user?.subscriptionTier && (
                  <span className="text-xs text-green-600 font-medium">• {user.subscriptionTier}</span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
            data-testid="button-admin-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
