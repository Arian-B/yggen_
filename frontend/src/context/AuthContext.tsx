import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthUser {
  user_id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  total_xp?: number;
  level?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser, rememberMe?: boolean) => void;
  logout: () => void;
  updateAvatar: (url: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateAvatar: () => {}
});

const API_BASE = 'http://localhost:8000/api';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback((newToken: string, newUser: AuthUser, rememberMe = true) => {
    localStorage.removeItem('wikiyggen_token');
    localStorage.removeItem('wikiyggen_user');
    sessionStorage.removeItem('wikiyggen_token');
    sessionStorage.removeItem('wikiyggen_user');

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('wikiyggen_token', newToken);
    storage.setItem('wikiyggen_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wikiyggen_token');
    localStorage.removeItem('wikiyggen_user');
    sessionStorage.removeItem('wikiyggen_token');
    sessionStorage.removeItem('wikiyggen_user');
    setToken(null);
    setUser(null);
  }, []);

  const updateAvatar = useCallback((url: string) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, avatar_url: url };
      if (localStorage.getItem('wikiyggen_token')) {
        localStorage.setItem('wikiyggen_user', JSON.stringify(updated));
      } else {
        sessionStorage.setItem('wikiyggen_user', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // On mount: restore session, verify token with /me
  useEffect(() => {
    const storedToken = localStorage.getItem('wikiyggen_token') || sessionStorage.getItem('wikiyggen_token');
    const storedUser = localStorage.getItem('wikiyggen_user') || sessionStorage.getItem('wikiyggen_user');
    const isRemembered = !!localStorage.getItem('wikiyggen_token');

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Optimistic restore for instant UI
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch { /* corrupted */ }
    }

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then(r => {
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            logout();
          }
          throw new Error('Token expired or invalid');
        }
        return r.json();
      })
      .then(freshUser => {
        const authUser: AuthUser = {
          user_id: freshUser.user_id,
          email: freshUser.email,
          display_name: freshUser.display_name,
          avatar_url: freshUser.avatar_url,
          total_xp: freshUser.total_xp,
          level: freshUser.level
        };
        login(storedToken, authUser, isRemembered);
      })
      .catch((err) => {
        // We do NOT call logout() here automatically anymore for network errors.
        // If the backend is simply down or booting up, we keep the stored UI session intact.
        console.warn("Failed to verify session with backend:", err);
      })
      .finally(() => setIsLoading(false));
  }, [login, logout]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
