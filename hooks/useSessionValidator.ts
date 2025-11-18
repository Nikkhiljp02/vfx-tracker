"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

/**
 * Hook to validate session status periodically
 * Checks if the session is still active in the database
 * If session is force-logged-out by admin, redirects to login
 */
export function useSessionValidator(checkIntervalMs = 10000) {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Don't validate if not authenticated or interval is 0 (disabled)
    if (status !== "authenticated" || checkIntervalMs === 0) {
      return;
    }

    const validateSession = async () => {
      try {
        const response = await fetch("/api/auth/validate-session");
        const data = await response.json();

        if (!data.valid) {
          // Only handle force-logout, ignore no-session errors
          if (data.reason === "force-logout") {
            console.log("Session force-logged-out by admin");
            
            // Sign out and redirect to login
            await signOut({ redirect: false });
            alert(data.message || "Your session has been terminated by an administrator");
            router.push("/login");
          }
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
  }, [router, checkIntervalMs, status, session]);
}
