import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  outlet_id?: number | null;
  outlet_name?: string | null;
  outlet_code?: string | null;
  outlet_role?: string | null;
  tenant_id?: number | null;
  is_super_admin?: boolean;
  tenant_name?: string | null;
  allowed_modules?: string[] | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isOutletUser: boolean;
  isSuperAdmin: boolean;
  outletId: number | null;
  outletName: string | null;
  allowedModules: string[] | null;
  hasModule: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      authAPI.me().then(res => {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authAPI.login(email, password);
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isOutletUser = !!(user?.outlet_id);
  const outletId = user?.outlet_id || null;
  const outletName = user?.outlet_name || null;
  const isSuperAdmin = !!(user?.is_super_admin);
  const allowedModules = user?.allowed_modules || null;

  // Check if a module is allowed — super admin always has access, null means all allowed
  const hasModule = (moduleKey: string): boolean => {
    if (isSuperAdmin) return true;
    if (!allowedModules) return true; // null = all allowed (backward compatible)
    return allowedModules.includes(moduleKey);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      isAdmin: user?.role === 'admin' && !isOutletUser,
      isOutletUser,
      isSuperAdmin,
      outletId,
      outletName,
      allowedModules,
      hasModule,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}