import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getCurrentUser, signOut, supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  userUUID: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userUUID: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [userUUID, setUserUUID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user is already authenticated
        const currentUser = await getCurrentUser();

        if (currentUser) {
          setUser(currentUser);
          setUserUUID(currentUser.id);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setUserUUID(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setUser(null);
        setUserUUID(null);
        setIsAuthenticated(false);
        setError(err instanceof Error ? err.message : "Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
    console.log(userUUID);

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        setUserUUID(session.user.id);
        setIsAuthenticated(true);
        setError(null);
        console.log("userUUID");
        console.log(userUUID);
        console.log(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setUserUUID(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      // Trigger any pending syncs before signing out
      const event = new CustomEvent("beforeSignOut");
      window.dispatchEvent(event);

      // Small delay to allow sync to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await signOut();
      setUser(null);
      setUserUUID(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error("Sign out error:", err);
      setError("Failed to sign out");
    }
  };

  const value = {
    user,
    userUUID,
    loading,
    error,
    isAuthenticated,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
