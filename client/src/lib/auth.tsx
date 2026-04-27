import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { User } from './api';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const INACTIVITY_WARNING_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const LAST_ACTIVITY_KEY = 'ca_last_activity';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

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
      // Reset the inactivity baseline on login. Without this, a stale
      // `ca_last_activity` from the previous session (kept around to sync
      // across tabs) makes the new session look already-expired and fires
      // an immediate auto-logout the moment the inactivity effect runs.
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      } catch {
        // localStorage unavailable — the in-memory timer will still seed
        // itself with Date.now() inside the effect.
      }
    } else {
      localStorage.removeItem('ca_user');
      // Clear the activity baseline on logout so it can't leak into the
      // next login attempt. The next session will re-seed it to "now".
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        // ignore
      }
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Best-effort: clear client state even if the server call fails so the
      // user isn't stuck in a half-logged-in UI.
    }
    handleSetUser(null);
  };

  // Belt-and-braces logout-on-close. The server-side session cookie is
  // already a session-only cookie (no maxAge), so most browsers delete it
  // on window close. But Chrome with "continue where you left off"
  // restores session cookies on relaunch — so we also fire a sendBeacon
  // to /api/auth/logout on `pagehide` to actively destroy the server
  // session row. sendBeacon (unlike fetch) is guaranteed to send during
  // unload and includes cookies on same-origin requests.
  useEffect(() => {
    if (!user) return;
    const onPageHide = (e: PageTransitionEvent) => {
      // bfcache restores: don't kill the session, the user is coming back.
      if (e.persisted) return;
      try {
        navigator.sendBeacon?.('/api/auth/logout');
      } catch {
        // Browser may not support sendBeacon, or may block during unload.
        // Either way the session-only cookie is the primary defence.
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [user]);

  // Auto-logout after INACTIVITY_TIMEOUT_MS of no user activity. Tracked via
  // a shared localStorage timestamp so all open tabs reset and expire together.
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    const clearTimers = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      logoutTimerRef.current = null;
      warningTimerRef.current = null;
    };

    const performAutoLogout = async () => {
      clearTimers();
      await logout();
      toast({
        title: 'Signed out due to inactivity',
        description: 'For your security, please sign in again to continue.',
      });
      window.location.href = '/auth';
    };

    const scheduleTimers = (lastActivity: number) => {
      clearTimers();
      const elapsed = Date.now() - lastActivity;
      const remaining = INACTIVITY_TIMEOUT_MS - elapsed;
      if (remaining <= 0) {
        performAutoLogout();
        return;
      }
      const warningIn = remaining - INACTIVITY_WARNING_MS;
      if (warningIn > 0) {
        warningTimerRef.current = setTimeout(() => {
          toast({
            title: 'You will be signed out in 1 minute',
            description: 'Move your mouse or press a key to stay signed in.',
          });
        }, warningIn);
      }
      logoutTimerRef.current = setTimeout(performAutoLogout, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        // localStorage may be unavailable (private mode quotas) — fall back to
        // local timer only.
      }
      scheduleTimers(now);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== LAST_ACTIVITY_KEY || !e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (Number.isFinite(ts)) scheduleTimers(ts);
    };

    const stored = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '', 10);
    const initial = Number.isFinite(stored) ? stored : Date.now();
    if (!Number.isFinite(stored)) localStorage.setItem(LAST_ACTIVITY_KEY, String(initial));
    scheduleTimers(initial);

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, recordActivity, { passive: true });
    }
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimers();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, recordActivity);
      }
      window.removeEventListener('storage', onStorage);
    };
  }, [user]);

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
