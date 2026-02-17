import { createContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { User, AuthTokens, LoginCredentials, RegisterData, Membership } from '../types';
import { login as apiLogin, register as apiRegister, getMe } from '../api/client';

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 7,
  admin: 6,
  regional_manager: 5,
  store_manager: 4,
  manager: 3,
  finance: 2,
  member: 1,
  evaluator: 1,
};

export interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  memberships: Membership[];
  currentMembership: Membership | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  hasRole: (minimumRole: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  // Compute currentMembership from selectedOrgId
  const currentMembership = useMemo(() => {
    const selectedOrgId = localStorage.getItem('selectedOrgId');
    if (selectedOrgId && memberships.length > 0) {
      const found = memberships.find((m) => m.organization.id === selectedOrgId);
      if (found) return found;
    }
    // Fallback to first membership
    return memberships.length > 0 ? memberships[0] : null;
  }, [memberships]);

  const hasRole = useCallback(
    (minimumRole: string): boolean => {
      if (!currentMembership) return false;
      const userLevel = ROLE_HIERARCHY[currentMembership.role] ?? 0;
      const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;
      return userLevel >= requiredLevel;
    },
    [currentMembership]
  );

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tokensRaw = localStorage.getItem('tokens');
        if (tokensRaw) {
          const storedTokens: AuthTokens = JSON.parse(tokensRaw);
          setTokens(storedTokens);

          // Validate tokens by fetching current user
          const data = await getMe();
          setUser(data.user);
          setMemberships(data.memberships);
          localStorage.setItem('memberships', JSON.stringify(data.memberships));
        }
      } catch {
        // Tokens are invalid or expired, clear everything
        localStorage.removeItem('tokens');
        localStorage.removeItem('user');
        localStorage.removeItem('memberships');
        setTokens(null);
        setUser(null);
        setMemberships([]);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const data = await apiLogin(credentials);
    localStorage.setItem('tokens', JSON.stringify(data.tokens));
    setTokens(data.tokens);
    setUser(data.user);
    setMemberships(data.memberships);
    localStorage.setItem('user', JSON.stringify({
      ...data.user,
      memberships: data.memberships,
    }));
    localStorage.setItem('memberships', JSON.stringify(data.memberships));

    // Auto-select first org if none selected
    if (!localStorage.getItem('selectedOrgId') && data.memberships.length > 0) {
      localStorage.setItem('selectedOrgId', data.memberships[0].organization.id);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await apiRegister(data);
    localStorage.setItem('tokens', JSON.stringify(res.tokens));
    setTokens(res.tokens);
    setUser(res.user);

    // Build membership from register response
    const newMemberships: Membership[] = res.organization
      ? [{ id: '', organization: res.organization, role: 'owner' }]
      : [];
    setMemberships(newMemberships);
    localStorage.setItem('user', JSON.stringify({
      ...res.user,
      memberships: newMemberships,
    }));
    localStorage.setItem('memberships', JSON.stringify(newMemberships));

    if (res.organization) {
      localStorage.setItem('selectedOrgId', res.organization.id);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tokens');
    localStorage.removeItem('user');
    localStorage.removeItem('memberships');
    localStorage.removeItem('selectedOrgId');
    setTokens(null);
    setUser(null);
    setMemberships([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        memberships,
        currentMembership,
        loading,
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
