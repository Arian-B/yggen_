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
  login: (token: string, user: AuthUser) => void;
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

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem('wikiyggen_token', newToken);
    localStorage.setItem('wikiyggen_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wikiyggen_token');
    localStorage.removeItem('wikiyggen_user');
    setToken(null);
    setUser(null);
  }, []);

  const updateAvatar = useCallback((url: string) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, avatar_url: url };
      localStorage.setItem('wikiyggen_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // On mount: restore session from localStorage, verify token with /me
  useEffect(() => {
    const storedToken = localStorage.getItem('wikiyggen_token');
    const storedUser = localStorage.getItem('wikiyggen_user');

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

    // Verify token is still valid with backend
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then(r => {
        if (!r.ok) throw new Error('Token expired');
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
        login(storedToken, authUser);
      })
      .catch(() => {
        // Token invalid — clear session
        logout();
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
