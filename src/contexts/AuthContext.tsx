import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/utils";

type User = {
  email: string;
  provider?: "password";
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  devBypassLogin: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUser({ email: data.email, provider: data.provider ?? "password" });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: email, password }),
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    setUser({ email: data.user.email, provider: "password" });
  };

  const logout = async () => {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  // Dev-only helper: bypass backend login for quick access
  const devBypassLogin = () => {
    setUser({ email: "dev@bypass.local", provider: "password" });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        logout,
        isAuthenticated: !!user,
        devBypassLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

