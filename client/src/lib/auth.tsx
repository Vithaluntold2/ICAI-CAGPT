import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from './api';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount and validate session with server
    const validateSession = async (retryCount = 0) => {
      const storedUser = localStorage.getItem('ca_user');
      
      if (storedUser) {
        try {
          // First, set the user from localStorage for immediate UI
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          
          // Then validate with server
          const res = await fetch('/api/auth/me', {
            credentials: 'include'
          });
          
          if (res.ok) {
            // Session is valid, update with fresh user data
            const data = await res.json();
            setUser(data.user);
            localStorage.setItem('ca_user', JSON.stringify(data.user));
          } else if (res.status === 401) {
            // Session expired, clear localStorage
            console.log('[Auth] Session expired, clearing user');
            setUser(null);
            localStorage.removeItem('ca_user');
          } else if (res.status === 503 && retryCount < 3) {
            // Server starting up, retry after a delay
            console.log('[Auth] Server starting, retrying...', retryCount + 1);
            setTimeout(() => validateSession(retryCount + 1), 1000);
            return; // Don't set isLoading to false yet
          }
        } catch (e) {
          // Network error or parse error
          console.error('[Auth] Session validation error:', e);
          // Keep the localStorage user but mark session as potentially stale
        }
      }
      
      setIsLoading(false);
    };
    
    validateSession();
  }, []);

  const handleSetUser = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('ca_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('ca_user');
    }
  };

  const logout = () => {
    handleSetUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
