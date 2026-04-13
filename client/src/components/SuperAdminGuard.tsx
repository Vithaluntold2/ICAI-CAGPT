import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuperAdminGuardProps {
  children: React.ReactNode;
}

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  subscriptionTier: string;
}

interface UserResponse {
  user: User;
}

interface SuperAdminCheckResponse {
  isSuperAdmin: boolean;
  email?: string;
}

export default function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const [, setLocation] = useLocation();
  
  // First check if user is logged in and is admin
  const { data: userData, isLoading: userLoading, error: userError } = useQuery<UserResponse>({
    queryKey: ["/api/auth/me"],
  });

  // Then check if user is super admin
  const { data: superAdminData, isLoading: superAdminLoading, error: superAdminError } = useQuery<SuperAdminCheckResponse>({
    queryKey: ["/api/admin/super-admin-check"],
    enabled: !!userData?.user?.isAdmin, // Only check super admin status if user is admin
    retry: false, // Don't retry if access denied
  });

  const isLoading = userLoading || (userData?.user?.isAdmin && superAdminLoading);

  useEffect(() => {
    // Redirect to home if not logged in or not admin
    if (!userLoading && (!userData?.user || !userData.user.isAdmin)) {
      console.log("SuperAdminGuard: Redirecting to home - not admin", { userData, userError });
      setLocation("/");
    }
  }, [userData, userLoading, userError, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying super admin access...</p>
        </div>
      </div>
    );
  }

  // Not logged in or not admin
  if (!userData?.user || !userData.user.isAdmin) {
    return null;
  }

  // Admin but not super admin - show access denied message
  if (!superAdminData?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md p-8">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Super Admin Access Required</h2>
          <p className="text-muted-foreground mb-6">
            This section is restricted to super administrators only. 
            Contact your system administrator if you believe you should have access.
          </p>
          <div className="space-y-2">
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => setLocation("/admin")}
            >
              Return to Admin Dashboard
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation("/")}
            >
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
