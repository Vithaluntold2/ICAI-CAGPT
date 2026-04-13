import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Wraps routes that require authentication.
 * Redirects to /auth if no user session exists.
 * Optionally enforces admin access.
 */
export function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Redirect to="/chat" />;
  }

  return <>{children}</>;
}
