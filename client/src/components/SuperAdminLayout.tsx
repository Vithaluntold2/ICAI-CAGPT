import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { 
  Activity, 
  Shield, 
  Server, 
  AlertTriangle, 
  Settings, 
  LogOut, 
  Cpu,
  Database,
  Globe,
  Bell,
  GitBranch,
  Gauge
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

const navigation = [
  { name: "System Overview", href: "/superadmin", icon: Gauge, testId: "link-superadmin-overview" },
  { name: "System Health", href: "/superadmin/health", icon: Activity, testId: "link-superadmin-health" },
  { name: "Security Threats", href: "/superadmin/threats", icon: Shield, testId: "link-superadmin-threats" },
  { name: "Deployments", href: "/superadmin/deployments", icon: GitBranch, testId: "link-superadmin-deployments" },
  { name: "Maintenance", href: "/superadmin/maintenance", icon: Server, testId: "link-superadmin-maintenance" },
  { name: "Alerts", href: "/superadmin/alerts", icon: Bell, testId: "link-superadmin-alerts" },
  { name: "Performance", href: "/superadmin/performance", icon: Cpu, testId: "link-superadmin-performance" },
  { name: "Integrations", href: "/superadmin/integrations", icon: Globe, testId: "link-superadmin-integrations" },
];

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface UserResponse {
  user: User;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [location] = useLocation();
  
  // Force light mode for Super Admin portal to match admin UI guidelines
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    
    // Restore previous theme when leaving Super Admin
    return () => {
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);
  
  const { data: userData } = useQuery<UserResponse>({
    queryKey: ["/api/auth/me"],
  });

  const user = userData?.user;

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
    .slice(0, 2) || "SA";

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r flex flex-col" data-testid="superadmin-sidebar">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Super Admin
            </h1>
          </div>
          <Badge variant="secondary" className="mt-2 text-xs">System Level Access</Badge>
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
          <Link href="/admin">
            <Button
              variant="outline"
              className="w-full mb-3"
            >
              <Settings className="w-4 h-4 mr-2" />
              Go to Admin Portal
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "Super Admin"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
            data-testid="button-superadmin-logout"
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
