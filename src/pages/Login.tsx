import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/utils";

const GOOGLE_CLIENT_ID = "859859771398-erv8s8o5kdvib9k0n1cu8eau2u9l6u4b.apps.googleusercontent.com";

// TypeScript declaration for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  // Handle Google Sign-In callback
  const handleGoogleSignIn = useCallback(async (response: { credential: string }) => {
    try {
      setLoading(true);
      setAuthError(null);

      // Send the credential to backend
      const res = await fetch(`${getApiBaseUrl()}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Login failed");
      }

      const data = await res.json();
      toast.success("Successfully logged in with Google!");
      
      // Navigate to home page - the auth context will check session on next render
      const from = (location.state as any)?.from?.pathname || "/home";
      window.location.href = from;
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      setAuthError(error.message || "Failed to sign in with Google");
      toast.error(error.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  }, [location.state]);

  // Force light theme on login page
  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || "/home";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  // Initialize Google Identity Services
  useEffect(() => {
    if (googleInitialized.current || !googleButtonRef.current) return;

    // Check if script already exists
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      // Script already loaded, just initialize
      if (window.google?.accounts) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleSignIn,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          width: "100%",
        });
        googleInitialized.current = true;
      }
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleSignIn,
        });

        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            width: "100%",
          });
        }

        googleInitialized.current = true;
      }
    };
    script.onerror = () => {
      setAuthError("Failed to load Google Sign-In. Please refresh the page.");
    };
    document.body.appendChild(script);
  }, [handleGoogleSignIn]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Secure Access</span>
          </div>
          <CardTitle className="text-xl">Login to UniQ Labs</CardTitle>
          <p className="text-sm text-muted-foreground">Access Notebook, Cloud Connect, Simulations, and AI Assistant.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Sign in with your Google account to access all features
          </p>
          {authError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {authError}
            </div>
          )}
          {loading ? (
            <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" disabled>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </Button>
          ) : (
            <div ref={googleButtonRef} className="w-full flex justify-center"></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}