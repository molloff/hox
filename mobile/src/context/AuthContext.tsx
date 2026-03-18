import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as authService from '../services/auth';
import { getAccessToken, clearTokens } from '../services/secureStore';
import { getProfile, type Profile } from '../services/profile';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  user: Profile | null;
}

interface AuthContextValue extends AuthState {
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isVerified: false,
    user: null,
  });

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getProfile();
      setState({
        isLoading: false,
        isAuthenticated: true,
        isVerified: profile.is_verified,
        user: profile,
      });
    } catch {
      setState({ isLoading: false, isAuthenticated: false, isVerified: false, user: null });
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        await refreshUser();
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, [refreshUser]);

  const sendOtp = async (phone: string) => {
    await authService.sendOtp(phone);
  };

  const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
    const result = await authService.verifyOtp(phone, code);
    setState({
      isLoading: false,
      isAuthenticated: true,
      isVerified: result.user.is_verified,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        kyc_status: result.user.kyc_status,
        is_verified: result.user.is_verified,
        profile_type: result.user.profile_type,
        display_name: null,
        skills: [],
        description: '',
        company_name: null,
        eik: null,
        created_at: '',
        updated_at: '',
      },
    });
    return result.isNewUser;
  };

  const logout = async () => {
    await clearTokens();
    setState({ isLoading: false, isAuthenticated: false, isVerified: false, user: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, sendOtp, verifyOtp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
