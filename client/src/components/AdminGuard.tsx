import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface AdminGuardProps {
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

export default function AdminGuard({ children }: AdminGuardProps) {
  const [, setLocation] = useLocation();
  
  const { data: userData, isLoading, error } = useQuery<UserResponse>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    // Only redirect if loading is complete and user is not admin
    if (!isLoading) {
      if (!userData?.user || !userData.user.isAdmin) {
        console.log("AdminGuard: Redirecting to home - not admin", { userData, error });
        setLocation("/");
      } else {
        console.log("AdminGuard: Access granted", { isAdmin: userData.user.isAdmin });
      }
    }
  }, [userData, isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!userData?.user || !userData.user.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
