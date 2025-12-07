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

// Utility function to clear all user data from storage
const clearUserData = (userId?: string | null) => {
  try {
    // Clear user-specific items if userId is provided
    if (userId) {
      localStorage.removeItem(`companionai-messages-${userId}`);
      localStorage.removeItem(`companionai-input-${userId}`);
    }
    
    // Clear all localStorage items that start with companionai-
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('companionai-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage as well
    sessionStorage.clear();

    // Clear any Supabase session data from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.error("Error clearing user data:", err);
  }
};

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

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        setUserUUID(session.user.id);
        setIsAuthenticated(true);
        setError(null);
      } else if (event === "SIGNED_OUT") {
        // Clear all user data when signed out
        clearUserData();
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
      const currentUserId = userUUID;
      
      // Trigger any pending syncs before signing out
      const event = new CustomEvent("beforeSignOut");
      window.dispatchEvent(event);

      // Small delay to allow sync to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Clear all user data before signing out
      clearUserData(currentUserId);

      await signOut();
      setUser(null);
      setUserUUID(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error("Sign out error:", err);
      setError("Failed to sign out");
      // Still clear data even if sign out fails
      clearUserData(userUUID);
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
