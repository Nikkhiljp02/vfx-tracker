"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

/**
 * Hook to validate session status periodically
 * Checks if the session is still active in the database
 * If session is force-logged-out by admin, redirects to login
 */
export function useSessionValidator(checkIntervalMs = 10000) {
  const router = useRouter();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const response = await fetch("/api/auth/validate-session");
        const data = await response.json();

        if (!data.valid) {
          console.log("Session invalid:", data.reason);
          
          // Sign out and redirect to login
          await signOut({ redirect: false });
          
          if (data.reason === "force-logout") {
            alert(data.message || "Your session has been terminated by an administrator");
          }
          
          router.push("/login");
        }
      } catch (error) {
        console.error("Error validating session:", error);
      }
    };

    // Check immediately on mount
    validateSession();

    // Then check periodically
    const interval = setInterval(validateSession, checkIntervalMs);

    return () => clearInterval(interval);
  }, [router, checkIntervalMs]);
}
